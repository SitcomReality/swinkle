/**
 * game-loop.js
 * Manages the main rendering cycle of the game. Coordinates updates and rendering.
 * NOTE: This file is getting long. Consider refactoring physics, interactions,
 * or rendering into separate modules if more features are added.
 */
import config from 'config';
// Player facade (keeps imports cleaner)
import { renderPlayer, updatePlayerPhysics, getPlayerPhysicsState, removePlayerPhysicsState } from './player.js';
// Paint Can (attached)
import { renderPaintCan, updatePaintCanPhysics } from './paintCan.js';
// Player Interactions
import { handleCanInteractions, handlePaintCanPickup, handleEmptyPaintCan } from './playerInteractions.js';
// Droplets
import { renderDroplets } from './dropletRenderer.js';
// Collision
import { checkCollisionsWithPlayer } from './collisionHandler.js';
// Effects
import { updateAndRenderEffects, addEffect, clearEffects } from './effectsRenderer.js';
// Thrown Cans (New!)
import { updateThrownCanPhysics } from './thrownCan.js';

let roomInstance = null;
let lastTimestamp = 0; // For calculating delta time
let previousPeers = new Set(); // To track disconnected peers

// UI Element References (initialized in startGameLoop)
let paintIndicatorElement;
let paintIndicatorFillElement;
let paintIndicatorTextElement;

/**
 * Updates the paint level indicator UI element.
 */
function updatePaintLevelIndicator() {
    if (!paintIndicatorElement || !roomInstance) return; // Elements or room not ready

    const localClientId = roomInstance.clientId;
    const presence = roomInstance.presence[localClientId];
    const paintCans = roomInstance.roomState.paintCans || {}; // Owned cans

    // Check owned cans first
    if (presence && !presence.lost && presence.currentCanId && paintCans[presence.currentCanId]) {
        const canState = paintCans[presence.currentCanId];
        const maxAmount = config.paintCanInitialAmount;
        const currentAmount = canState.paintAmount || 0;
        const fillRatio = Math.max(0, Math.min(1, currentAmount / maxAmount));
        const percentage = (fillRatio * 100).toFixed(0);

        paintIndicatorFillElement.style.width = `${fillRatio * 100}%`;
        paintIndicatorFillElement.style.backgroundColor = canState.paintColor || config.dropletColor; // Match can color
        paintIndicatorTextElement.textContent = `${percentage}%`;
        paintIndicatorElement.style.display = 'block'; // Show the indicator
    } else {
        paintIndicatorElement.style.display = 'none'; // Hide if no can or lost
    }
}

/**
 * Simple Axis-Aligned Bounding Box collision check.
 * @param {object} rectA - { left, right, top, bottom }
 * @param {object} rectB - { left, right, top, bottom }
 * @returns {boolean} True if colliding, false otherwise.
 */
function checkRectCollision(rectA, rectB) {
    if (!rectA || !rectB) return false;
    return (
        rectA.left < rectB.right &&
        rectA.right > rectB.left &&
        rectA.top < rectB.bottom &&
        rectA.bottom > rectB.top
    );
}

/**
 * Creates a bounding box for a player based on their physics state.
 * @param {object} physicsState - The player's physics state.
 * @returns {object|null} Bounding box { left, right, top, bottom } or null.
 */
function getPlayerBoundingBox(physicsState) {
    if (!physicsState) return null;
    const bodyWidth = config.playerBodyWidth;
    const bodyHeight = config.playerBodyHeight;
    return {
        left: physicsState.position.x - bodyWidth / 2,
        right: physicsState.position.x + bodyWidth / 2,
        top: physicsState.position.y - bodyHeight / 2,
        bottom: physicsState.position.y + bodyHeight / 2
    };
}

