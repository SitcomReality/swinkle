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

    // 1. Check for Empty Can Drop
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
            // NOTE: canState here would be the state *added* to paintCanUpdates,
            // it might not be in currentOwnedCans yet. handleCanCharging needs the updated state.
            // For simplicity, we'll fetch it again inside handleCanCharging if needed,
            // or rely on the game loop passing the updated state next frame.
            // Let's assume handleCanCharging will use the state from the updates if available.
             canState = pickupResult.paintCanUpdates[currentCanId]; // Get the state intended for update
        }
    }

    // 3. Handle Charging / Auto-Dropping (only if holding a valid can)
     // Re-fetch state in case it was just picked up or modified
     if (currentCanId) {
         const currentCanStateForInteraction = aggregatedUpdates.paintCanUpdates[currentCanId] || currentOwnedCans[currentCanId];
         if (currentCanStateForInteraction) {
             const chargeDropResult = handleCanChargingAndDropping(localClientId, currentCanStateForInteraction, deltaTime, now);
             // Merge results, potentially overwriting previous paintCanUpdates for this can ID
             aggregatedUpdates.paintCanUpdates[currentCanId] = {
                 ...(aggregatedUpdates.paintCanUpdates[currentCanId] || {}),
                 ...chargeDropResult.paintCanUpdates
             };
             Object.assign(aggregatedUpdates.newDroplets, chargeDropResult.newDroplets);
         }
     }


    return aggregatedUpdates;
}


/**
 * Handles paint can charging and auto-dropping logic for the local client's owned can.
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

    // Ensure canState exists and is owned by the local player before proceeding
    if (!canState || canState.ownerId !== localClientId) {
        timeSinceLastAutoDrop = 0; // Reset timer if can is invalid/not owned
        return { paintCanUpdates, newDroplets };
    }


    const currentPaintAmount = canState.paintAmount || 0;
    const currentAccumulated = canState.accumulatedDroplets || 0;

    if (canState.isCharging && currentPaintAmount > 0) {
        // --- Charging Logic ---
        const chargeRate = config.paintCanChargingSpeed; // Units per second
        const maxAccumulation = config.paintCanMaxAccumulatedDroplets;

        const paintToConsume = chargeRate * deltaTime;
        const dropletsToAccumulate = chargeRate * deltaTime;

        const actualPaintConsumed = Math.min(paintToConsume, currentPaintAmount);
        const actualDropletsAccumulated = Math.min(dropletsToAccumulate, maxAccumulation - currentAccumulated, actualPaintConsumed);

        if (actualDropletsAccumulated > 0 || actualPaintConsumed > 0) {
             paintCanUpdates.paintAmount = Math.max(0, currentPaintAmount - actualPaintConsumed);
             paintCanUpdates.accumulatedDroplets = Math.min(maxAccumulation, currentAccumulated + actualDropletsAccumulated);
        }
        timeSinceLastAutoDrop = 0;

    } else if (!canState.isCharging && currentPaintAmount > 0) {
        // --- Auto-Dropping Logic ---
        timeSinceLastAutoDrop += deltaTime * 1000; // Accumulate time in ms
        const autoDropInterval = 1000 / config.paintCanAutoDropRate; // ms per drop

        let dropsThisFrame = 0;
        // Use a temporary variable to track paint remaining *during this frame's auto-drop check*
        let paintAvailableForAutoDrop = currentPaintAmount;

        while (timeSinceLastAutoDrop >= autoDropInterval && paintAvailableForAutoDrop > 0) {
            timeSinceLastAutoDrop -= autoDropInterval;
            dropsThisFrame++;
            paintAvailableForAutoDrop--; // Decrement the temp variable

            const dropletId = `${localClientId}-${now}-auto-${dropsThisFrame}`;
            newDroplets[dropletId] = {
                id: dropletId,
                ownerId: localClientId,
                color: canState.paintColor,
                // Use current physics state for position, assuming it's calculated before interactions
                // TODO: Confirm canState.x/y are up-to-date from physics step before this interaction step
                x: canState.x,
                y: canState.y,
                createdAt: now
            };
        }

        if (dropsThisFrame > 0) {
            // Update paint amount based on actual drops this frame
            paintCanUpdates.paintAmount = Math.max(0, currentPaintAmount - dropsThisFrame);
        }
    } else {
         // Not charging, no paint, or invalid state - reset timer
         timeSinceLastAutoDrop = 0;
    }

    return { paintCanUpdates, newDroplets };
}


// --- Keep existing helper functions private to this module ---

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
 * Checks for empty paint cans and returns updates to handle them.
 * INTERNAL function called by handleLocalPlayerInteractions.
 * @param {string} localClientId - The ID of the local client.
 * @param {object} canState - The current state of the player's paint can.
 * @param {object} presence - The player's current presence data.
 * @returns {object} Update objects for roomState and presence.
 */
function handleEmptyPaintCan(localClientId, canState, presence) {
    // Basic check, also ensure the presence matches the can owner for sanity
    if (!canState || canState.ownerId !== localClientId || presence.currentCanId !== canState.id) {
        return { paintCanUpdates: {}, presenceUpdates: {} };
    }

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

// Export only the main facade function
export { handleLocalPlayerInteractions };