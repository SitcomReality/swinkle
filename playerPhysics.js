/**
 * playerPhysics.js
 * Handles physics calculations for the player body and limbs.
 */
import config from './config.js';
import { ensurePhysicsState, getPlayerPhysicsState, setPlayerPhysicsState } from './playerState.js';
import { handlePlayerLevelCollision } from './level-collision.js'; // Import level collision handler

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
 * Also handles collision with level geometry.
 *
 * @param {string} clientId - The ID of the player to update.
 * @param {object} presence - The player's presence data (containing anchor x, y).
 * @param {number} deltaTime - Time elapsed since the last frame in seconds.
 */
export function updatePlayerPhysics(clientId, presence, deltaTime) {
    // ... (fetch state, calculate linear forces/velocity/position as before) ...
    if (!presence || typeof presence.x !== 'number' || typeof presence.y !== 'number') {
        return; // Need anchor position
    }

    const anchorPos = { x: presence.x, y: presence.y };
    const state = ensurePhysicsState(clientId, anchorPos);

    // --- Body Linear Physics (Position/Velocity) ---
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

    // --- Body Angular Physics (Rotation) ---
    const inertia = config.playerRotationalInertia;
    const uprightStrength = config.playerUprightingStrength;
    const rotationalDamping = config.playerRotationalDamping; // Using config value directly now
    const bodyHeight = config.playerBodyHeight || 30; // Need body height for torque calculation

    // Torque calculation
    // 1. Uprighting torque (tries to return angle to 0)
    const uprightingTorque = -state.angle * uprightStrength;
    // 2. Damping torque (resists angular velocity)
    const dampingTorque = -state.angularVelocity * rotationalDamping; // Direct multiplication might be too strong, consider pow later if needed

    // 3. Torque from Bungee Cord
    // Assume bungee attaches near the top-center of the capsule.
    // Vector from center of mass (state.position) to attachment point in local coords: (0, -bodyHeight/2)
    // Rotate this vector by state.angle to get world-space offset vector r_world
    const cosAngle = Math.cos(state.angle);
    const sinAngle = Math.sin(state.angle);
    const attachmentOffsetY_local = -bodyHeight / 2; // Relative to body center (0,0)
    const r_world_x = -attachmentOffsetY_local * sinAngle; // -( -h/2 * sin) = h/2 * sin
    const r_world_y = attachmentOffsetY_local * cosAngle; // -h/2 * cos

    // Torque = r x F = r_world_x * F_y - r_world_y * F_x
    // Use the bungee spring force calculated earlier (springForceX, springForceY)
    const bungeeTorque = r_world_x * springForceY - r_world_y * springForceX;
    // Optional: Scale bungee torque if it feels too strong/weak
    const bungeeTorqueFactor = config.playerBungeeTorqueFactor ?? 1.0; // Default to 1 if not in config

    // (Ignoring collision torque for now)
    const totalTorque = uprightingTorque + dampingTorque + (bungeeTorque * bungeeTorqueFactor);

    // Angular acceleration = Torque / Inertia
    const angularAcceleration = totalTorque / inertia;

    // Update angular velocity
    state.angularVelocity += angularAcceleration * deltaTime;

    // Apply angular damping (Alternative: using pow like linear damping)
    // const angularDampingFactor = config.playerRotationalDampingFactor ?? 0.98; // Needs a different config value
    // state.angularVelocity *= Math.pow(angularDampingFactor, deltaTime * 60);

    // Update angle
    state.angle += state.angularVelocity * deltaTime;

    // Normalize angle to stay within -PI to PI (optional, but can prevent large numbers)
    // state.angle = (state.angle + Math.PI) % (2 * Math.PI) - Math.PI;


    // --- Level Collision Check and Response (Body) ---
    // TODO: Collision response *should* ideally affect angular velocity too, but that's complex.
    handlePlayerLevelCollision(state);

    // --- Constraints (Post-Collision) ---
    // Max Length Constraint for Bungee (applied AFTER potential level collision adjustment)
    // ... (Max length constraint code remains the same) ...
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
    // Pass the final, collision-adjusted body position AND angle to limb physics calculations
    state.limbs.forEach(limb => {
        updateLimbPhysics(limb, state.position, state.angle, deltaTime);
        // TODO: Add limb-level collision later if desired
    });

    // Update the state in the map (state object was modified by reference throughout)
    setPlayerPhysicsState(clientId, state);
}