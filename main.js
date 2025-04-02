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
// Import scoreboard initializer with persistence instead of regular initializer
import { initScoreboardWithPersistence } from './scoreboard-init.js'; 
// Import level manager initializer + helper + level data + palette getter
import { initializeLevelManager, getLowestClientId, allLevels, getCurrentPalette } from './level-manager.js';
// Import burst handler for manual burst
import { handleManualBurst } from './burst-handler.js';
// Import respawn helper for manual rejoin
import { triggerManualRespawn } from './respawn-manager.js';
// Import spectate helper for entering mode
import { enterSpectateMode } from './spectate-mode.js';
// Import debug utilities
import { exposeDebugUtils } from './debug-utils.js';
// Import notification manager
import { addNotification } from './notification-manager.js';
// Import notification broadcaster
import { broadcastNotification, handleNotificationRequest } from './notification-broadcaster.js';
// Import instructions initializer and toggle
import { initializeInstructions, toggleInstructions } from './instructions/instructions.js';
// Import local state manager for idle timer
import { updateIdleState, resetIdleTimer, getLastKnownPosition } from './local-state.js';
import { renderScene } from './renderer.js';
// Import loading screen functions
import { initializeLoadingScreen, hideLoadingScreen } from './loading-screen.js';

export const room = new WebsimSocket();

