/**
 * main.js
 * Entry point for the application. Initializes the room, sets up event listeners,
 * and starts the game loop.
 */
import { loadDevNotes } from './dev-notes.js';
import { startGameLoop } from './game-loop.js';
import config from 'config';
// Import player state function directly if needed
import { removePlayerPhysicsState } from './playerState.js';
import { initScoreboard } from './scoreboard.js'; // Import scoreboard initializer
import { initializeLevelManager, getLowestClientId, allLevels } from './level-manager.js'; // Import level manager initializer + helper + level data
// Import the burst droplet helper
import { createBurstDroplets } from './playerInteractions.js';
// Import respawn helper for manual rejoin
import { triggerManualRespawn } from './respawn-manager.js';
// Import spectate helper for entering mode
import { enterSpectateMode } from './spectate-mode.js';
// Import debug utilities
import { exposeDebugUtils } from './debug-utils.js';
// Import notification manager
import { addNotification } from './notification-manager.js';

export const room = new WebsimSocket();

// --- State for Idle Timer ---
let lastSignificantMoveTime = Date.now();
let lastKnownPosition = { x: 0, y: 0 }; // Initialize to prevent immediate idle on load

// Export a getter for the game loop to check the idle time
export function getLastSignificantMoveTime() {
    return lastSignificantMoveTime;
}
// ---------------------------

