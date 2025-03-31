/**
 * playerInteractions.js
 * Handles interactions initiated by the player: charging, dropping, picking up, throwing cans.
 */
import config from 'config';
// Need player state to get velocity for throwing
import { getPlayerPhysicsState } from './playerState.js';

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
 * Now also handles picking up thrown (moving) cans, resetting their velocity.
 * @param {object} playerBodyPos - The player's body position {x, y}.
 * @param {string} localClientId - The ID of the local client.
 * @param {object} presence - The player's current presence data.
 * @param {object} availablePaintCans - The available paint cans from roomState.
 * @returns {object} Update objects for roomState and presence.
 */
export function handlePaintCanPickup(playerBodyPos, localClientId, presence, availablePaintCans) {
    // Skip if player already has a can or has lost
    if (presence.currentCanId || presence.lost) return { paintCanUpdates: {}, availablePaintCanUpdates: {}, presenceUpdates: {} };

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
                    // Reset physics properties upon pickup
                    vx: null, // Ensure velocity is nulled
                    vy: null,
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
 * Handles throwing the currently held paint can.
 * @param {string} localClientId - The ID of the local client.
 * @param {object} presence - The player's current presence data.
 * @param {object} roomState - The current room state (to get can data).
 * @param {object} playerAnchorPos - The player's anchor (cursor) position {x, y}.
 * @returns {object} Update objects for roomState and presence, or empty if cannot throw.
 */
export function handleThrowPaintCan(localClientId, presence, roomState, playerAnchorPos) {
    const canId = presence?.currentCanId;
    const canState = canId ? roomState?.paintCans?.[canId] : null;
    const playerPhysics = getPlayerPhysicsState(localClientId);

    // Conditions to throw: holding a can, not lost, can exists, physics exists
    if (!canId || !canState || presence.lost || !playerPhysics || !playerAnchorPos) {
        return { paintCanUpdates: {}, availablePaintCanUpdates: {}, presenceUpdates: {} };
    }

    console.log(`Player ${localClientId} throwing can ${canId}`);

    // Calculate throw velocity
    // 1. Get player's current velocity (optional inheritance)
    const inheritFactor = config.paintCanThrowInheritVelocityFactor;
    const playerVx = playerPhysics.velocity.x * inheritFactor;
    const playerVy = playerPhysics.velocity.y * inheritFactor;

    // 2. Calculate direction from player body to anchor (cursor)
    const dirX = playerAnchorPos.x - playerPhysics.position.x;
    const dirY = playerAnchorPos.y - playerPhysics.position.y;
    const dist = Math.sqrt(dirX * dirX + dirY * dirY);
    let throwVx = 0;
    let throwVy = 0;
    if (dist > 1) {
        const normX = dirX / dist;
        const normY = dirY / dist;
        const throwSpeed = config.paintCanThrowVelocityMultiplier * dist; // More force if further away? Or just fixed? Let's try fixed for now.
        // const throwSpeed = config.paintCanThrowVelocityMultiplier * 10; // Fixed speed multiplier
        throwVx = normX * throwSpeed;
        throwVy = normY * throwSpeed;
    } else {
         // If cursor is on top of player, maybe throw straight up or based on last movement?
         // For now, just small velocity if dist is small.
         const fallbackSpeed = config.paintCanThrowVelocityMultiplier * 5;
         throwVy = -fallbackSpeed; // Default to throwing slightly up
    }


    // Combine inherited velocity and throw velocity
    const initialVx = playerVx + throwVx;
    const initialVy = playerVy + throwVy;

    // Prepare updates
    return {
        // Remove from owned cans
        paintCanUpdates: {
            [canId]: null
        },
        // Add to available cans with velocity
        availablePaintCanUpdates: {
            [canId]: {
                ...canState, // Keep paint amount, color etc.
                ownerId: null, // No owner
                x: canState.x, // Start at current position
                y: canState.y,
                vx: initialVx, // Set initial velocity
                vy: initialVy,
                // Clear interaction state
                isCharging: false,
                accumulatedDroplets: 0,
            }
        },
        // Update player presence to drop the can
        presenceUpdates: {
            currentCanId: null
        }
    };
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