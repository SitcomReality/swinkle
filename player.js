/**
 * player.js
 * Handles player character rendering and physics simulation, including limbs.
 */
import config from 'config';

// Stores the physics state for each player, keyed by clientId
// Each entry will have { position: {x, y}, velocity: {x, y}, limbs: [...] }
const playerPhysicsStates = new Map();

/**
 * Gets the current physics state for a player.
 * Useful for accessing body position from other modules like game-loop.
 * @param {string} clientId - The ID of the player.
 * @returns {object | undefined} The physics state object or undefined if not found.
 */
export function getPlayerPhysicsState(clientId) {
    return playerPhysicsStates.get(clientId);
}

/**
 * Initializes the physics state for a player if it doesn't exist, including limbs.
 * @param {string} clientId - The ID of the player.
 * @param {object} initialAnchorPos - The initial anchor position {x, y}.
 */
function ensurePhysicsState(clientId, initialAnchorPos) {
    if (!playerPhysicsStates.has(clientId)) {
        const bodyInitialPos = { x: initialAnchorPos.x, y: initialAnchorPos.y + config.bungeeRestLength };
        const initialState = {
            position: { x: bodyInitialPos.x, y: bodyInitialPos.y },
            velocity: { x: 0, y: 0 },
            limbs: [],
        };

        // Initialize limbs based on config
        for (let i = 0; i < config.numberOfLimbs; i++) {
            // Distribute attachment points - simple example: alternate sides
            const side = i % 2 === 0 ? -1 : 1;
            const attachmentOffsetX = (config.playerBodyWidth / 3) * side;
            // Attach slightly below the vertical center
            const attachmentOffsetY = config.playerBodyHeight * 0.2;
            
            // Initial limb position: slightly below attachment point
            const initialLimbPos = {
                x: bodyInitialPos.x + attachmentOffsetX,
                y: bodyInitialPos.y + attachmentOffsetY + config.limbLength * 0.5 // Start somewhat extended
            };

            initialState.limbs.push({
                // Relative offset from the body's center (state.position)
                attachmentOffset: { x: attachmentOffsetX, y: attachmentOffsetY },
                // Current end position of the limb
                position: { x: initialLimbPos.x, y: initialLimbPos.y },
                // Current velocity of the limb end
                velocity: { x: 0, y: 0 },
            });
        }
        playerPhysicsStates.set(clientId, initialState);
    }
    return playerPhysicsStates.get(clientId);
}

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
}

/**
 * Renders a single player character, including anchor, body, bungee cord, and limbs.
 *
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {string} clientId - The ID of the player being rendered.
 * @param {string} localClientId - The ID of the current user's client.
 * @param {object} presence - The player's presence data (x, y anchor, color, etc.).
 * @param {object} peer - The player's peer data (username, avatarUrl).
 */
