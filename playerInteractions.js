/**
 * playerInteractions.js
 * Handles interactions initiated by the local player:
 * - Picking up cans
 * - Handling empty cans
 * - Charging and auto-dropping paint from held cans.
 */
import config from 'config';

// Separate state for auto-drop timer as it's purely local client visual/timing state
let timeSinceLastAutoDrop = 0; // Milliseconds

/**
 * Creates the droplet data for a paint burst.
 * @param {string} ownerId - The ID of the player releasing the burst.
 * @param {object} canState - The state of the can releasing the burst { x, y, paintColor }.
 * @param {number} numDroplets - The number of droplets to create.
 * @param {number} now - The current timestamp.
 * @returns {object} An object containing droplet data keyed by unique droplet IDs.
 */
export function createBurstDroplets(ownerId, canState, numDroplets, now) {
    const burstDroplets = {};
    const canX = canState.x;
    const canY = canState.y;
    const spreadRadius = config.burstSpreadRadius; // Use config value

    for (let i = 0; i < numDroplets; i++) {
        const dropletId = `${ownerId}-${now}-burst-${i}`;
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * spreadRadius; // Random distance within spread radius
        burstDroplets[dropletId] = {
            id: dropletId,
            ownerId: ownerId,
            color: canState.paintColor,
            x: canX + Math.cos(angle) * radius,
            y: canY + Math.sin(angle) * radius,
            createdAt: now
        };
    }
    return burstDroplets;
}

/**
 * Facade function to handle all local player interactions within a frame.
 * Calls specific interaction handlers and aggregates their updates.
 *
 * @param {string} localClientId - The ID of the local client.
 * @param {object} presence - The player's current presence data.
 * @param {object} playerBodyPos - The player's body position {x, y}.
 * @param {object} currentOwnedCans - Current owned paint cans from roomState.paintCans.
 * @param {object} currentAvailableCans - Current available paint cans from roomState.availablePaintCans.
 * @param {number} deltaTime - Time elapsed since the last frame in seconds.
 * @param {number} now - The current timestamp (Date.now()).
 * @returns {object} Aggregated updates { paintCanUpdates, newDroplets, presenceUpdates, availablePaintCanUpdates }
 */
export function handleLocalPlayerInteractions(localClientId, presence, playerBodyPos, currentOwnedCans, currentAvailableCans, deltaTime, now) {
    const aggregatedUpdates = {
        paintCanUpdates: {},
        newDroplets: {},
        presenceUpdates: {},
        availablePaintCanUpdates: {}
    };

    let currentCanId = presence.currentCanId; // Get current can ID
    let canState = currentCanId ? currentOwnedCans[currentCanId] : null;

    // 1. Check for Empty Can Drop (Applies if can becomes empty due to auto-drop OR charging)
    // This check might now be partly redundant due to burst-on-empty logic in charging,
    // but keeping it ensures cans are dropped if they somehow become empty without bursting.
    if (currentCanId && canState) {
        const emptyCanResult = handleEmptyPaintCan(localClientId, canState, presence);
        Object.assign(aggregatedUpdates.paintCanUpdates, emptyCanResult.paintCanUpdates);
        Object.assign(aggregatedUpdates.presenceUpdates, emptyCanResult.presenceUpdates);
        // If can was dropped, update local state for subsequent checks
        if (emptyCanResult.presenceUpdates.currentCanId === null) {
            currentCanId = null;
            canState = null;
        }
    }

    // 2. Check for Paint Can Pickup (only if not currently holding a can)
    if (!currentCanId) {
        const pickupResult = handlePaintCanPickup(playerBodyPos, localClientId, presence, currentAvailableCans);
        Object.assign(aggregatedUpdates.paintCanUpdates, pickupResult.paintCanUpdates);
        Object.assign(aggregatedUpdates.availablePaintCanUpdates, pickupResult.availablePaintCanUpdates);
        Object.assign(aggregatedUpdates.presenceUpdates, pickupResult.presenceUpdates);
        // If can was picked up, update local state for subsequent checks
        if (pickupResult.presenceUpdates.currentCanId) {
            currentCanId = pickupResult.presenceUpdates.currentCanId;
             canState = pickupResult.paintCanUpdates[currentCanId]; // Get the state intended for update
        }
    }

    // 3. Handle Charging / Auto-Dropping (only if holding a valid can)
     // Re-fetch state in case it was just picked up or modified
     if (currentCanId) {
         // Ensure we use the most up-to-date state for interactions, potentially including pickup updates
         const currentCanStateForInteraction = aggregatedUpdates.paintCanUpdates[currentCanId] || currentOwnedCans[currentCanId];
         if (currentCanStateForInteraction) {
             const chargeDropResult = handleCanChargingAndDropping(localClientId, currentCanStateForInteraction, deltaTime, now);
             // Merge results, potentially overwriting previous paintCanUpdates for this can ID
             aggregatedUpdates.paintCanUpdates[currentCanId] = {
                 ...(aggregatedUpdates.paintCanUpdates[currentCanId] || {}), // Keep existing updates (like ownership from pickup)
                 ...chargeDropResult.paintCanUpdates // Add/overwrite charge/drop updates
             };
             Object.assign(aggregatedUpdates.newDroplets, chargeDropResult.newDroplets);

            // Check if the can was emptied and dropped by handleEmptyPaintCan *after* charge/drop calculations
            // If so, nullify the can update to prevent resurrection
            if (aggregatedUpdates.presenceUpdates.currentCanId === null && aggregatedUpdates.paintCanUpdates[currentCanId] === null) {
                 // Can was dropped by handleEmptyPaintCan, ensure we don't send other updates for it
            } else if (aggregatedUpdates.paintCanUpdates[currentCanId]?.paintAmount <= 0 && aggregatedUpdates.presenceUpdates.currentCanId !== null) {
                // If charging/dropping emptied the can but it wasn't explicitly dropped yet,
                // re-run the empty check based on the *new* state from chargeDropResult
                const potentiallyEmptyCanState = { ...currentCanStateForInteraction, ...chargeDropResult.paintCanUpdates };
                 const finalEmptyCheckResult = handleEmptyPaintCan(localClientId, potentiallyEmptyCanState, presence);
                 if (finalEmptyCheckResult.presenceUpdates.currentCanId === null) {
                      Object.assign(aggregatedUpdates.paintCanUpdates, finalEmptyCheckResult.paintCanUpdates);
                      Object.assign(aggregatedUpdates.presenceUpdates, finalEmptyCheckResult.presenceUpdates);
                 }
            }
         }
     }


    return aggregatedUpdates;
}

