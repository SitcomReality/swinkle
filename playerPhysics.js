/**
 * playerPhysics.js
 * Handles physics calculations for the player body and limbs.
 */
import config from './config.js';
import { ensurePhysicsState, getPlayerPhysicsState, setPlayerPhysicsState } from './playerState.js';
import { handlePlayerLevelCollision } from './level-collision.js'; // Import level collision handler
import { getSpectatorAnchorPosition } from './spectate-mode.js'; // Import spectator anchor logic

/**
 * Updates the physics simulation for a single limb.
 * @param {object} limbState - The state object for the limb { attachmentOffset, position, velocity }.
 * @param {object} bodyPos - The current position of the player's body {x, y}.
 * @param {number} bodyAngle - The current angle of the player's body (radians).
 * @param {number} deltaTime - Time elapsed since the last frame in seconds.
 */
function updateLimbPhysics(limbState, bodyPos, bodyAngle, deltaTime) {
    // Physics Constants from Config (specific to limbs)
    const k = config.limbSpringConstant;
    const restLength = config.limbLength; // Limbs try to maintain this length
    const damping = config.limbDampingFactor;
    const gravity = config.gravityAcceleration * config.limbGravityFactor; // Limbs might be affected less by gravity
    const mass = config.limbMass;
    const maxLength = restLength * config.limbMaxLengthMultiplier;

    // Calculate the absolute world position of the attachment point, considering body rotation
    const cosAngle = Math.cos(bodyAngle);
    const sinAngle = Math.sin(bodyAngle);
    const rotatedOffsetX = limbState.attachmentOffset.x * cosAngle - limbState.attachmentOffset.y * sinAngle;
    const rotatedOffsetY = limbState.attachmentOffset.x * sinAngle + limbState.attachmentOffset.y * cosAngle;

    const attachmentPoint = {
        x: bodyPos.x + rotatedOffsetX,
        y: bodyPos.y + rotatedOffsetY,
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
 * Updates the player's body physics state based on bungee forces, gravity, damping, and rotation.
 * Also handles collision with level geometry and applies the 'springyBungee' power-up effect.
 * Accounts for spectator mode anchor point logic.
 *
 * @param {string} clientId - The ID of the player to update.
 * @param {object} presence - The player's presence data (containing anchor x, y, and power-up states like springyBungee, isSpectating).
 * @param {number} deltaTime - Time elapsed since the last frame in seconds.
 */
export function updatePlayerPhysics(clientId, presence, deltaTime) {
    if (!presence) return; // Need presence for state checks

    let anchorPos;
    // Determine anchor point based on spectating state
    if (presence.isSpectating) {
        // Spectator mode: Anchor point is determined by spectator logic
        anchorPos = getSpectatorAnchorPosition(clientId, deltaTime);
    } else {
        // Normal mode: Anchor point follows cursor (presence.x, presence.y)
        if (typeof presence.x !== 'number' || typeof presence.y !== 'number') {
             console.warn(`Player ${clientId} is not spectating but has invalid anchor coordinates.`);
             // Use last known good position or default? Fallback to center for now.
             anchorPos = { x: config.gameAreaWidth / 2, y: config.gameAreaHeight / 2 };
        } else {
             anchorPos = { x: presence.x, y: presence.y };
        }
    }

    const state = ensurePhysicsState(clientId, anchorPos); // Ensure state exists, pass determined anchor for initialization if needed
    const isSpringy = presence.springyBungee || false; // Check for springy power-up

    // --- Body Linear Physics (Position/Velocity) ---
    // Adjust spring constant based on power-up
    const baseK = config.bungeeSpringConstant;
    const k = isSpringy ? baseK * config.springyBungeeMultiplier : baseK;

    const restLength = config.bungeeRestLength;
    const damping = config.bungeeDampingFactor;
    const gravity = config.gravityAcceleration;
    const mass = config.playerBodyMass || 1;
    const maxLength = restLength * (config.bungeeMaxLengthMultiplier || 50); // Adjusted default

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

    // --- Body Angular Physics (Rotation) ---
    const inertia = config.playerRotationalInertia;
    const uprightStrength = config.playerUprightingStrength;
    const rotationalDamping = config.playerRotationalDamping;
    const bodyHeight = config.playerBodyHeight || 30;

    // Torque calculation
    const uprightingTorque = -state.angle * uprightStrength;
    const dampingTorque = -state.angularVelocity * rotationalDamping;

    const cosAngle = Math.cos(state.angle);
    const sinAngle = Math.sin(state.angle);
    const attachmentOffsetY_local = -bodyHeight / 2;
    const r_world_x = -attachmentOffsetY_local * sinAngle;
    const r_world_y = attachmentOffsetY_local * cosAngle;

    const bungeeTorque = r_world_x * springForceY - r_world_y * springForceX;
    const bungeeTorqueFactor = config.playerBungeeTorqueFactor ?? 1.0;

    const totalTorque = uprightingTorque + dampingTorque + (bungeeTorque * bungeeTorqueFactor);
    const angularAcceleration = totalTorque / inertia;
    state.angularVelocity += angularAcceleration * deltaTime;
    state.angle += state.angularVelocity * deltaTime;

    // --- Level Collision Check and Response (Body) ---
    // Disable level collision for spectators
    if (!presence.isSpectating) {
        handlePlayerLevelCollision(state);
    }

    // --- Constraints (Post-Collision) ---
    // Max Length Constraint for Bungee
    const finalDx = anchorPos.x - state.position.x;
    const finalDy = anchorPos.y - state.position.y;
    const finalDistance = Math.sqrt(finalDx * finalDx + finalDy * finalDy);

    if (finalDistance > maxLength) {
        const clampRatio = maxLength / finalDistance;
        state.position.x = anchorPos.x - finalDx * clampRatio;
        state.position.y = anchorPos.y - finalDy * clampRatio;

        // Dampen velocity component moving away from the anchor point
        const cordDirX = finalDx / finalDistance;
        const cordDirY = finalDy / finalDistance;
        const dotProduct = state.velocity.x * cordDirX + state.velocity.y * cordDirY;
        if (dotProduct > 0) {
            state.velocity.x -= dotProduct * cordDirX;
            state.velocity.y -= dotProduct * cordDirY;
        }
    }

    // --- Update Limb Physics ---
    // Limbs still dangle even in spectate mode
    state.limbs.forEach(limb => {
        updateLimbPhysics(limb, state.position, state.angle, deltaTime);
    });

    // Update the state in the map
    setPlayerPhysicsState(clientId, state);
}