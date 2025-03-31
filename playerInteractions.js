/**
 * playerInteractions.js
 * Handles interactions initiated by the player: charging, dropping, picking up, throwing cans.
 */
import config from 'config';
// Need player state to get velocity for throwing
import { getPlayerPhysicsState } from './playerState.js';

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

        const paintToConsume = chargeRate * deltaTime;
        const dropletsToAccumulate = chargeRate * deltaTime;

        const actualPaintConsumed = Math.min(paintToConsume, currentPaintAmount);
        const actualDropletsAccumulated = Math.min(dropletsToAccumulate, maxAccumulation - currentAccumulated, actualPaintConsumed);

        if (actualDropletsAccumulated > 0 || actualPaintConsumed > 0) {
             paintCanUpdates.paintAmount = Math.max(0, currentPaintAmount - actualPaintConsumed);
             paintCanUpdates.accumulatedDroplets = Math.min(maxAccumulation, currentAccumulated + actualDropletsAccumulated);
        }
        // No auto-drop while charging

    } else if (!canState.isCharging && currentPaintAmount > 0) {
        // --- Auto-Dropping Logic ---
        // Calculate expected drops this frame based on rate
        const dropsExpectedThisFrame = config.paintCanAutoDropRate * deltaTime;
        // Determine whole number of drops to actually perform
        // This avoids complex timer state by averaging over time.
        // Use Math.random() check to handle fractional drops probabilistically.
        const wholeDrops = Math.floor(dropsExpectedThisFrame);
        const fractionalDropChance = dropsExpectedThisFrame - wholeDrops;
        let dropsThisFrame = wholeDrops + (Math.random() < fractionalDropChance ? 1 : 0);

        // Clamp drops to available paint
        dropsThisFrame = Math.min(dropsThisFrame, Math.floor(currentPaintAmount)); // Ensure whole paint units

        if (dropsThisFrame > 0) {
            for (let i = 0; i < dropsThisFrame; i++) {
                const dropletId = `${localClientId}-${now}-auto-${i}`;
                newDroplets[dropletId] = {
                    id: dropletId,
                    ownerId: localClientId,
                    color: canState.paintColor,
                    x: canState.x,
                    y: canState.y,
                    createdAt: now
                };
            }
            paintCanUpdates.paintAmount = Math.max(0, currentPaintAmount - dropsThisFrame);
        }
    }
    // No timer state needed here anymore.

    return { paintCanUpdates, newDroplets };
}

/**
 * Checks if the player can pick up an available paint can and returns the proposed updates.
 * The presence update is only an *intent* and should be confirmed by game-loop.
 * @param {object} playerBodyPos - The player's body position {x, y}.
 * @param {string} localClientId - The ID of the local client.
 * @param {object} presence - The player's current presence data.
 * @param {object} availablePaintCans - The available paint cans from roomState.
 * @returns {object} Update objects for roomState (proposal) and presence (intent).
 */