/**
 * Handles paint can charging and auto-dropping logic for the local client's owned can.
 * Includes logic for bursting accumulated droplets if the can runs out while charging.
 * This function is INTERNAL and called by handleLocalPlayerInteractions.
 *
 * @param {string} localClientId - The ID of the local client.
 * @param {object} canState - The current state of the paint can being interacted with.
 * @param {number} deltaTime - Time elapsed since the last frame in seconds.
 * @param {number} now - The current timestamp (Date.now()).
 * @returns {{ paintCanUpdates: object, newDroplets: object }} - Updates to send to roomState.
 */
function handleCanChargingAndDropping(localClientId, canState, deltaTime, now) {
    const paintCanUpdates = {}; // Updates for the paintCans state object
    const newDroplets = {};     // Updates for the droplets state object

    if (!canState || canState.ownerId !== localClientId) {
        timeSinceLastAutoDrop = 0;
        return { paintCanUpdates, newDroplets };
    }

    const currentPaintAmount = canState.paintAmount || 0;
    const currentAccumulated = canState.accumulatedDroplets || 0;
    let triggeredBurstOnEmpty = false; // Flag to prevent auto-drop after burst-on-empty

    if (canState.isCharging && currentPaintAmount > 0) {
        const chargeRate = config.paintCanChargingSpeed;
        const maxAccumulation = config.paintCanMaxAccumulatedDroplets;
        const paintToConsume = chargeRate * deltaTime;
        const dropletsToAccumulate = chargeRate * deltaTime;

        const actualPaintConsumed = Math.min(paintToConsume, currentPaintAmount);
        // Accumulate droplets only if paint is consumed, up to the max
        const potentialNewAccumulated = Math.min(maxAccumulation, currentAccumulated + Math.min(dropletsToAccumulate, actualPaintConsumed));
        const actualDropletsAccumulated = potentialNewAccumulated - currentAccumulated;

        // Apply updates
        const newPaintAmount = Math.max(0, currentPaintAmount - actualPaintConsumed);
        paintCanUpdates.paintAmount = newPaintAmount;
        if (actualDropletsAccumulated > 0) {
            paintCanUpdates.accumulatedDroplets = potentialNewAccumulated;
        }

        timeSinceLastAutoDrop = 0; // Reset auto-drop timer while charging

        // --- Burst on Empty Check ---
        // Use the *newly calculated* amounts for the check
        const accumulatedAfterUpdate = paintCanUpdates.accumulatedDroplets !== undefined ? paintCanUpdates.accumulatedDroplets : currentAccumulated;
        if (newPaintAmount <= 0 && accumulatedAfterUpdate > 0) {
            console.log(`Can ${canState.id} ran out while charging, bursting ${accumulatedAfterUpdate} droplets.`);
            const burstData = createBurstDroplets(localClientId, canState, accumulatedAfterUpdate, now);
            Object.assign(newDroplets, burstData); // Add burst droplets to the output
            paintCanUpdates.accumulatedDroplets = 0; // Reset accumulation since it burst
            triggeredBurstOnEmpty = true; // Mark that burst happened
            // Note: We don't drop the can here, handleEmptyPaintCan will do that based on the final amount
        }

    } else if (!canState.isCharging && currentPaintAmount > 0 && !triggeredBurstOnEmpty) {
        // --- Auto-Dropping Logic ---
        // Only auto-drop if not charging AND burst-on-empty didn't just happen
        timeSinceLastAutoDrop += deltaTime * 1000; // Accumulate time in ms
        const autoDropInterval = 1000 / config.paintCanAutoDropRate; // ms per drop

        let dropsThisFrame = 0;
        let paintAvailableForAutoDrop = currentPaintAmount;

        while (timeSinceLastAutoDrop >= autoDropInterval && paintAvailableForAutoDrop > 0) {
            timeSinceLastAutoDrop -= autoDropInterval;
            dropsThisFrame++;
            paintAvailableForAutoDrop--;

            const dropletId = `${localClientId}-${now}-auto-${dropsThisFrame}`;
            newDroplets[dropletId] = {
                id: dropletId,
                ownerId: localClientId,
                color: canState.paintColor,
                x: canState.x,
                y: canState.y,
                createdAt: now
            };
        }

        if (dropsThisFrame > 0) {
            paintCanUpdates.paintAmount = Math.max(0, currentPaintAmount - dropsThisFrame);
        }
    } else {
         timeSinceLastAutoDrop = 0; // Reset timer if not charging, no paint, or burst just happened
    }

    return { paintCanUpdates, newDroplets };
}

