/**
 * gameUpdater.js
 * Handles the core logic for updating the game state each frame,
 * including physics, interactions, collisions, spawning, and preparing state updates.
 */
import config from 'config';
import { room } from './main.js'; // Import room to access state directly where needed (e.g., collision)

// Player facade
import { updatePlayerPhysics, getPlayerPhysicsState } from './player.js';
// Paint Can (attached)
import { updatePaintCanPhysics } from './paintCan.js';
// Player Interactions
import { handleCanInteractions, handlePaintCanPickup, handleEmptyPaintCan, handleThrowPaintCan } from './playerInteractions.js';
// Collision
import { checkCollisionsWithPlayer, checkRectCollision, getPlayerBoundingBox } from './collisionHandler.js';
// Thrown Cans
import { updateThrownCanPhysics } from './thrownCan.js';
// Effects (needed for adding effects during updates)
import { addEffect } from './effectsRenderer.js';

/**
 * Updates the entire game state based on the elapsed time.
 * Calculates physics, handles interactions, checks collisions, spawns items,
 * and determines necessary state updates.
 *
 * @param {object} roomInstance - The WebsimSocket room instance.
 * @param {number} deltaTime - Time elapsed since the last frame in seconds.
 * @param {number} now - The current timestamp (Date.now()).
 * @param {object} canvas - The game canvas element (for dimensions).
 * @param {string} localClientId - The ID of the local client.
 * @returns {{
 *   roomStateUpdates: object, // Updates intended for room.updateRoomState
 *   localPresenceUpdates: object, // Non-pickup/steal updates for room.updatePresence
 *   presenceRequests: Array<object>, // Requests for room.requestPresenceUpdate
 *   pickupAttempt: { canId: string | null }, // Info about a pickup attempt this frame
 *   stealAttempt: { canId: string | null } // Info about a steal attempt this frame
 * }} - Collected state changes and interaction attempts.
 */
