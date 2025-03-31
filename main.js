import { loadDevNotes } from './dev-notes.js';
import { startGameLoop } from './game-loop.js';
import config from 'config';
// Import player state function directly if needed
import { removePlayerPhysicsState } from './playerState.js';
import { initScoreboard } from './scoreboard.js'; // Import scoreboard initializer
// Import interaction handler for throwing (called directly on keypress)
import { handleThrowPaintCan } from './playerInteractions.js';
// Import collision handler helpers (no longer needed here)
// import { checkRectCollision, getPlayerBoundingBox } from './collisionHandler.js'; // REMOVED

export const room = new WebsimSocket();

// Store key state
const keyState = {};

// Initialize multiplayer connection and game state
async function initGame() {
    await room.initialize();

    // Ensure initial room state exists if not already present
    const initialRoomStateUpdates = {};
    if (room.roomState.droplets === undefined) {
        initialRoomStateUpdates.droplets = {};
    }
    if (room.roomState.paintCans === undefined) {
        initialRoomStateUpdates.paintCans = {};
    }
    if (room.roomState.availablePaintCans === undefined) {
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
                x: x, y: y, vx: null, vy: null // Ensure initial cans have null velocity
             };
         }
         initialRoomStateUpdates.availablePaintCans = initialCans;
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
        const currentPresence = room.presence[room.clientId];
        // Only update position if NOT lost
        if (currentPresence && !currentPresence.lost) {
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
        // Can only charge if alive and holding a can
        if (localPresence && !localPresence.lost && localPresence.currentCanId) {
            const canId = localPresence.currentCanId;
            // Check if can still exists and is owned by us (prevent race condition errors)
            const canState = room.roomState.paintCans?.[canId];
             if (canState && canState.ownerId === room.clientId) {
                // console.log(`Starting charge for can ${canId}`);
                // Propose charge state change via roomState
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
        // Can only release burst if alive and holding a can
        // (No check for lost needed here, as burst logic depends on canState which requires ownership)
        if (localPresence && localPresence.currentCanId) {
            const canId = localPresence.currentCanId;
            const canState = room.roomState.paintCans?.[canId];

            // Only proceed if the can exists and is owned by us
            if (canState && canState.ownerId === room.clientId) {
                // console.log(`Stopping charge / Releasing burst for can ${canId}`);
                const dropletsToBurst = canState.accumulatedDroplets || 0;
                // Propose room state changes: stop charging, reset accumulation, add droplets
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
                        const dropletId = `${room.clientId}-${Date.now()}-${i}`;
                        const angle = Math.random() * Math.PI * 2;
                        const radius = Math.random() * config.burstSpreadRadius;
                        burstDroplets[dropletId] = {
                            id: dropletId,
                            ownerId: room.clientId,
                            color: canState.paintColor,
                            x: canX + Math.cos(angle) * radius,
                            y: canY + Math.sin(angle) * radius,
                            createdAt: Date.now()
                        };
                    }
                    updates.droplets = burstDroplets;
                }
                room.updateRoomState(updates);
            }
        }
    });

    // Handle keyboard events for throwing
    window.addEventListener('keydown', (e) => {
        keyState[e.key.toLowerCase()] = true;

        // Handle throw action immediately on key press
        if (e.key.toLowerCase() === config.paintCanThrowKey) {
             const localPresence = room.presence[room.clientId];
             const roomState = room.roomState;
             // Get current anchor position from presence
             const anchorPos = { x: localPresence?.x, y: localPresence?.y };

             // Check if player exists, has presence, anchor data, and is not lost
             if (localPresence && !localPresence.lost && typeof anchorPos.x === 'number') {
                 // Attempt to handle the throw interaction
                 const { paintCanUpdates, availablePaintCanUpdates, presenceUpdates } = handleThrowPaintCan(
                    room.clientId,
                    localPresence,
                    roomState,
                    anchorPos
                 );

                 // Send updates if throw was initiated
                 // Room state updates propose the can movement
                 const roomUpdates = {};
                  if (Object.keys(paintCanUpdates).length > 0) roomUpdates.paintCans = paintCanUpdates;
                  if (Object.keys(availablePaintCanUpdates).length > 0) roomUpdates.availablePaintCans = availablePaintCanUpdates;
                 if (Object.keys(roomUpdates).length > 0) {
                     room.updateRoomState(roomUpdates);
                 }
                 // Presence update immediately sets currentCanId to null
                 if (Object.keys(presenceUpdates).length > 0) {
                     room.updatePresence(presenceUpdates);
                 }
             }
        }
    });
    window.addEventListener('keyup', (e) => {
         keyState[e.key.toLowerCase()] = false;
    });


    // Initial presence update
    room.updatePresence({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        color: config.defaultPlayerColor || '#FFFFFF',
        paintedData: {},
        currentCanId: null,
        lost: false,
        respawnTime: null // Ensure respawnTime is initialized
    });

    // Setup presence subscription for handling disconnections and player loss consequences
    room.subscribePresence((presence) => {
        const currentPeers = new Set(Object.keys(room.peers));
        const localClientId = room.clientId;
        const paintCans = room.roomState.paintCans || {};
        let ownedCansToRemove = {};
        let availableCansToAdd = {};

        // Check for players who have left
        for (const [canId, canState] of Object.entries(paintCans)) {
             if (canState && canState.ownerId && !currentPeers.has(canState.ownerId)) {
                 console.log(`Player ${canState.ownerId} disconnected, making can ${canId} available`);
                  availableCansToAdd[canId] = {
                     ...canState,
                     ownerId: null,
                     vx: null, vy: null, isCharging: false, accumulatedDroplets: 0
                  };
                  ownedCansToRemove[canId] = null;
             }
        }

         // Check if the local player just lost (presence indicates lost, but wasn't lost before)
         // This might be redundant if collisionHandler already handles dropping, but belt-and-suspenders
         const localPlayerPresence = presence[localClientId];
         // We need to compare with previous state, which isn't directly available here.
         // Relying on collisionHandler/gameUpdater sending presence update is better.
         // However, we *can* check if a can is owned by a player marked as 'lost'.
         for (const [canId, canState] of Object.entries(paintCans)) {
              if (canState && canState.ownerId) {
                  const ownerPresence = presence[canState.ownerId];
                  if (ownerPresence && ownerPresence.lost && ownedCansToRemove[canId] === undefined) { // Check if not already marked for removal
                      console.log(`Player ${canState.ownerId} is lost, making owned can ${canId} available`);
                      availableCansToAdd[canId] = {
                          ...canState,
                          ownerId: null,
                          vx: null, vy: null, isCharging: false, accumulatedDroplets: 0
                      };
                      ownedCansToRemove[canId] = null;
                  }
              }
         }


        // Send updates IF this client detects the need
        if (Object.keys(availableCansToAdd).length > 0 || Object.keys(ownedCansToRemove).length > 0) {
              room.updateRoomState({
                 paintCans: ownedCansToRemove, // Contains null entries for removal
                 availablePaintCans: availableCansToAdd
             });
          }
    });

    // Subscribe to presence update requests (e.g., for being forced to drop a can on steal)
    room.subscribePresenceUpdateRequests((updateRequest, fromClientId) => {
        // console.log(`Received presence update request from ${fromClientId}:`, updateRequest);
        const localPresence = room.presence[room.clientId];
        if (!localPresence) return;

        if (updateRequest.type === 'dropCan') {
            // Check if we actually have a can to drop
            if (localPresence.currentCanId) {
                console.log(`Processing request from ${fromClientId}: Dropping can ${localPresence.currentCanId}`);
                // Update presence immediately based on request
                room.updatePresence({ currentCanId: null });
                // Room state update (making can available) should be handled by the *requester* (stealer)
            } else {
                 // console.log(`Processing request: Already have no can.`);
            }
        }
    });


    // Subscribe to room state changes (optional, for debugging)
    // room.subscribeRoomState((currentRoomState) => {
    //     // console.log("Room state updated:", currentRoomState);
    // });

    // Start rendering loop, passing the room instance
    startGameLoop(room);

    // Initialize the scoreboard AFTER the room is ready and loop is starting
    initScoreboard(room);
}

// Initialize the app
loadDevNotes();
initGame().catch(console.error);