/**
 * Checks if the player can pick up an available paint can and returns the updates.
 * INTERNAL function called by handleLocalPlayerInteractions.
 * @param {object} playerBodyPos - The player's body position {x, y}.
 * @param {string} localClientId - The ID of the local client.
 * @param {object} presence - The player's current presence data.
 * @param {object} availablePaintCans - The available paint cans from roomState.
 * @returns {object} Update objects for roomState and presence.
 */
function handlePaintCanPickup(playerBodyPos, localClientId, presence, availablePaintCans) {
    // Skip if player already has a can or has lost
    if (presence.currentCanId || presence.lost) return { paintCanUpdates: {}, availablePaintCanUpdates: {}, presenceUpdates: {} };

    const pickupDistance = config.paintCanPickupDistance;
    const nearestCan = findNearestAvailableCan(playerBodyPos, availablePaintCans, pickupDistance);

    if (nearestCan) {
        console.log(`Player ${localClientId} picking up can ${nearestCan.id}`);

        return {
            paintCanUpdates: {
                [nearestCan.id]: {
                    ...nearestCan,
                    ownerId: localClientId,
                    vx: 0, vy: 0, // Reset physics state on pickup
                    isCharging: false,
                    accumulatedDroplets: 0
                }
            },
            availablePaintCanUpdates: {
                [nearestCan.id]: null
            },
            presenceUpdates: {
                currentCanId: nearestCan.id
            }
        };
    }

    return { paintCanUpdates: {}, availablePaintCanUpdates: {}, presenceUpdates: {} };
}

/**
 * Checks for empty paint cans and returns updates to handle them (drop).
 * INTERNAL function called by handleLocalPlayerInteractions.
 * @param {string} localClientId - The ID of the local client.
 * @param {object} canState - The current state of the player's paint can (potentially updated within frame).
 * @param {object} presence - The player's current presence data.
 * @returns {object} Update objects for roomState and presence.
 */
function handleEmptyPaintCan(localClientId, canState, presence) {
    // Basic check, also ensure the presence matches the can owner for sanity
    // Skip if already lost
    if (!canState || canState.ownerId !== localClientId || presence.currentCanId !== canState.id || presence.lost) {
        return { paintCanUpdates: {}, presenceUpdates: {} };
    }

    // Use the paintAmount from the canState passed in, which might have been updated by charging/dropping
    if (canState.paintAmount <= 0) {
        console.log(`Can ${canState.id} is empty, dropping it`);

        return {
            paintCanUpdates: {
                [canState.id]: null // Remove the can entirely when empty
            },
            presenceUpdates: {
                currentCanId: null
            }
        };
    }

    return { paintCanUpdates: {}, presenceUpdates: {} };
}

/**
 * Finds the nearest available paint can within pickup distance.
 * @private
 * @param {object} playerPos - The player's position {x, y}.
 * @param {object} availableCans - The available paint cans object.
 * @param {number} maxDistance - Maximum pickup distance.
 * @returns {object|null} The nearest can state or null if none found.
 */
function findNearestAvailableCan(playerPos, availableCans, maxDistance) {
    let nearestCan = null;
    let nearestDistanceSq = maxDistance * maxDistance; // Use squared distance

    Object.values(availableCans).forEach(canState => {
        if (!canState) return;

        const dx = canState.x - playerPos.x;
        const dy = canState.y - playerPos.y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq < nearestDistanceSq) {
            nearestDistanceSq = distanceSq;
            nearestCan = canState;
        }
    });

    return nearestCan;
}