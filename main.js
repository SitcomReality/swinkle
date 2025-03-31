import { loadDevNotes } from './dev-notes.js';
import { startGameLoop } from './game-loop.js';
import config from 'config';
// Import player state function directly if needed
import { removePlayerPhysicsState } from './playerState.js';
import { initScoreboard } from './scoreboard.js'; // Import scoreboard initializer
import { initializeLevelManager, getLowestClientId, allLevels } from './level-manager.js'; // Import level manager initializer + helper + level data
// Import the burst droplet helper
import { createBurstDroplets } from './playerInteractions.js';

export const room = new WebsimSocket();

// Initialize multiplayer connection and game state
async function initGame() {
    await room.initialize();
    initializeLevelManager(room); // Load the level data and pass room instance

    // Ensure initial room state exists if not already present
    // Use a single updateRoomState call for efficiency
    const initialRoomStateUpdates = {};
    let initialLevelStateNeeded = false; // Flag to track if level state needs init

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
            // Note: Can physics (vx, vy) are not set here, as they are only relevant when held
            initialCans[canId] = {
                id: canId, ownerId: null,
                paintColor: config.paintCanColors[colorIndex],
                paintAmount: config.paintCanInitialAmount,
                x: x, y: y, isMega: false // Ensure isMega defaults to false
            };
        }
        initialRoomStateUpdates.availablePaintCans = initialCans;
    }
    // Add initial power-ups state if needed
    if (room.roomState.powerUps === undefined) {
        initialRoomStateUpdates.powerUps = {};
    }

    // Check and potentially initialize level state (host responsibility)
    if (room.roomState.hostClientId === undefined || !room.peers[room.roomState.hostClientId]) {
        // No host or current host left, elect new one (lowest ID)
        const newHostId = getLowestClientId(room.peers);
        if (newHostId === room.clientId) { // Only the new host updates state
            initialRoomStateUpdates.hostClientId = newHostId;
            initialLevelStateNeeded = true; // Need to set initial level
            console.log(`Elected self (${room.clientId}) as new host.`);
        }
    } else if (room.roomState.currentLevelId === undefined || room.roomState.nextLevelChangeTime === undefined) {
        // Host exists, but level state is missing (shouldn't happen often, but good recovery)
        if (room.roomState.hostClientId === room.clientId) initialLevelStateNeeded = true;
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
        // Host Election Check on Mouse Move (simple trigger)
        // If no host or host left, the lowest ID client claims host role
        if (room.roomState.hostClientId === undefined || !room.peers[room.roomState.hostClientId]) {
            const currentLowestId = getLowestClientId(room.peers);
            if (currentLowestId === room.clientId) {
                // If this client is now the lowest ID, claim host and initialize level if needed
                const hostUpdate = { hostClientId: room.clientId };
                if (!room.roomState.currentLevelId || !room.roomState.nextLevelChangeTime) {
                    hostUpdate.currentLevelId = allLevels[0].id; // Default to first level
                    hostUpdate.nextLevelChangeTime = Date.now() + config.levelCycleTime;
                }
                room.updateRoomState(hostUpdate);
            }
        }
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

            // Only proceed if the can exists, is owned by us
            if (canState && canState.ownerId === room.clientId) {
                const dropletsToBurst = canState.accumulatedDroplets || 0;
                const updates = {
                    paintCans: {
                        [canId]: {
                            isCharging: false, // Stop charging on mouseup
                            accumulatedDroplets: 0 // Reset accumulation regardless of burst amount
                        }
                    }
                };

                // Use the helper function to create burst droplets
                if (dropletsToBurst > 0) {
                    console.log(`Mouse Up: Releasing burst of ${dropletsToBurst} droplets from ${canId}`);
                    const burstData = createBurstDroplets(room.clientId, canState, dropletsToBurst, Date.now());
                    updates.droplets = burstData; // Add generated droplets to the update
                } else {
                    // console.log(`Mouse Up: No accumulated droplets for ${canId}, just stopping charge.`);
                }

                // Send the combined update (stop charge, reset accum, add burst droplets if any)
                room.updateRoomState(updates);
            }
        }
        // Also stop charging if mouse is released outside the canvas or if player lost the can meanwhile
        // This ensures charging stops even if the initial `if` condition fails
        const currentlyOwnedCanId = room.presence[room.clientId]?.currentCanId;
        if (currentlyOwnedCanId) {
            const currentCanState = room.roomState.paintCans?.[currentlyOwnedCanId];
            // Check if the can is still owned and currently charging
            if (currentCanState && currentCanState.ownerId === room.clientId && currentCanState.isCharging) {
                console.log(`Mouse Up (Fallback): Stopping charge for can ${currentlyOwnedCanId}`);
                room.updateRoomState({
                    paintCans: {
                        [currentlyOwnedCanId]: { isCharging: false }
                        // Don't reset accumulated here, only on successful burst trigger
                    }
                });
            }
        }
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
                    vx: 0, vy: 0, isCharging: false, accumulatedDroplets: 0
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