export function handlePaintCanPickup(playerBodyPos, localClientId, presence, availablePaintCans) {
    // Skip if player already has a can or has lost
    if (presence.currentCanId || presence.lost) return { paintCanUpdates: {}, availablePaintCanUpdates: {}, presenceUpdates: {} };

    const pickupDistance = config.paintCanPickupDistance;
    const nearestCan = findNearestAvailableCan(playerBodyPos, availablePaintCans, pickupDistance);

    if (nearestCan) {
        console.log(`Player ${localClientId} attempting to pick up can ${nearestCan.id}`);

        // Updates to send (Proposals for RoomState, Intent for Presence)
        return {
            // Propose adding to paintCans with player as owner
            paintCanUpdates: {
                [nearestCan.id]: {
                    ...nearestCan,
                    ownerId: localClientId,
                    vx: null, vy: null, isCharging: false, accumulatedDroplets: 0
                }
            },
            // Propose removing from available cans
            availablePaintCanUpdates: {
                [nearestCan.id]: null
            },
            // Intent to update player presence (to be confirmed later)
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

    // Conditions to throw: holding a can, not lost, can exists, physics exists, anchor exists
    if (!canId || !canState || presence.lost || !playerPhysics || !playerAnchorPos || typeof playerAnchorPos.x !== 'number') {
        return { paintCanUpdates: {}, availablePaintCanUpdates: {}, presenceUpdates: {} };
    }

    // Ensure the can actually belongs to the player throwing it (prevent race condition throws)
    if (canState.ownerId !== localClientId) {
         console.warn(`Player ${localClientId} tried to throw can ${canId} but owner is ${canState.ownerId}`);
         return { paintCanUpdates: {}, availablePaintCanUpdates: {}, presenceUpdates: {} };
    }


    console.log(`Player ${localClientId} throwing can ${canId}`);

    // Calculate throw velocity
    const inheritFactor = config.paintCanThrowInheritVelocityFactor;
    const playerVx = playerPhysics.velocity.x * inheritFactor;
    const playerVy = playerPhysics.velocity.y * inheritFactor;

    const dirX = playerAnchorPos.x - playerPhysics.position.x;
    const dirY = playerAnchorPos.y - playerPhysics.position.y;
    const dist = Math.sqrt(dirX * dirX + dirY * dirY);
    let throwVx = 0;
    let throwVy = 0;

    // Use a base throw speed plus potential distance multiplier
    const baseThrowSpeed = config.paintCanThrowBaseSpeed || 500;
    const distanceMultiplier = config.paintCanThrowDistanceMultiplier || 0; // Set > 0 to throw harder based on cursor distance
    const throwSpeed = baseThrowSpeed + (dist * distanceMultiplier);

    if (dist > 1) {
        const normX = dirX / dist;
        const normY = dirY / dist;
        throwVx = normX * throwSpeed;
        throwVy = normY * throwSpeed;
    } else {
         // Default throw direction if cursor is too close (e.g., upwards)
         throwVy = -baseThrowSpeed; // Throw up
    }

    const initialVx = playerVx + throwVx;
    const initialVy = playerVy + throwVy;

    // Prepare updates
    return {
        // Propose removing from owned cans
        paintCanUpdates: {
            [canId]: null
        },
        // Propose adding to available cans with velocity
        availablePaintCanUpdates: {
            [canId]: {
                ...canState,
                ownerId: null,
                x: canState.x,
                y: canState.y,
                vx: initialVx,
                vy: initialVy,
                isCharging: false,
                accumulatedDroplets: 0,
            }
        },
        // Update player presence immediately to drop the can
        presenceUpdates: {
            currentCanId: null
        }
    };
}

/**
 * Checks for empty paint cans and returns updates to handle them (making them available).
 * @param {string} localClientId - The ID of the local client.
 * @param {object} canState - The current state of the player's paint can.
 * @param {object} presence - The player's current presence data.
 * @returns {object} Update objects for roomState and presence.
 */
export function handleEmptyPaintCan(localClientId, canState, presence) {
    if (!canState || canState.ownerId !== localClientId) return { paintCanUpdates: {}, availablePaintCanUpdates: {}, presenceUpdates: {} };

    // If can is empty, handle dropping it and making it available (briefly)
    if (canState.paintAmount <= 0) {
        console.log(`Can ${canState.id} is empty, dropping it`);

        return {
            // Remove from owned cans
            paintCanUpdates: {
                [canState.id]: null
            },
            // Make it available (will likely get cleaned up quickly if not configured otherwise)
            // Setting position slightly offset might be visually better than at player feet.
             availablePaintCanUpdates: {
                 [canState.id]: {
                     ...canState, // Keep color, id etc.
                     ownerId: null,
                     paintAmount: 0, // Explicitly 0
                     vx: null, // No velocity
                     vy: null,
                     isCharging: false,
                     accumulatedDroplets: 0,
                     // Position it at the current location
                     x: canState.x,
                     y: canState.y
                 }
             },
            // Update player presence to no longer hold this can (immediate)
            presenceUpdates: {
                currentCanId: null
            }
        };
    }

    return { paintCanUpdates: {}, availablePaintCanUpdates: {}, presenceUpdates: {} };
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
    let minDistanceSq = maxDistance * maxDistance; // Use squared distance

    Object.values(availableCans).forEach(canState => {
        if (!canState) return; // Skip null entries

        const dx = canState.x - playerPos.x;
        const dy = canState.y - playerPos.y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq < minDistanceSq) {
            minDistanceSq = distanceSq;
            nearestCan = canState;
        }
    });

    return nearestCan;
}