// Initialize multiplayer connection and game state
async function initGame() {
    await room.initialize();
    initializeLevelManager(room); // Load the level data and pass room instance

    // Ensure initial room state exists if not already present
    // Use a single updateRoomState call for efficiency
    const initialRoomStateUpdates = {};
    let hostNeedsToInitialize = false;

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
            // Spawn within defined game area
            const x = margin + Math.random() * (config.gameAreaWidth - margin * 2);
            const y = margin + Math.random() * (config.gameAreaHeight - margin * 2);
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
            hostNeedsToInitialize = true; // Need to set initial level/time
            console.log(`Elected self (${room.clientId}) as new host.`);
        }
    } else if (room.clientId === room.roomState.hostClientId) {
        // Host exists and it's me, check if level state is missing
        if (room.roomState.currentLevelId === undefined || room.roomState.nextLevelChangeTime === undefined) {
            console.log("Host found level state missing, initializing...");
            hostNeedsToInitialize = true;
        }
    }

    // If this client is the host and needs to initialize level state
    if (hostNeedsToInitialize) {
        initialRoomStateUpdates.currentLevelId = allLevels[0].id; // Default to first level
        initialRoomStateUpdates.nextLevelChangeTime = Date.now() + config.levelCycleTime;
        console.log(`Host initializing level to ${initialRoomStateUpdates.currentLevelId}, next change at ${new Date(initialRoomStateUpdates.nextLevelChangeTime).toLocaleTimeString()}`);
    }

    if (Object.keys(initialRoomStateUpdates).length > 0) {
        console.log("Initializing/Updating room state:", initialRoomStateUpdates);
        room.updateRoomState(initialRoomStateUpdates);
    }

    // Track mouse movement for player presence (anchor point)
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    canvas.addEventListener('mousemove', (e) => {
        // Re-check host election on mouse move (simple trigger)
        // If no host or host left, the lowest ID client claims host role
        if (room.roomState.hostClientId === undefined || !room.peers[room.roomState.hostClientId]) {
            const currentLowestId = getLowestClientId(room.peers);
            if (currentLowestId === room.clientId) {
                // If this client is now the lowest ID, claim host and initialize level state
                const hostUpdate = {
                    hostClientId: room.clientId,
                    currentLevelId: allLevels[0].id, // Default to first level
                    nextLevelChangeTime: Date.now() + config.levelCycleTime
                };
                console.log(`Claiming host status on mouse move, initializing level.`);
                room.updateRoomState(hostUpdate);
            }
        }
        // --- Calculate Mouse Position Relative to Canvas ---
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;   // Verhältnis der tatsächlichen Canvas-Breite zur angezeigten Breite
        const scaleY = canvas.height / rect.height; // Verhältnis der tatsächlichen Canvas-Höhe zur angezeigten Höhe

        // Calculate mouse coordinates relative to the canvas element
        // Adjusting for potential CSS scaling or borders might be needed if complex styling is applied
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;

        // --- Clamp Coordinates to Game Area ---
        // Clamp the canvas-relative coordinates to the defined game area
        const clampedX = Math.max(0, Math.min(config.gameAreaWidth, canvasX));
        const clampedY = Math.max(0, Math.min(config.gameAreaHeight, canvasY));


        // --- Update Presence ---
        // Send only anchor position. Other presence updates are event-driven.
        // Don't update position if player is lost or spectating - prevents moving while waiting to respawn/or spectating
        const currentPresence = room.presence[room.clientId];
        if (!currentPresence || (!currentPresence.lost && !currentPresence.isSpectating)) {
            room.updatePresence({
                x: clampedX,
                y: clampedY,
            });

            // --- Update Idle Timer State ---
            const dx = clampedX - lastKnownPosition.x;
            const dy = clampedY - lastKnownPosition.y;
            const distSq = dx*dx + dy*dy;
            if (distSq > config.idleMoveThresholdSq) {
                lastSignificantMoveTime = Date.now();
                lastKnownPosition = { x: clampedX, y: clampedY };
            }
            // ---------------------------
        }
    });

    // Handle clicks for respawning from spectator mode
    canvas.addEventListener('click', (e) => {
        // Default click action disabled, handled by mousedown/up for charging/burst
        const localClientId = room.clientId;
        const localPresence = room.presence[localClientId];

        // Check if player is spectating
        if (localPresence && localPresence.isSpectating) {
            console.log("Click detected while spectating: Respawning player.");
            const now = Date.now(); // Get current time for animation end time
            // Use triggerManualRespawn to get the correct presence update object
            const respawnUpdates = triggerManualRespawn(
                localClientId,
                localPresence,
                config.gameAreaWidth,
                config.gameAreaHeight,
                now // Pass current time
            );
            // Send the presence update to rejoin the game
            room.updatePresence(respawnUpdates);

            // Send notification
            const username = room.peers[localClientId]?.username || 'Player';
            addNotification(`${username} respawned!`, 'info', 3000);

            // Reset idle timer state immediately upon rejoining
            lastSignificantMoveTime = Date.now();
            lastKnownPosition = { x: respawnUpdates.x, y: respawnUpdates.y };
        }
    });

    // Handle mouse down/up for paint charging
    canvas.addEventListener('mousedown', (e) => {
        const localPresence = room.presence[room.clientId];
        // Prevent interaction if lost or spectating
        if (localPresence && localPresence.currentCanId && !localPresence.lost && !localPresence.isSpectating) {
            const canId = localPresence.currentCanId;
            // Check if can still exists and is owned by us (prevent race condition errors)
            const canState = room.roomState.paintCans?.[canId];
            if (canState && canState.ownerId === room.clientId) {
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
        // Don't burst if lost or spectating, even if mouseup happens after loss/spectate start
        if (localPresence && localPresence.currentCanId && !localPresence.lost && !localPresence.isSpectating) {
            const canId = localPresence.currentCanId;
            const canState = room.roomState.paintCans?.[canId];

            // Only proceed if the can exists, is owned by us
            if (canState && canState.ownerId === room.clientId) {
                const dropletsToBurst = canState.accumulatedDroplets || 0;
                const updates = {
                    paintCans: {
                        [canId]: {
                            isCharging: false, 
                            accumulatedDroplets: 0 
                        }
                    }
                };

                // Use the helper function to create burst droplets
                if (dropletsToBurst > 0) {
                    console.log(`Mouse Up: Releasing burst of ${dropletsToBurst} droplets from ${canId}`);
                    const burstData = createBurstDroplets(room.clientId, canState, dropletsToBurst, Date.now());
                    updates.droplets = burstData; 
                } 

                // Send the combined update (stop charge, reset accum, add burst droplets if any)
                room.updateRoomState(updates);
            }
        }
        // Also stop charging if mouse is released outside the canvas or if player lost the can meanwhile or started spectating
        const currentlyOwnedCanId = room.presence[room.clientId]?.currentCanId;
        if (currentlyOwnedCanId) {
            const currentCanState = room.roomState.paintCans?.[currentlyOwnedCanId];
            // Check if the can is still owned and currently charging
            if (currentCanState && currentCanState.ownerId === room.clientId && currentCanState.isCharging) {
                room.updateRoomState({
                    paintCans: {
                        [currentlyOwnedCanId]: { isCharging: false }
                    }
                });
            }
        }
    });

    // --- Global Key Listener for Spectate Toggle ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const localClientId = room.clientId;
            const localPresence = room.presence[localClientId];
            if (!localPresence) return; 

            if (localPresence.isSpectating) {
                // --- Leave Spectate Mode ---
                console.log("ESC pressed: Leaving spectate mode.");
                const now = Date.now(); // Get current time for animation end time
                const respawnUpdates = triggerManualRespawn(
                    localClientId,
                    localPresence, 
                    config.gameAreaWidth,
                    config.gameAreaHeight,
                    now // Pass current time
                );
                room.updatePresence(respawnUpdates);

                // Send notification
                const username = room.peers[localClientId]?.username || 'Player';
                addNotification(`${username} respawned!`, 'info', 3000);

                // Reset idle timer on rejoin
                lastSignificantMoveTime = Date.now();
                lastKnownPosition = { x: respawnUpdates.x, y: respawnUpdates.y };


            } else {
                // --- Enter Spectate Mode ---
                enterSpectateMode(localClientId, room);
            }
        }
    });

    // Initial presence update with a default color and new state fields
    // Spawn player in the middle of the defined game area
    const initialX = config.gameAreaWidth / 2;
    const initialY = config.gameAreaHeight / 2;
    room.updatePresence({
        x: initialX,
        y: initialY,
        color: config.defaultPlayerColor || '#FFFFFF', 
        paintedData: {}, 
        currentCanId: null, 
        lost: false, 
        score: 0, 
        isSpectating: true, 
        respawnAnimEndTime: null // Initialize respawn animation timer state
    });
    // Set initial known position for idle timer
    lastKnownPosition = { x: initialX, y: initialY };
    lastSignificantMoveTime = Date.now();


    // Subscribe to presence update requests (e.g., for being forced to drop a can)
    room.subscribePresenceUpdateRequests((updateRequest, fromClientId) => {
        const localClientId = room.clientId;
        const localPresence = room.presence[localClientId];
        if (!localPresence) return; 

        if (updateRequest.type === 'dropCan') {
            if (localPresence.currentCanId) {
                room.updatePresence({ currentCanId: null });
            } else {
            }
        } else if (updateRequest.type === 'incrementScore') {
            const currentScore = localPresence.score || 0;
            const amount = updateRequest.amount || 1;
            room.updatePresence({
                score: currentScore + amount
            });
        }
    });

    // Subscribe to room state changes (optional, for debugging or complex logic)
    room.subscribeRoomState((currentRoomState) => {
    });

    // Start rendering loop, passing the room instance
    startGameLoop(room);

    // Initialize the scoreboard AFTER the room is ready and loop is starting
    initScoreboard(room);

    // Expose debug utilities to the console
    exposeDebugUtils();
}

// Initialize the app
loadDevNotes();
initGame().catch(console.error);