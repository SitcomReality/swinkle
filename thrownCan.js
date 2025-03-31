/**
 * thrownCan.js
 * Handles physics and interactions for paint cans that have been thrown
 * and are no longer attached to a player via bungee.
 */
import config from 'config';

const GRAVITY = config.gravityAcceleration * config.paintCanGravityFactor;
const DAMPING = config.paintCanThrownDamping;
const RESTITUTION = config.paintCanThrownRestitution;
const STOP_THRESHOLD_SQ = config.paintCanThrownStopThreshold * config.paintCanThrownStopThreshold; // Use squared threshold for performance

/**
 * Updates the physics simulation for a single thrown paint can.
 * Applies gravity, damping, and wall collisions.
 * Modifies the canState directly.
 *
 * @param {object} canState - The state object for the can { id, x, y, vx, vy, ... }. Must have vx/vy.
 * @param {number} deltaTime - Time elapsed since the last frame in seconds.
 * @param {number} canvasWidth - Current width of the game canvas.
 * @param {number} canvasHeight - Current height of the game canvas.
 * @returns {object|null} An update object { vx, vy } if the can came to rest, otherwise null.
 */
export function updateThrownCanPhysics(canState, deltaTime, canvasWidth, canvasHeight) {
    if (typeof canState.vx !== 'number' || typeof canState.vy !== 'number') {
        // console.warn(`Can ${canState.id} missing velocity, cannot update thrown physics.`);
        return null; // Not a thrown can or state is incomplete
    }

    // Apply Gravity
    canState.vy += GRAVITY * deltaTime;

    // Apply Damping (adjust for deltaTime)
    const dampingFactor = Math.pow(DAMPING, deltaTime * 60); // Frame-rate independent damping
    canState.vx *= dampingFactor;
    canState.vy *= dampingFactor;

    // Update Position
    canState.x += canState.vx * deltaTime;
    canState.y += canState.vy * deltaTime;

    // Boundary Collisions (Walls)
    const canRadiusX = config.paintCanWidth / 2; // Approximate radius
    const canRadiusY = config.paintCanHeight / 2;
    let bounced = false;

    if (canState.x - canRadiusX < 0 && canState.vx < 0) {
        canState.x = canRadiusX;
        canState.vx *= -RESTITUTION;
        bounced = true;
    } else if (canState.x + canRadiusX > canvasWidth && canState.vx > 0) {
        canState.x = canvasWidth - canRadiusX;
        canState.vx *= -RESTITUTION;
        bounced = true;
    }

    if (canState.y - canRadiusY < 0 && canState.vy < 0) {
        canState.y = canRadiusY;
        canState.vy *= -RESTITUTION;
        bounced = true;
    } else if (canState.y + canRadiusY > canvasHeight && canState.vy > 0) {
        canState.y = canvasHeight - canRadiusY;
        canState.vy *= -RESTITUTION;
        // Add slight friction on ground bounce
        if (Math.abs(canState.vy) < 10) { // Only apply if bounce is small
             canState.vx *= 0.9; // Ground friction
        }
        bounced = true;
    }

    // Check if velocity is below stop threshold
    const speedSq = canState.vx * canState.vx + canState.vy * canState.vy;
    if (!bounced && speedSq < STOP_THRESHOLD_SQ) {
        // console.log(`Can ${canState.id} came to rest.`);
        // Return an update to signal removal of velocity properties
        return { vx: null, vy: null };
    }

    return null; // No state change needed (still moving)
}

// Note: Rendering is handled by the existing `renderPaintCan` function called in game-loop.js
// for all available cans, including thrown ones.