// --- Main Game Loop Function ---
function gameLoop(timestamp) {
    if (!roomInstance) {
        console.error("Room instance not available in game loop.");
        return; // Stop the loop if room is not set
    }

    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return; // Stop if canvas isn't there
    }
    const ctx = canvas.getContext('2d');
    const now = Date.now();
    const localClientId = roomInstance.clientId;

    // --- Delta Time Calculation ---
    if (!lastTimestamp) lastTimestamp = timestamp;
    const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;

    // --- Canvas Resizing ---
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }

    // --- Clear Canvas ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Detect Disconnected Peers ---
    const currentPeerIds = new Set(Object.keys(roomInstance.peers));
    previousPeers.forEach(clientId => {
        if (!currentPeerIds.has(clientId)) {
            removePlayerPhysicsState(clientId); // Uses player facade/module
            // Note: Can ownership release is handled via presence subscription in main.js
            console.log(`Peer ${clientId} disconnected, player physics removed.`);
        }
    });
    previousPeers = currentPeerIds;

    // --- Local Player Respawn Check ---
    let localPresenceUpdates = {}; // Collect presence updates for local player this frame
    const localPresence = roomInstance.presence[localClientId];
    if (localPresence?.lost && localPresence.respawnTime && now >= localPresence.respawnTime) {
        console.log(`Respawning player ${localClientId}`);
        const spawnX = canvas.width / 2;
        const spawnY = canvas.height / 2;
        localPresenceUpdates = {
            lost: false,
            paintedData: {},
            respawnTime: null,
            currentCanId: null,
            x: spawnX,
            y: spawnY
        };
        // Apply respawn updates immediately to presence state used within this frame
        if (roomInstance.presence[localClientId]) {
            Object.assign(roomInstance.presence[localClientId], localPresenceUpdates);
        }
    }

    // --- Batch Update Objects ---
    let allPaintCanUpdates = {}; // Updates for owned cans (physics, interactions)
    let allDropletsToAdd = {};   // New droplets from interactions
    let allAvailablePaintCanUpdates = {}; // Cans becoming available (dropped, thrown, spawned) OR getting updated (thrown physics)
    let allDropletRemovals = {}; // Droplets removed (collision, timeout)
    let presenceRequests = []; // Requests to send to other players (e.g., drop can on steal)

    // --- Update Physics & Interactions Loop ---
    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        if (presence) { // Only update if presence data exists
            // 1. Update Player Physics (Bungee, Limbs)
            updatePlayerPhysics(clientId, presence, deltaTime); // Uses player facade/module

            // Skip interactions/collisions if player is lost
            if (presence.lost) return;

            // Get updated player position for subsequent logic
            const playerPhysicsState = getPlayerPhysicsState(clientId); // Uses player facade/module
            if (!playerPhysicsState) return; // Skip if player physics state isn't ready
            const playerBodyPos = playerPhysicsState.position;

            // 2. Local Client Interactions (Pickup, Empty Can Check)
            //    (Throwing is handled via keypress in main.js)
            if (clientId === localClientId) {
                // Check for empty cans FIRST (so we don't try to interact with it if dropped)
                if (presence.currentCanId) {
                    const canState = roomInstance.roomState.paintCans?.[presence.currentCanId];
                    if (canState) {
                        const { paintCanUpdates: emptyUpdates, presenceUpdates: emptyPresenceUpdates } = handleEmptyPaintCan(
                            localClientId, canState, presence
                        );
                        if (Object.keys(emptyUpdates).length > 0) {
                            // Make it available instead of just nulling
                            const canToMakeAvailable = roomInstance.roomState.paintCans[Object.keys(emptyUpdates)[0]];
                            if (canToMakeAvailable) {
                                allAvailablePaintCanUpdates[canToMakeAvailable.id] = {
                                    ...canToMakeAvailable, ownerId: null, vx: null, vy: null, isCharging: false, accumulatedDroplets: 0
                                };
                                allPaintCanUpdates[canToMakeAvailable.id] = null; // Remove from owned cans
                            }
                            // allPaintCanUpdates = { ...allPaintCanUpdates, ...emptyUpdates }; // Original logic: just remove
                        }
                        if (Object.keys(emptyPresenceUpdates).length > 0) {
                            localPresenceUpdates = { ...localPresenceUpdates, ...emptyPresenceUpdates };
                             // Update local presence cache if can was dropped
                             if (emptyPresenceUpdates.currentCanId === null && roomInstance.presence[localClientId]) {
                                 roomInstance.presence[localClientId].currentCanId = null;
                             }
                        }
                    }
                }

                // Check for paint can pickup (only if not currently holding one AFTER empty check)
                 const currentLocalPresence = roomInstance.presence[localClientId]; // Re-check presence after potential drop
                 if (!currentLocalPresence?.currentCanId) {
                    const availableCans = roomInstance.roomState.availablePaintCans || {};
                    const { paintCanUpdates: pickupUpdates, availablePaintCanUpdates: pickupAvailableUpdates, presenceUpdates: pickupPresenceUpdates } = handlePaintCanPickup(
                        playerBodyPos, localClientId, currentLocalPresence, availableCans
                    );
                    if (Object.keys(pickupUpdates).length > 0) {
                        allPaintCanUpdates = { ...allPaintCanUpdates, ...pickupUpdates };
                    }
                    if (Object.keys(pickupAvailableUpdates).length > 0) {
                        allAvailablePaintCanUpdates = { ...allAvailablePaintCanUpdates, ...pickupAvailableUpdates };
                    }
                    if (Object.keys(pickupPresenceUpdates).length > 0) {
                        localPresenceUpdates = { ...localPresenceUpdates, ...pickupPresenceUpdates };
                         // Update local presence cache if can was picked up
                         if (pickupPresenceUpdates.currentCanId && roomInstance.presence[localClientId]) {
                             roomInstance.presence[localClientId].currentCanId = pickupPresenceUpdates.currentCanId;
                         }
                    }
                }
            } // End local client interactions

            // 3. Update Attached Paint Can Physics & Interactions (Only Owner Updates)
            const currentCanId = presence.currentCanId; // Re-check in case it was dropped/picked up
            if (clientId === localClientId && currentCanId && roomInstance.roomState.paintCans && roomInstance.roomState.paintCans[currentCanId]) {
                const canState = roomInstance.roomState.paintCans[currentCanId];

                // Update Attached Can Physics (Bungee)
                updatePaintCanPhysics(canState, playerBodyPos, deltaTime); // From paintCan.js

                // Add physics updates to the batch (merge with potential previous updates for this can)
                allPaintCanUpdates[currentCanId] = {
                    ...(allPaintCanUpdates[currentCanId] || {}),
                    x: canState.x, y: canState.y, vx: canState.vx, vy: canState.vy // Note: attached cans don't use vx/vy from bungee, but paintCan.js updates them
                };

                // Handle Can Interactions (Charging, Auto-Drop)
                const { paintCanUpdates: interactionUpdates, newDroplets } = handleCanInteractions(
                    localClientId, canState, deltaTime, now // From playerInteractions.js
                );
                if (Object.keys(interactionUpdates).length > 0) {
                    allPaintCanUpdates[currentCanId] = { ...allPaintCanUpdates[currentCanId], ...interactionUpdates };
                }
                if (Object.keys(newDroplets).length > 0) {
                    allDropletsToAdd = { ...allDropletsToAdd, ...newDroplets };
                }
            } // End attached can update
        } // End if(presence)
    }); // End peer loop for physics/interactions


    // --- Update Thrown Can Physics ---
    const availableCans = roomInstance.roomState.availablePaintCans || {};
    Object.entries(availableCans).forEach(([canId, canState]) => {
        // Check if it's a thrown can (has velocity properties)
        if (canState && typeof canState.vx === 'number' && typeof canState.vy === 'number') {
            const restUpdate = updateThrownCanPhysics(canState, deltaTime, canvas.width, canvas.height); // From thrownCan.js

            // Add physics position updates to the batch for this available can
            allAvailablePaintCanUpdates[canId] = {
                ...(allAvailablePaintCanUpdates[canId] || {}), // Keep potential spawn/throw updates
                x: canState.x,
                y: canState.y,
                vx: canState.vx, // Keep potentially modified velocity
                vy: canState.vy
            };

            // If can came to rest, add update to remove velocity properties
            if (restUpdate) {
                allAvailablePaintCanUpdates[canId] = {
                     ...allAvailablePaintCanUpdates[canId],
                     ...restUpdate // { vx: null, vy: null }
                 };
            }
        }
    });


    // --- Handle Player-Player Collisions (Stealing) - Local Client Only ---
    const localPlayerPhysics = getPlayerPhysicsState(localClientId);
    const localPlayerBox = getPlayerBoundingBox(localPlayerPhysics);
    const localPresenceForCollision = roomInstance.presence[localClientId]; // Use potentially updated presence

    if (localPlayerBox && localPresenceForCollision && !localPresenceForCollision.lost && !localPresenceForCollision.currentCanId) {
        Object.entries(roomInstance.peers).forEach(([otherClientId, otherPeer]) => {
            if (otherClientId === localClientId) return;
            const otherPresence = roomInstance.presence[otherClientId];
            if (!otherPresence || otherPresence.lost) return;

            const canIdToSteal = otherPresence.currentCanId;
            if (canIdToSteal && roomInstance.roomState.paintCans?.[canIdToSteal]) {
                const otherPlayerPhysics = getPlayerPhysicsState(otherClientId);
                const otherPlayerBox = getPlayerBoundingBox(otherPlayerPhysics);

                if (checkRectCollision(localPlayerBox, otherPlayerBox)) {
                    console.log(`Player ${localClientId} collided with ${otherClientId}. Attempting steal of can ${canIdToSteal}!`);
                    if (localPresenceUpdates.currentCanId === canIdToSteal) return; // Already stealing it this frame

                    // 1. Update local presence
                    localPresenceUpdates.currentCanId = canIdToSteal;
                    if (roomInstance.presence[localClientId]) roomInstance.presence[localClientId].currentCanId = canIdToSteal; // Update cache

                    // 2. Request other player drops can
                    presenceRequests.push({ targetId: otherClientId, update: { type: 'dropCan' } });

                    // 3. Update can ownership in roomState (move from owned to owned by local player)
                    // First, mark the original owned can for removal (or update if already being updated)
                    allPaintCanUpdates[canIdToSteal] = {
                        ...(allPaintCanUpdates[canIdToSteal] || {}), // Keep other updates? No, overwrite/remove old owner's intent
                         ownerId: localClientId, // New owner
                         vx: null, // Reset physics/state on steal
                         vy: null,
                         isCharging: false,
                         accumulatedDroplets: 0
                    };
                     // Note: This relies on the update merging logic; we add the can to the owned 'paintCans' state
                     // The other player's 'dropCan' request ensures their presence updates.


                    // 4. Visual Effect
                    addEffect('stealSpark', { x: localPlayerPhysics.position.x, y: localPlayerPhysics.position.y });
                    return; // Exit inner loop
                }
            }
        });
    }

    // --- Spawn new paint cans randomly ---
    if (Math.random() < (0.005 * deltaTime * 60)) {
        const currentAvailableCans = roomInstance.roomState.availablePaintCans || {};
        const numAvailable = Object.values(currentAvailableCans).filter(can => can !== null).length;
        if (numAvailable < config.maxAvailableCans) {
            const canId = `can-${Math.random().toString(36).substring(2, 9)}-${now}`;
            const colorIndex = Math.floor(Math.random() * config.paintCanColors.length);
            const margin = 100;
            const x = margin + Math.random() * (canvas.width - margin * 2);
            const y = margin + Math.random() * (canvas.height - margin * 2);
            allAvailablePaintCanUpdates[canId] = {
                id: canId, ownerId: null,
                paintColor: config.paintCanColors[colorIndex],
                paintAmount: config.paintCanInitialAmount,
                x: x, y: y, vx: null, vy: null // Ensure spawned cans have null velocity
            };
            // console.log(`Spawning can ${canId}`);
        }
    }

    // --- Droplet Collision Check (Local Player) ---
    if (localPlayerPhysics && localPresenceForCollision && !localPresenceForCollision.lost) {
        const { dropletsToRemove: collidedDroplets, collisionPoints } = checkCollisionsWithPlayer(
            localPlayerPhysics.position,
            roomInstance.roomState.droplets || {},
            localClientId,
            localPresenceForCollision,
            now
        );
        if (Object.keys(collidedDroplets).length > 0) {
             allDropletRemovals = { ...allDropletRemovals, ...collidedDroplets };
        }
        collisionPoints.forEach(point => addEffect('splat', { x: point.x, y: point.y, color: point.color }));
    }

    // --- Check for Expired Droplets ---
    const currentDroplets = roomInstance.roomState.droplets || {};
    const dropletDuration = config.dropletDuration || 2000;
    Object.entries(currentDroplets).forEach(([id, droplet]) => {
        if (!droplet || allDropletRemovals[id] === null) return;
        if (now - droplet.createdAt > dropletDuration) {
            allDropletRemovals[id] = null;
        }
    });

    // --- Send Batched Updates ---
    // Room State Updates (Merge all collected updates)
    const roomStateUpdates = {};
    if (Object.keys(allPaintCanUpdates).length > 0) roomStateUpdates.paintCans = allPaintCanUpdates;
    if (Object.keys(allAvailablePaintCanUpdates).length > 0) roomStateUpdates.availablePaintCans = allAvailablePaintCanUpdates;
    // Merge droplet additions and removals carefully
    if (Object.keys(allDropletsToAdd).length > 0 || Object.keys(allDropletRemovals).length > 0) {
        roomStateUpdates.droplets = { ...(allDropletsToAdd || {}), ...(allDropletRemovals || {}) };
    }
    if (Object.keys(roomStateUpdates).length > 0) {
        roomInstance.updateRoomState(roomStateUpdates);
    }

    // Local Presence Updates (Respawn, Pickup, Empty Drop, Steal Success)
    if (Object.keys(localPresenceUpdates).length > 0) {
        roomInstance.updatePresence(localPresenceUpdates);
    }

    // Presence Update Requests (Steal Requests)
    presenceRequests.forEach(req => roomInstance.requestPresenceUpdate(req.targetId, req.update));

    // --- Render Scene ---
    updateAndRenderEffects(ctx, deltaTime, now); // From effectsRenderer.js

    const dropletsToRender = roomInstance.roomState.droplets || {};
    renderDroplets(ctx, dropletsToRender, now); // From dropletRenderer.js

    const availableCansToRender = roomInstance.roomState.availablePaintCans || {};
    Object.values(availableCansToRender).forEach(canState => {
        if (canState) {
            renderPaintCan(ctx, canState); // From paintCan.js (handles static & thrown)
        }
    });

    const ownedCansToRender = roomInstance.roomState.paintCans || {};
    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        // Pass owned cans state; renderPlayer handles bungee and rendering the specific held can
        renderPlayer(ctx, clientId, localClientId, presence, peer, ownedCansToRender); // From playerRenderer.js
    });

    // --- Update UI Elements ---
    updatePaintLevelIndicator();

    requestAnimationFrame(gameLoop);
}

/**
 * Initializes and starts the game loop.
 * @param {object} room - The WebsimSocket room instance.
 */
export function startGameLoop(room) {
    if (!room) {
        throw new Error("startGameLoop requires a valid room instance.");
    }
    roomInstance = room;
    console.log("Starting game loop...");

    // Get UI element references ONCE after DOM is ready
    paintIndicatorElement = document.getElementById('paint-level-indicator');
    if (paintIndicatorElement) {
        paintIndicatorFillElement = paintIndicatorElement.querySelector('.indicator-bar-fill');
        paintIndicatorTextElement = paintIndicatorElement.querySelector('.indicator-text');
        if (!paintIndicatorFillElement || !paintIndicatorTextElement) {
             console.error("Paint level indicator elements not found!");
             paintIndicatorElement = null; // Disable if children are missing
        }
    } else {
         console.error("Paint level indicator container not found!");
    }

    lastTimestamp = 0;
    previousPeers = new Set(Object.keys(room.peers || {}));
    clearEffects(); // Clear any lingering effects from previous session
    requestAnimationFrame(gameLoop);
}