// Initialize multiplayer connection and game state
async function initGame() {
    // Show loading screen immediately
    initializeLoadingScreen();
    
    // Apply WebSocket monitoring immediately to catch early connections
    if (typeof WebSocketMonitor !== 'undefined') {
        WebSocketMonitor.applyScrollbarFix();
    }
    
    await room.initialize();
    initializeLevelManager(room); // Load the level data and pass room instance
    initializeInstructions(room); // Initialize the instructions UI, passing the room

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
        // Get the palette set during level manager initialization
        const currentPalette = getCurrentPalette(); // Get the current palette

        if (currentPalette && currentPalette.paint1 && currentPalette.paint2) {
            for (let i = 0; i < (config.initialAvailableCans || 2); i++) {
                const canId = `can-initial-${i}-${Date.now()}`;
                // Randomly choose one of the two paint colors from the current palette
                const paintColor = Math.random() < 0.5 ? currentPalette.paint1 : currentPalette.paint2;
                const margin = 150; // Avoid edges
                // Spawn within defined game area
                const x = margin + Math.random() * (config.gameAreaWidth - margin * 2);
                const y = margin + Math.random() * (config.gameAreaHeight - margin * 2);
                initialCans[canId] = {
                    id: canId, ownerId: null,
                    paintColor: paintColor, // Use selected palette color
                    paintAmount: config.paintCanInitialAmount,
                    x: x, y: y, isMega: false // Ensure isMega defaults to false
                };
            }
        } else {
            console.warn("Cannot initialize cans: Current palette or paint colors are missing.");
            // Don't add initial cans if palette isn't ready
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
        // Select a random initial level
        const initialLevelIndex = Math.floor(Math.random() * allLevels.length);
        const initialLevel = allLevels[initialLevelIndex];
        initialRoomStateUpdates.currentLevelId = initialLevel.id;
        initialRoomStateUpdates.nextLevelChangeTime = Date.now() + config.levelCycleTime;
        console.log(`Host initializing level randomly to ${initialRoomStateUpdates.currentLevelId}, next change at ${new Date(initialRoomStateUpdates.nextLevelChangeTime).toLocaleTimeString()}`);
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
                // Select a random initial level when claiming host via movement
                const initialLevelIndex = Math.floor(Math.random() * allLevels.length);
                const initialLevel = allLevels[initialLevelIndex];
                const hostUpdate = {
                    hostClientId: room.clientId,
                    currentLevelId: initialLevel.id, // Use random level
                    nextLevelChangeTime: Date.now() + config.levelCycleTime
                };
                console.log(`Claiming host status on mouse move, initializing level randomly to ${initialLevel.id}.`);
                room.updateRoomState(hostUpdate);
            }
        }
        // --- Calculate Mouse Position Relative to Canvas ---
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;

        // --- Clamp Coordinates to Game Area ---
        const clampedX = Math.max(0, Math.min(config.gameAreaWidth, canvasX));
        const clampedY = Math.max(0, Math.min(config.gameAreaHeight, canvasY));


        // --- Update Presence ---
        // Don't update position if player is lost or spectating
        const currentPresence = room.presence[room.clientId];
        if (!currentPresence || (!currentPresence.lost && !currentPresence.isSpectating)) {
            room.updatePresence({
                x: clampedX,
                y: clampedY,
            });

            // --- Update Idle Timer State using local-state manager ---
            updateIdleState({ x: clampedX, y: clampedY });
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
            // --- Calculate Click Position Relative to Canvas ---
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const canvasX = (e.clientX - rect.left) * scaleX;
            const canvasY = (e.clientY - rect.top) * scaleY;

            // --- Clamp Click Coordinates to Game Area ---
            const clickX = Math.max(0, Math.min(config.gameAreaWidth, canvasX));
            const clickY = Math.max(0, Math.min(config.gameAreaHeight, canvasY));

            console.log(`Click detected while spectating at (${clickX.toFixed(0)}, ${clickY.toFixed(0)}): Respawning player.`);
            const now = Date.now(); // Get current time for animation end time
            // Use triggerManualRespawn, passing the specific click coordinates
            // Note: triggerManualRespawn now also calls toggleInstructions(false)
            const respawnUpdates = triggerManualRespawn(
                localClientId,
                localPresence,
                config.gameAreaWidth,
                config.gameAreaHeight,
                now, // Pass current time
                clickX, // Pass the precise click X
                clickY  // Pass the precise click Y
            );
            // Send the presence update to rejoin the game
            room.updatePresence(respawnUpdates);

            // Send notification
            const username = room.peers[localClientId]?.username || 'Player';
            broadcastNotification(`${username} respawned!`, 'info', 3000);

            // Reset idle timer state immediately upon rejoining
            resetIdleTimer({ x: respawnUpdates.x, y: respawnUpdates.y });
        }
    });

    // Handle mouse down/up for paint charging
    canvas.addEventListener('mousedown', (e) => {
        const localPresence = room.presence[room.clientId];
        // Prevent interaction if lost or spectating
        if (localPresence && localPresence.currentCanId && !localPresence.lost && !localPresence.isSpectating) {
            const canId = localPresence.currentCanId;
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
        const localClientId = room.clientId;
        const localPresence = room.presence[localClientId];
        // Prevent interaction if lost or spectating
        if (localPresence && localPresence.currentCanId && !localPresence.lost && !localPresence.isSpectating) {
            const canId = localPresence.currentCanId;
            const canState = room.roomState.paintCans?.[canId];

            // Only proceed if the can exists, is owned by us
            if (canState && canState.ownerId === localClientId) {

                // --- START: Refactored Manual Burst Logic ---
                // Call the handler function from burst-handler.js
                const burstResult = handleManualBurst(
                    localClientId,
                    canState,
                    localPresence, // Pass current presence for power-up checks
                    Date.now()
                );

                // Combine updates from burst handler
                const roomUpdates = {};
                if (Object.keys(burstResult.paintCanUpdates).length > 0) {
                    roomUpdates.paintCans = { [canId]: burstResult.paintCanUpdates };
                }
                if (Object.keys(burstResult.newDroplets).length > 0) {
                    roomUpdates.droplets = burstResult.newDroplets;
                }

                // Send room state updates (can + droplets)
                if (Object.keys(roomUpdates).length > 0) {
                    room.updateRoomState(roomUpdates);
                }

                // Send presence updates (for consuming power-ups)
                if (Object.keys(burstResult.presenceUpdates).length > 0) {
                    room.updatePresence(burstResult.presenceUpdates);
                }
                // --- END: Refactored Manual Burst Logic ---

            }
        }
        // Also stop charging if mouse is released outside the canvas or if player lost the can meanwhile or started spectating
        const currentlyOwnedCanId = room.presence[room.clientId]?.currentCanId;
        if (currentlyOwnedCanId) {
            const currentCanState = room.roomState.paintCans?.[currentlyOwnedCanId];
            // Only send stop charging if it was actually charging (prevent redundant updates)
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
                // Respawn at the *current* anchor position when using ESC
                // Note: triggerManualRespawn now also calls toggleInstructions(false)
                const respawnUpdates = triggerManualRespawn(
                    localClientId,
                    localPresence,
                    config.gameAreaWidth,
                    config.gameAreaHeight,
                    now // Pass current time
                    // No clickX/clickY provided, will use presence anchor
                );
                room.updatePresence(respawnUpdates);

                // Send notification
                const username = room.peers[localClientId]?.username || 'Player';
                broadcastNotification(`${username} respawned!`, 'info', 3000); // Use broadcast

                // Reset idle timer on rejoin
                resetIdleTimer({ x: respawnUpdates.x, y: respawnUpdates.y });


            } else {
                // --- Enter Spectate Mode ---
                // Note: enterSpectateMode now calls toggleInstructions(true)
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
        isSpectating: true, // Start in spectate mode
        respawnAnimEndTime: null // Initialize respawn animation timer state
    });
    // Set initial known position for idle timer using local-state manager
    resetIdleTimer({ x: initialX, y: initialY });
    // Show instructions initially since starting in spectate mode
    toggleInstructions(true);


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
        } else if (updateRequest.type === 'showNotification') {
            // Handle broadcast notifications
            handleNotificationRequest(updateRequest);
        }
    });

    // Subscribe to room state changes (optional, for debugging or complex logic)
    room.subscribeRoomState((currentRoomState) => {
    });

    // Start rendering loop, passing the room instance
    startGameLoop(room);

    // Initialize the scoreboard AFTER the room is ready and loop is starting
    // Using the persistence version instead of the regular initScoreboard
    initScoreboardWithPersistence(room);

    // Expose debug utilities to the console
    exposeDebugUtils();
    
    // Hide the loading screen once everything is initialized
    hideLoadingScreen();
}

// Initialize the app
loadDevNotes();
initGame().catch(console.error);