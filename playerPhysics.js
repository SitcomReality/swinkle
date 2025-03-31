/**
 * playerPhysics.js
 * Handles physics calculations for the player body and limbs.
 */
import config from './config.js';
import { ensurePhysicsState, getPlayerPhysicsState, setPlayerPhysicsState } from './playerState.js';

/**
 * Updates the physics simulation for a single limb.
 * @param {object} limbState - The state object for the limb { attachmentOffset, position, velocity }.
 * @param {object} bodyPos - The current position of the player's body {x, y}.
 * @param {number} deltaTime - Time elapsed since the last frame in seconds.
 */
function updateLimbPhysics(limbState, bodyPos, deltaTime) {
    // Physics Constants from Config (specific to limbs)
    const k = config.limbSpringConstant;
    const restLength = config.limbLength; // Limbs try to maintain this length
    const damping = config.limbDampingFactor;
    const gravity = config.gravityAcceleration * config.limbGravityFactor; // Limbs might be affected less by gravity
    const mass = config.limbMass;
    const maxLength = restLength * config.limbMaxLengthMultiplier;

    // Calculate the absolute world position of the attachment point
    const attachmentPoint = {
        x: bodyPos.x + limbState.attachmentOffset.x,
        y: bodyPos.y + limbState.attachmentOffset.y,
    };

    // Calculate vector from limb end to its attachment point
    const dx = attachmentPoint.x - limbState.position.x;
    const dy = attachmentPoint.y - limbState.position.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    const stretch = distance - restLength;

    // Normalize direction vector
    let normDx = 0, normDy = 0;
    if (distance > 0.01) {
        normDx = dx / distance;
        normDy = dy / distance;
    }

    // --- Forces ---
    // Spring Force (pulls limb end towards attachment point)
    const springForceMagnitude = k * stretch;
    const springForceX = normDx * springForceMagnitude;
    const springForceY = normDy * springForceMagnitude;

    // Gravity Force
    const gravityForceY = gravity * mass;

    // Total Force
    const totalForceX = springForceX;
    const totalForceY = springForceY + gravityForceY;

    // --- Acceleration & Velocity ---
    const accelerationX = totalForceX / mass;
    const accelerationY = totalForceY / mass;

    limbState.velocity.x += accelerationX * deltaTime;
    limbState.velocity.y += accelerationY * deltaTime;

    // Apply Damping
    limbState.velocity.x *= Math.pow(damping, deltaTime * 60);
    limbState.velocity.y *= Math.pow(damping, deltaTime * 60);

    // --- Update Position ---
    limbState.position.x += limbState.velocity.x * deltaTime;
    limbState.position.y += limbState.velocity.y * deltaTime;

    // --- Max Length Constraint (relative to attachment point) ---
    const newDx = attachmentPoint.x - limbState.position.x;
    const newDy = attachmentPoint.y - limbState.position.y;
    const newDistance = Math.sqrt(newDx * newDx + newDy * newDy);

    if (newDistance > maxLength) {
        const clampRatio = maxLength / newDistance;
        limbState.position.x = attachmentPoint.x - newDx * clampRatio;
        limbState.position.y = attachmentPoint.y - newDy * clampRatio;

        // Dampen velocity component moving away from attachment point
        const limbDirX = newDx / newDistance;
        const limbDirY = newDy / newDistance;
        const dotProduct = limbState.velocity.x * limbDirX + limbState.velocity.y * limbDirY;
        if (dotProduct > 0) {
            limbState.velocity.x -= dotProduct * limbDirX;
            limbState.velocity.y -= dotProduct * limbDirY;
        }
    }
    // Note: limbState is modified directly by reference
}


/**
 * Updates the player's body physics state based on bungee forces, gravity, and damping.
 *
 * @param {string} clientId - The ID of the player to update.
 * @param {object} presence - The player's presence data (containing anchor x, y).
 * @param {number} deltaTime - Time elapsed since the last frame in seconds.
 */
export function updatePlayerPhysics(clientId, presence, deltaTime) {
    if (!presence || typeof presence.x !== 'number' || typeof presence.y !== 'number') {
        return; // Need anchor position
    }

    const anchorPos = { x: presence.x, y: presence.y };
    // Ensure state exists, using anchor position if initializing
    const state = ensurePhysicsState(clientId, anchorPos);

    // --- Body Physics ---
    const k = config.bungeeSpringConstant;
    const restLength = config.bungeeRestLength;
    const damping = config.bungeeDampingFactor;
    const gravity = config.gravityAcceleration;
    const mass = config.playerBodyMass || 1;
    const maxLength = restLength * (config.bungeeMaxLengthMultiplier || 5);

    const dx = anchorPos.x - state.position.x;
    const dy = anchorPos.y - state.position.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    const stretch = distance - restLength;

    let normDx = 0, normDy = 0;
    if (distance > 0.01) {
        normDx = dx / distance;
        normDy = dy / distance;
    }

    let springForceX = 0, springForceY = 0;
    if (distance > 0.01) {
        const forceMagnitude = k * stretch;
        springForceX = normDx * forceMagnitude;
        springForceY = normDy * forceMagnitude;
    }

    const gravityForceY = gravity * mass;
    const totalForceX = springForceX;
    const totalForceY = springForceY + gravityForceY;

    const accelerationX = totalForceX / mass;
    const accelerationY = totalForceY / mass;

    state.velocity.x += accelerationX * deltaTime;
    state.velocity.y += accelerationY * deltaTime;

    state.velocity.x *= Math.pow(damping, deltaTime * 60);
    state.velocity.y *= Math.pow(damping, deltaTime * 60);

    state.position.x += state.velocity.x * deltaTime;
    state.position.y += state.velocity.y * deltaTime;

    // Max Length Constraint for Bungee
    const newDx = anchorPos.x - state.position.x;
    const newDy = anchorPos.y - state.position.y;
    const newDistance = Math.sqrt(newDx * newDx + newDy * newDy);

    if (newDistance > maxLength) {
        const clampRatio = maxLength / newDistance;
        state.position.x = anchorPos.x - newDx * clampRatio;
        state.position.y = anchorPos.y - newDy * clampRatio;

        // Dampen velocity component moving away from the anchor point
        const cordDirX = newDx / newDistance;
        const cordDirY = newDy / newDistance;
        const dotProduct = state.velocity.x * cordDirX + state.velocity.y * cordDirY;
        if (dotProduct > 0) {
            state.velocity.x -= dotProduct * cordDirX;
            state.velocity.y -= dotProduct * cordDirY;
        }
    }

    // --- Update Limb Physics ---
    // Pass the updated body position to limb physics calculations
    state.limbs.forEach(limb => {
        updateLimbPhysics(limb, state.position, deltaTime);
    // Update the state in the map (state object was modified by reference throughout)
    setPlayerPhysicsState(clientId, state);
}
