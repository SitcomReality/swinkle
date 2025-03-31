import { loadDevNotes } from './dev-notes.js';
import { startGameLoop } from './game-loop.js';
import config from 'config';
// Import player functions from the facade module
import { removePlayerPhysicsState } from './player.js';
import { initScoreboard } from './scoreboard.js'; // Import scoreboard initializer

export const room = new WebsimSocket();

// Initialize multiplayer connection and game state
async function initGame() {
    await room.initialize();

    // Ensure initial room state exists if not already present
    // Use a single updateRoomState call for efficiency
    const initialRoomStateUpdates = {};
    if (room.roomState.droplets === undefined) { // Check for undefined specifically
        initialRoomStateUpdates.droplets = {};
    }
    if (room.roomState.paintCans === undefined) {
        initialRoomStateUpdates.paintCans = {};
    }
    if (room.roomState.availablePaintCans === undefined) {
        initialRoomStateUpdates.availablePaintCans = {};
    }
    if (Object.keys(initialRoomStateUpdates).length > 0) {
        console.log("Initializing room state:", initialRoomStateUpdates);
        room.updateRoomState(initialRoomStateUpdates);
    }

    // Track mouse movement for player presence (anchor point)
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    canvas.addEventListener('mousemove', (e) => {
        // Send anchor position and let the rendering decide the color/character state
        // Painted data and can ID are updated separately based on game events
        room.updatePresence({
            x: e.clientX,
            y: e.clientY,
        });
    });

    // Handle clicks for squirting (now droplets) - Disabled
    canvas.addEventListener('click', (e) => {
        // Default click action disabled, handled by mousedown/up for charging/burst
    });

    // Handle mouse down/up for paint charging
    canvas.addEventListener('mousedown', (e) => {
        const localPresence = room.presence[room.clientId];
        if (localPresence && localPresence.currentCanId && !localPresence.lost) { // Prevent interaction if lost
            const canId = localPresence.currentCanId;
            // Check if can still exists and is owned by us (prevent race condition errors)
            const canState = room.roomState.paintCans?.[canId];
             if (canState && canState.ownerId === room.clientId) {
                console.log(`Starting charge for can ${canId}`);
                room.updateRoomState({
                    paintCans: {
                        [canId]: { isCharging: true }
                    }
                });
             }
        }
    });
    canvas.addEventListener('mouseup', (e) => {
        const localPresence = room.presence[room.clientId];
        // Don't burst if lost, even if mouseup happens after loss
        if (localPresence && localPresence.currentCanId && !localPresence.lost) {
            const canId = localPresence.currentCanId;
            const canState = room.roomState.paintCans?.[canId];

            // Only proceed if the can exists, is owned by us, and was potentially charging
            if (canState && canState.ownerId === room.clientId) {
                console.log(`Stopping charge / Releasing burst for can ${canId}`);
                const dropletsToBurst = canState.accumulatedDroplets || 0;
                const updates = {
                    paintCans: {
                        [canId]: {
                            isCharging: false,
                            accumulatedDroplets: 0 // Reset accumulation regardless of burst
                        }
                    }
                };

                if (dropletsToBurst > 0) {
                    const burstDroplets = {};
                    const canX = canState.x;
                    const canY = canState.y;
                    console.log(`Releasing burst of ${dropletsToBurst} droplets from ${canId}`);

                    for (let i = 0; i < dropletsToBurst; i++) {
                        // Simple unique ID
                        const dropletId = `${room.clientId}-${Date.now()}-${i}`;
                        // Add slight random offset for burst effect
                        const angle = Math.random() * Math.PI * 2;
                        const radius = Math.random() * 15; // Spread within 15 pixels
                        burstDroplets[dropletId] = {
                            id: dropletId,
                            ownerId: room.clientId, // Owner of the droplet is the player who fired it
                            color: canState.paintColor,
                            x: canX + Math.cos(angle) * radius,
                            y: canY + Math.sin(angle) * radius,
                            createdAt: Date.now()
                        };
                    }
                    // Add droplets to the same update object sent to the server
                    updates.droplets = burstDroplets;
                } else {
                     console.log(`No accumulated droplets for ${canId}, just stopping charge.`);
                }

                // Send the combined update (stop charge, reset accum, add burst droplets if any)
                room.updateRoomState(updates);
            }
        }
    });

    // Initial presence update with a default color and new state fields
    // This ensures the player appears immediately with all required presence data
    room.updatePresence({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        color: config.defaultPlayerColor || '#FFFFFF', // Base player color
        paintedData: {}, // Initialize empty painted data
        currentCanId: null, // Initialize with no paint can
        lost: false // Initialize with not lost state
        // Character-specific state (like physics) will be managed client-side initially
    });

    // Setup presence subscription for other players
    room.subscribePresence((presence) => {
        // Presence updates are now primarily handled within the game loop's rendering logic
        // and the scoreboard subscription.
        // This subscription remains useful for triggering specific events on presence change if needed later.
        // Example: Detect when a peer disconnects to handle can ownership transfer
        const currentPeers = new Set(Object.keys(room.peers));
        const localClientId = room.clientId;

        // Check for players who left
        Object.keys(room.presence).forEach(clientId => {
            if (!currentPeers.has(clientId)) {
                // Peer disconnected
                removePlayerPhysicsState(clientId); // Calls the facade function

                // Check if the disconnected player owned any cans
                const paintCans = room.roomState.paintCans || {};
                const cansToUpdate = {};
                let availableCansToAdd = {};
                let ownedCansToRemove = {};

                for (const [canId, canState] of Object.entries(paintCans)) {
                    if (canState && canState.ownerId === clientId) {
                        console.log(`Player ${clientId} disconnected, making can ${canId} available`);
                        // Create an entry to add to availablePaintCans
                         availableCansToAdd[canId] = {
                            ...canState,
                            ownerId: null, // Mark as unowned
                            // Reset dynamic state
                            vx: 0,
                            vy: 0,
                            isCharging: false,
                            accumulatedDroplets: 0
                         };
                         // Mark the owned can for removal
                         ownedCansToRemove[canId] = null;
                    }
                }

                 // Send updates IF this client is the one detecting the disconnect
                 // TODO: This could still cause race conditions if multiple clients detect simultaneously.
                 // A more robust solution might involve a leader election or distributed lock,
                 // but for now, any client can attempt the update.
                 if (Object.keys(availableCansToAdd).length > 0) {
                     room.updateRoomState({
                        paintCans: ownedCansToRemove,
                        availablePaintCans: availableCansToAdd
                    });
                 }
            }
        });
    });

    // Subscribe to room state changes (optional, for debugging or complex logic)
    room.subscribeRoomState((currentRoomState) => {
        // console.log("Room state updated:", currentRoomState);
    });

    // Start rendering loop, passing the room instance
    startGameLoop(room);

    // Initialize the scoreboard AFTER the room is ready and loop is starting
    initScoreboard(room);
}

// Initialize the app
loadDevNotes();
initGame().catch(console.error);