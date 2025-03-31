import { loadDevNotes } from './dev-notes.js';
import { startGameLoop } from './game-loop.js';
import config from 'config';
// Import player state function directly if needed
import { removePlayerPhysicsState } from './playerState.js';
import { initScoreboard } from './scoreboard.js'; // Import scoreboard initializer
// Import interaction handler for throwing
import { handleThrowPaintCan } from './playerInteractions.js';

export const room = new WebsimSocket();

// Store key state
const keyState = {};

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
        // Initialize with a couple of cans perhaps?
         const initialCans = {};
         for (let i = 0; i < (config.initialAvailableCans || 2); i++) {
             const canId = `can-initial-${i}-${Date.now()}`;
             const colorIndex = Math.floor(Math.random() * config.paintCanColors.length);
             const margin = 150; // Avoid edges
             const x = margin + Math.random() * (window.innerWidth - margin * 2);
             const y = margin + Math.random() * (window.innerHeight - margin * 2);
             initialCans[canId] = {
                id: canId, ownerId: null,
                paintColor: config.paintCanColors[colorIndex],
                paintAmount: config.paintCanInitialAmount,
                x: x, y: y
             };
         }
         initialRoomStateUpdates.availablePaintCans = initialCans;
        // initialRoomStateUpdates.availablePaintCans = {}; // Original empty init
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
        // Send only anchor position. Other presence updates are event-driven.
        // Don't update position if player is lost - prevents moving while waiting to respawn
        const currentPresence = room.presence[room.clientId];
        if (!currentPresence || !currentPresence.lost) {
             room.updatePresence({
                 x: e.clientX,
                 y: e.clientY,
             });
        }
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
                // console.log(`Starting charge for can ${canId}`);
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
                // console.log(`Stopping charge / Releasing burst for can ${canId}`);
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
                    // console.log(`Releasing burst of ${dropletsToBurst} droplets from ${canId}`);

                    for (let i = 0; i < dropletsToBurst; i++) {
                        // Simple unique ID
                        const dropletId = `${room.clientId}-${Date.now()}-${i}`;
                        // Add slight random offset for burst effect
                        const angle = Math.random() * Math.PI * 2;
                        const radius = Math.random() * config.burstSpreadRadius; // Use config for spread
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
                     // console.log(`No accumulated droplets for ${canId}, just stopping charge.`);
                }

                // Send the combined update (stop charge, reset accum, add burst droplets if any)
                room.updateRoomState(updates);
            }
        }
    });

    // Handle keyboard events for throwing
    window.addEventListener('keydown', (e) => {
        keyState[e.key.toLowerCase()] = true; // Store key state

        // Handle throw action immediately on key press
        if (e.key.toLowerCase() === config.paintCanThrowKey) {
             const localPresence = room.presence[room.clientId];
             const roomState = room.roomState;
             const anchorPos = { x: localPresence?.x, y: localPresence?.y }; // Get current anchor

             if (localPresence && roomState && anchorPos.x !== undefined) {
                 // Attempt to handle the throw
                 const { paintCanUpdates, availablePaintCanUpdates, presenceUpdates } = handleThrowPaintCan(
                    room.clientId,
                    localPresence,
                    roomState,
                    anchorPos
                 );

                 // Send updates if throw was successful
                 if (Object.keys(presenceUpdates).length > 0) {
                     room.updatePresence(presenceUpdates);
                 }
                 const roomUpdates = {};
                  if (Object.keys(paintCanUpdates).length > 0) roomUpdates.paintCans = paintCanUpdates;
                  if (Object.keys(availablePaintCanUpdates).length > 0) roomUpdates.availablePaintCans = availablePaintCanUpdates;
                 if (Object.keys(roomUpdates).length > 0) {
                     room.updateRoomState(roomUpdates);
                 }
             }
        }
    });
    window.addEventListener('keyup', (e) => {
         keyState[e.key.toLowerCase()] = false;
    });


    // Initial presence update with a default color and new state fields
    room.updatePresence({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        color: config.defaultPlayerColor || '#FFFFFF', // Base player color
        paintedData: {}, // Initialize empty painted data
        currentCanId: null, // Initialize with no paint can
        lost: false // Initialize with not lost state
    });

    // Setup presence subscription for handling disconnections
    room.subscribePresence((presence) => {
        // This subscription mainly handles making cans available when players leave.
        // Other presence changes are handled reactively in the game loop or scoreboard.
        const currentPeers = new Set(Object.keys(room.peers));
        const localClientId = room.clientId;
        const paintCans = room.roomState.paintCans || {};
        let ownedCansToRemove = {};
        let availableCansToAdd = {};

        // Check for players who were present before but are not now
        // Iterate over previous presence keys if needed, or rely on game loop check for simplicity.
        // The game loop approach using previousPeers is sufficient for physics cleanup.
        // For can cleanup, we check all currently owned cans against the current peer list.

        for (const [canId, canState] of Object.entries(paintCans)) {
             // If a can has an owner who is no longer in peers, make it available
             if (canState && canState.ownerId && !currentPeers.has(canState.ownerId)) {
                 console.log(`Player ${canState.ownerId} disconnected or left, making can ${canId} available`);
                 // Create an entry to add to availablePaintCans
                  availableCansToAdd[canId] = {
                     ...canState,
                     ownerId: null, // Mark as unowned
                     // Reset dynamic state
                     vx: null, // Ensure velocity is null when made available this way
                     vy: null,
                     isCharging: false, accumulatedDroplets: 0
                  };
                  // Mark the owned can for removal
                  ownedCansToRemove[canId] = null;
             }
        }

        // Send updates IF this client detects the need (can race condition exist? Yes, but low impact)
        if (Object.keys(availableCansToAdd).length > 0) {
              room.updateRoomState({
                 paintCans: ownedCansToRemove,
                 availablePaintCans: availableCansToAdd
             });
          }
    });

    // Subscribe to presence update requests (e.g., for being forced to drop a can)
    room.subscribePresenceUpdateRequests((updateRequest, fromClientId) => {
        console.log(`Received presence update request from ${fromClientId}:`, updateRequest);
        const localPresence = room.presence[room.clientId];
        if (!localPresence) return; // Shouldn't happen if initialized

        if (updateRequest.type === 'dropCan') {
            // Check if we actually have a can to drop (prevents errors if request is late)
            if (localPresence.currentCanId) {
                console.log(`Processing request: Dropping can ${localPresence.currentCanId}`);
                room.updatePresence({ currentCanId: null });
            } else {
                 console.log(`Processing request: Already have no can.`);
            }
        }
        // Handle other request types here if needed
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