/**
 * playerInteractions.js
 * Handles interactions initiated by the player, specifically paint can charging and dropping.
 */
import config from 'config';

// Maintain state for auto-dropping timer PER CAN - This needs to be managed carefully.
// For simplicity, let's assume only one can is handled per client at a time,
// so a single timer variable is sufficient for the local client.
// If players could control multiple things simultaneously, this would need a map.
let timeSinceLastAutoDrop = 0; // Milliseconds

/**
 * Handles paint can charging and auto-dropping logic for the local client's owned can.
 * @param {string} localClientId - The ID of the local client.
 * @param {object} canState - The current state of the paint can being interacted with.
 * @param {number} deltaTime - Time elapsed since the last frame in seconds.
 * @param {number} now - The current timestamp (Date.now()).
 * @returns {{ paintCanUpdates: object, newDroplets: object }} - Updates to send to roomState.
 */
export function handleCanInteractions(localClientId, canState, deltaTime, now) {
    const paintCanUpdates = {}; // Updates for the paintCans state object
    const newDroplets = {};     // Updates for the droplets state object

    const currentPaintAmount = canState.paintAmount || 0;
    const currentAccumulated = canState.accumulatedDroplets || 0;

    if (canState.isCharging && currentPaintAmount > 0) {
        // --- Charging Logic ---
        const chargeRate = config.paintCanChargingSpeed; // Units per second
        const maxAccumulation = config.paintCanMaxAccumulatedDroplets;

        // Calculate how much paint would be consumed and how many droplets accumulated this frame
        const paintToConsume = chargeRate * deltaTime;
        const dropletsToAccumulate = chargeRate * deltaTime; // Assuming 1 unit paint = 1 droplet potential

        // Determine actual amounts considering remaining paint and max accumulation
        const actualPaintConsumed = Math.min(paintToConsume, currentPaintAmount);
        const actualDropletsAccumulated = Math.min(dropletsToAccumulate, maxAccumulation - currentAccumulated, actualPaintConsumed);

        if (actualDropletsAccumulated > 0 || actualPaintConsumed > 0) {
             // Apply the changes to the update batch
             paintCanUpdates.paintAmount = Math.max(0, currentPaintAmount - actualPaintConsumed);
             paintCanUpdates.accumulatedDroplets = Math.min(maxAccumulation, currentAccumulated + actualDropletsAccumulated);
            // console.log(`Charging: Consumed ${actualPaintConsumed.toFixed(2)}, Accumulated ${actualDropletsAccumulated.toFixed(2)}. New Amount: ${paintCanUpdates.paintAmount.toFixed(2)}, New Acc: ${paintCanUpdates.accumulatedDroplets.toFixed(2)}`);
        }
        // Reset auto-drop timer while charging
        timeSinceLastAutoDrop = 0;

    } else if (!canState.isCharging && currentPaintAmount > 0) {
        // --- Auto-Dropping Logic ---
        timeSinceLastAutoDrop += deltaTime * 1000; // Accumulate time in ms
        const autoDropInterval = 1000 / config.paintCanAutoDropRate; // ms per drop

        let dropsThisFrame = 0;
        while (timeSinceLastAutoDrop >= autoDropInterval && (currentPaintAmount - dropsThisFrame) > 0) {
            timeSinceLastAutoDrop -= autoDropInterval;
            dropsThisFrame++;

            // Create the droplet object
            const dropletId = `${localClientId}-${now}-auto-${dropsThisFrame}`; // Use 'now' for uniqueness
            newDroplets[dropletId] = {
                id: dropletId,
                ownerId: localClientId,
                color: canState.paintColor,
                x: canState.x, // Use current (updated) can position
                y: canState.y,
                createdAt: now // Use consistent timestamp for frame
            };
            // console.log(`Auto-dropping droplet ${dropletId}`);
        }

        if (dropsThisFrame > 0) {
            // Update paint amount in the update batch
            paintCanUpdates.paintAmount = Math.max(0, currentPaintAmount - dropsThisFrame);
            // console.log(`Dropped ${dropsThisFrame}. New Amount: ${paintCanUpdates.paintAmount}`);
        }
    } else {
         // Not charging, no paint, or invalid state - reset timer just in case
         timeSinceLastAutoDrop = 0;
    }

    return { paintCanUpdates, newDroplets };
}

/**
 * Checks if the player can pick up an available paint can and returns the updates.
 * @param {object} playerBodyPos - The player's body position {x, y}.
 * @param {string} localClientId - The ID of the local client.
 * @param {object} presence - The player's current presence data.
 * @param {object} availablePaintCans - The available paint cans from roomState.
 * @returns {object} Update objects for roomState and presence.
 */
export function handlePaintCanPickup(playerBodyPos, localClientId, presence, availablePaintCans) {
    // Skip if player already has a can
    if (presence.currentCanId) return { paintCanUpdates: {}, availablePaintCanUpdates: {}, presenceUpdates: {} };

    const pickupDistance = config.paintCanPickupDistance;
    const nearestCan = findNearestAvailableCan(playerBodyPos, availablePaintCans, pickupDistance);
    
    if (nearestCan) {
        console.log(`Player ${localClientId} picking up can ${nearestCan.id}`);
        
        // Updates to send
        return {
            // Add to paintCans with player as owner
            paintCanUpdates: {
                [nearestCan.id]: {
                    ...nearestCan,
                    ownerId: localClientId,
                    // Initialize physics properties if not present
                    vx: 0,
                    vy: 0,
                    isCharging: false,
                    accumulatedDroplets: 0
                }
            },
            // Remove from available cans
            availablePaintCanUpdates: {
                [nearestCan.id]: null
            },
            // Update player presence
            presenceUpdates: {
                currentCanId: nearestCan.id
            }
        };
    }
    
    return { paintCanUpdates: {}, availablePaintCanUpdates: {}, presenceUpdates: {} };
}

/**
 * Checks for empty paint cans and returns updates to handle them.
 * @param {string} localClientId - The ID of the local client.
 * @param {object} canState - The current state of the player's paint can.
 * @param {object} presence - The player's current presence data.
 * @returns {object} Update objects for roomState and presence.
 */
export function handleEmptyPaintCan(localClientId, canState, presence) {
    if (!canState || canState.ownerId !== localClientId) return { paintCanUpdates: {}, presenceUpdates: {} };
    
    // If can is empty, handle dropping it
    if (canState.paintAmount <= 0) {
        console.log(`Can ${canState.id} is empty, dropping it`);
        
        return {
            // Simply remove the can when empty
            paintCanUpdates: {
                [canState.id]: null
            },
            // Update player presence to no longer hold this can
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
    let nearestDistance = maxDistance;
    
    Object.values(availableCans).forEach(canState => {
        if (!canState) return;
        
        const dx = canState.x - playerPos.x;
        const dy = canState.y - playerPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestCan = canState;
        }
    });
    
    return nearestCan;
}