export function updateGameState(roomInstance, deltaTime, now, canvas, localClientId) {
    // --- Batch Update Objects ---
    let allPaintCanUpdates = {}; // Updates for owned cans (physics, interactions) - `roomState.paintCans`
    let allAvailablePaintCanUpdates = {}; // Cans becoming available/updated (dropped, thrown, spawned) - `roomState.availablePaintCans`
    let allDropletsToAdd = {};   // New droplets from interactions - `roomState.droplets`
    let allDropletRemovals = {}; // Droplets removed (collision, timeout) - `roomState.droplets`
    let localPresenceUpdates = {}; // Collect NON-PICKUP/STEAL presence updates for local player this frame
    let presenceRequests = []; // Requests to send to other players (e.g., drop can on steal)
    let pickupAttempt = { canId: null }; // Track if local client attempted pickup this frame
    let stealAttempt = { canId: null };  // Track if local client attempted steal this frame


    // --- Local Player Respawn Check ---
    const localPresence = roomInstance.presence[localClientId];
    if (localPresence?.lost && localPresence.respawnTime && now >= localPresence.respawnTime) {
        console.log(`Respawning player ${localClientId}`);
        const spawnX = canvas.width / 2;
        const spawnY = canvas.height / 2;
        // These updates are safe for immediate presence update
        localPresenceUpdates = {
            lost: false,
            paintedData: {},
            respawnTime: null,
            // currentCanId: null, // Explicitly null in respawn
            x: spawnX,
            y: spawnY
        };
        // Apply respawn updates immediately to local presence cache used within this frame
        if (roomInstance.presence[localClientId]) {
            Object.assign(roomInstance.presence[localClientId], localPresenceUpdates);
             // Ensure can is dropped visually/logically immediately on respawn too
             if (roomInstance.presence[localClientId].currentCanId) {
                 roomInstance.presence[localClientId].currentCanId = null;
                 localPresenceUpdates.currentCanId = null; // Add to immediate update
             }
        }
    }


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
            //    (Throwing is handled via keypress in main.js, which calls handleThrowPaintCan)
            if (clientId === localClientId) {
                const currentLocalPresence = roomInstance.presence[localClientId]; // Use potentially updated presence
                const currentOwnedCans = roomInstance.roomState.paintCans || {};

                // Check for empty cans FIRST (so we don't try to interact with it if dropped)
                if (currentLocalPresence?.currentCanId) {
                    const canState = currentOwnedCans[currentLocalPresence.currentCanId];
                    if (canState) {
                        const { paintCanUpdates: emptyOwnedUpdates, availablePaintCanUpdates: emptyAvailableUpdates, presenceUpdates: emptyPresenceUpdates } = handleEmptyPaintCan(
                            localClientId, canState, currentLocalPresence
                        );
                        if (Object.keys(emptyOwnedUpdates).length > 0) {
                            allPaintCanUpdates = { ...allPaintCanUpdates, ...emptyOwnedUpdates };
                        }
                        if (Object.keys(emptyAvailableUpdates).length > 0) {
                            allAvailablePaintCanUpdates = { ...allAvailablePaintCanUpdates, ...emptyAvailableUpdates };
                        }
                        if (Object.keys(emptyPresenceUpdates).length > 0) {
                            // This is a presence update NOT related to pickup/steal confirmation, so apply directly
                            localPresenceUpdates = { ...localPresenceUpdates, ...emptyPresenceUpdates };
                             // Update local presence cache if can was dropped
                             if (emptyPresenceUpdates.currentCanId === null && roomInstance.presence[localClientId]) {
                                 roomInstance.presence[localClientId].currentCanId = null;
                             }
                        }
                    }
                }

                // Check for paint can pickup (only if not currently holding one AFTER empty check)
                 const presenceAfterEmptyCheck = roomInstance.presence[localClientId]; // Re-check presence after potential drop
                 if (!presenceAfterEmptyCheck?.currentCanId) {
                    const availableCans = roomInstance.roomState.availablePaintCans || {};
                    // handlePaintCanPickup proposes room state changes
                    const { paintCanUpdates: pickupOwnedUpdates, availablePaintCanUpdates: pickupAvailableUpdates, presenceUpdates: pickupPresenceIntent } = handlePaintCanPickup(
                        playerBodyPos, localClientId, presenceAfterEmptyCheck, availableCans
                    );
                    if (Object.keys(pickupOwnedUpdates).length > 0) {
                        allPaintCanUpdates = { ...allPaintCanUpdates, ...pickupOwnedUpdates };
                    }
                    if (Object.keys(pickupAvailableUpdates).length > 0) {
                        allAvailablePaintCanUpdates = { ...allAvailablePaintCanUpdates, ...pickupAvailableUpdates };
                    }
                    // If a pickup was initiated, record the intent locally
                    if (pickupPresenceIntent.currentCanId) {
                         pickupAttempt.canId = pickupPresenceIntent.currentCanId;
                         // DO NOT update localPresenceUpdates here yet
                    }
                }
            } // End local client interactions

            // 3. Update Attached Paint Can Physics & Interactions (Only Owner Updates)
            const currentCanId = presence.currentCanId; // Re-check in case it was dropped/picked up
            // Only allow owner (local client) to run physics/interactions for attached cans
            if (clientId === localClientId && currentCanId && roomInstance.roomState.paintCans && roomInstance.roomState.paintCans[currentCanId]) {
                const canState = roomInstance.roomState.paintCans[currentCanId];

                 // Ensure the canState still belongs to this client (might have changed due to steal resolution last frame)
                 if (canState.ownerId === localClientId) {
                    // Update Attached Can Physics (Bungee)
                    updatePaintCanPhysics(canState, playerBodyPos, deltaTime); // From paintCan.js

                    // Add physics updates to the batch (merge with potential previous updates for this can)
                    allPaintCanUpdates[currentCanId] = {
                        ...(allPaintCanUpdates[currentCanId] || {}),
                        x: canState.x, y: canState.y, vx: canState.vx, vy: canState.vy
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
                 } else {
                      // Discrepancy detected: Presence says holding can, but roomState says someone else owns it (likely lost steal)
                      // Force drop the can in presence
                       console.warn(`Client ${localClientId} presence holding can ${currentCanId}, but owner is ${canState.ownerId}. Forcing drop.`);
                       localPresenceUpdates = { ...localPresenceUpdates, currentCanId: null };
                       if (roomInstance.presence[localClientId]) {
                            roomInstance.presence[localClientId].currentCanId = null;
                       }
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

    // Can only steal if alive and NOT holding a can (or attempting pickup)
    if (localPlayerBox && localPresenceForCollision && !localPresenceForCollision.lost && !localPresenceForCollision.currentCanId && !pickupAttempt.canId) {
        Object.entries(roomInstance.peers).forEach(([otherClientId, otherPeer]) => {
            if (otherClientId === localClientId) return;
            const otherPresence = roomInstance.presence[otherClientId];
            // Can only steal from living players holding a can
            if (!otherPresence || otherPresence.lost || !otherPresence.currentCanId) return;

            const canIdToSteal = otherPresence.currentCanId;
            const canToSteal = roomInstance.roomState.paintCans?.[canIdToSteal];

            // Ensure the target player actually owns the can according to roomState
            if (canToSteal && canToSteal.ownerId === otherClientId) {
                const otherPlayerPhysics = getPlayerPhysicsState(otherClientId);
                const otherPlayerBox = getPlayerBoundingBox(otherPlayerPhysics);

                if (checkRectCollision(localPlayerBox, otherPlayerBox)) {
                    console.log(`Player ${localClientId} collided with ${otherClientId}. Attempting steal of can ${canIdToSteal}!`);

                    // 1. Propose can ownership change in roomState
                    allPaintCanUpdates[canIdToSteal] = {
                        //...(allPaintCanUpdates[canIdToSteal] || {}), // Overwrite any previous update for this can
                        ownerId: localClientId, // Set new owner
                        // Reset physics/state on steal
                        x: canToSteal.x, // Keep current position
                        y: canToSteal.y,
                        vx: null,
                        vy: null,
                        isCharging: false,
                        accumulatedDroplets: 0,
                         // Keep paint amount and color
                         paintColor: canToSteal.paintColor,
                         paintAmount: canToSteal.paintAmount,
                         id: canIdToSteal // Ensure ID is preserved if merging caused issues
                    };

                    // 2. Request other player drops can
                    presenceRequests.push({ targetId: otherClientId, update: { type: 'dropCan' } });

                    // 3. Record steal attempt locally for confirmation later
                    stealAttempt.canId = canIdToSteal;

                    // 4. Visual Effect
                    addEffect('stealSpark', { x: localPlayerPhysics.position.x, y: localPlayerPhysics.position.y });
                    // DO NOT update localPresenceUpdates here yet

                    return; // Stop checking other players once a steal attempt is made
                }
            }
        });
    }


    // --- Spawn new paint cans randomly ---
    if (Math.random() < (config.spawnRatePerSecond || 0.1) * deltaTime) { // Use configured spawn rate
        const currentAvailableCans = roomInstance.roomState.availablePaintCans || {};
        const numAvailable = Object.values(currentAvailableCans).filter(can => can !== null).length;
        const numOwned = Object.keys(roomInstance.roomState.paintCans || {}).length;
        const totalCans = numAvailable + numOwned;

        if (totalCans < config.maxTotalCans) { // Check against total cans
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
        const { dropletsToRemove: collidedDroplets, collisionPoints, presenceUpdates: paintPresenceUpdates } = checkCollisionsWithPlayer(
            localPlayerPhysics.position,
            roomInstance.roomState.droplets || {},
            localClientId,
            localPresenceForCollision, // Pass current presence state for checks
            now
        );
        if (Object.keys(collidedDroplets).length > 0) {
             allDropletRemovals = { ...allDropletRemovals, ...collidedDroplets };
        }
        collisionPoints.forEach(point => addEffect('splat', { x: point.x, y: point.y, color: point.color }));
         // Apply paint/loss presence updates directly (not pickup/steal related)
         if (Object.keys(paintPresenceUpdates).length > 0) {
             localPresenceUpdates = { ...localPresenceUpdates, ...paintPresenceUpdates };
             // Immediately update local cache for loss/paint
              Object.assign(roomInstance.presence[localClientId], paintPresenceUpdates);
              // If player just lost, ensure currentCanId is nulled in immediate update
              if (paintPresenceUpdates.lost && roomInstance.presence[localClientId].currentCanId) {
                   localPresenceUpdates.currentCanId = null;
                   roomInstance.presence[localClientId].currentCanId = null;
              }
         }
    }


    // --- Check for Expired Droplets ---
    const currentDroplets = roomInstance.roomState.droplets || {};
    const dropletDuration = config.dropletDuration || 2000;
    Object.entries(currentDroplets).forEach(([id, droplet]) => {
        if (!droplet || allDropletRemovals[id] === null) return; // Skip null or already marked
        if (now - droplet.createdAt > dropletDuration) {
            allDropletRemovals[id] = null; // Mark for removal
        }
    });


    // --- Prepare Final Room State Updates ---
    const roomStateUpdates = {};
    if (Object.keys(allPaintCanUpdates).length > 0) roomStateUpdates.paintCans = allPaintCanUpdates;
    if (Object.keys(allAvailablePaintCanUpdates).length > 0) roomStateUpdates.availablePaintCans = allAvailablePaintCanUpdates;
    // Merge droplet additions and removals carefully
    if (Object.keys(allDropletsToAdd).length > 0 || Object.keys(allDropletRemovals).length > 0) {
        roomStateUpdates.droplets = { ...(allDropletsToAdd || {}), ...(allDropletRemovals || {}) };
    }

    return {
        roomStateUpdates,
        localPresenceUpdates, // Only non-pickup/steal presence changes intended for immediate update
        presenceRequests,
        pickupAttempt,
        stealAttempt
    };
}