export function renderPlayer(ctx, clientId, localClientId, presence, peer) {
    if (!presence || typeof presence.x !== 'number' || typeof presence.y !== 'number') {
        return; // Don't render if position data is missing
    }

    const anchorX = presence.x;
    const anchorY = presence.y;
    const color = presence.color || config.defaultPlayerColor || '#FFF';

    // --- Render Anchor Point ---
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, config.cursorSize || 8, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();

    // --- Get Physics State (Body and Limbs) ---
    const physicsState = ensurePhysicsState(clientId, { x: anchorX, y: anchorY });
    const bodyX = physicsState.position.x;
    const bodyY = physicsState.position.y;

    // --- Render Bungee Cord ---
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(bodyX, bodyY);
    ctx.strokeStyle = config.bungeeCordColor || 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = config.bungeeCordWidth || 2;
    ctx.stroke();

    // --- Render Limbs (Behind Body) ---
    ctx.strokeStyle = config.limbColor;
    ctx.lineWidth = config.limbWidth;
    ctx.lineCap = 'round'; // Make limb ends rounded

    physicsState.limbs.forEach(limb => {
        const attachmentPointX = bodyX + limb.attachmentOffset.x;
        const attachmentPointY = bodyY + limb.attachmentOffset.y;
        ctx.beginPath();
        ctx.moveTo(attachmentPointX, attachmentPointY);
        ctx.lineTo(limb.position.x, limb.position.y);
        ctx.stroke();
    });
    ctx.lineCap = 'butt'; // Reset line cap

    // --- Render Player Body (Capsule Shape) ---
    const bodyWidth = config.playerBodyWidth || 20;
    const bodyHeight = config.playerBodyHeight || 30;
    const radius = bodyWidth / 2;
    const rectHeight = bodyHeight - bodyWidth; // Height of the rectangular part

    ctx.fillStyle = config.playerBodyColor || '#FFAABB';
    ctx.strokeStyle = config.playerBodyStrokeColor || '#FF88AA';
    ctx.lineWidth = 2;

    ctx.beginPath();
    // Draw the capsule shape
    ctx.moveTo(bodyX - radius, bodyY - rectHeight / 2); // Top-left corner of rect part
    ctx.arc(bodyX, bodyY - rectHeight / 2, radius, Math.PI, 0); // Top semicircle
    ctx.lineTo(bodyX + radius, bodyY + rectHeight / 2); // Right side of rect part
    ctx.arc(bodyX, bodyY + rectHeight / 2, radius, 0, Math.PI); // Bottom semicircle
    ctx.lineTo(bodyX - radius, bodyY - rectHeight / 2); // Left side of rect part
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // --- Render Eyes ---
    const eyeRadius = config.playerEyeRadius || 4;
    const eyeOffsetX = config.playerEyeOffsetX || 6;
    const eyeOffsetY = config.playerEyeOffsetY || -3; // Relative to body center (bodyY)
    const leftEyeX = bodyX - eyeOffsetX;
    const rightEyeX = bodyX + eyeOffsetX;
    const eyeY = bodyY + eyeOffsetY; // Both eyes at the same Y level

    ctx.fillStyle = '#FFFFFF'; // White part of the eye
    ctx.strokeStyle = '#000000'; // Black outline
    ctx.lineWidth = 1;

    // Left Eye (Sclera)
    ctx.beginPath();
    ctx.arc(leftEyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Right Eye (Sclera)
    ctx.beginPath();
    ctx.arc(rightEyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // --- Render Pupils (with tracking for local player) ---
    const pupilRadius = eyeRadius * 0.5;
    const maxPupilOffset = eyeRadius - pupilRadius - 1; // Ensure pupil stays within the white
    let pupilOffsetX = 0;
    let pupilOffsetY = 0;

    // Only track cursor for the local player
    if (clientId === localClientId) {
        // Calculate direction from eye center towards anchor (cursor)
        // Using an average eye position for simplicity
        const avgEyeX = bodyX;
        const dirX = anchorX - avgEyeX;
        const dirY = anchorY - eyeY;
        const dist = Math.sqrt(dirX * dirX + dirY * dirY);

        if (dist > 1) { // Avoid division by zero and jitter when close
            // Normalize the direction vector
            const normX = dirX / dist;
            const normY = dirY / dist;
            // Calculate offset, capped by maxPupilOffset
            pupilOffsetX = normX * maxPupilOffset;
            pupilOffsetY = normY * maxPupilOffset;
        }
    }
    // If not local player, offset is 0, pupils stay centered.

    ctx.fillStyle = '#000000';

    // Left Pupil
    ctx.beginPath();
    ctx.arc(leftEyeX + pupilOffsetX, eyeY + pupilOffsetY, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    // Right Pupil
    ctx.beginPath();
    ctx.arc(rightEyeX + pupilOffsetX, eyeY + pupilOffsetY, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    // --- Render Player Name ---
    ctx.fillStyle = config.nameColor || '#FFF';
    ctx.font = config.nameFont || '12px sans-serif';
    ctx.textAlign = 'center';
    // Position name below the physics body
    const nameYOffset = (bodyHeight / 2) + 14; // Adjust based on body height
    ctx.fillText(peer.username, bodyX, bodyY + nameYOffset);
}

/**
 * Updates the player's physics state based on bungee forces, gravity, damping, and updates limbs.
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
    });

    // Update the state in the map (though it's modified by reference)
    playerPhysicsStates.set(clientId, state);
}

/**
 * Removes the physics state for a player when they disconnect.
 * @param {string} clientId - The ID of the player who left.
 */
export function removePlayerPhysicsState(clientId) {
    playerPhysicsStates.delete(clientId);
    console.log(`Removed physics state for client ${clientId}`);
}