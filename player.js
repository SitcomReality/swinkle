/**
 * player.js
 * Handles player character rendering and physics simulation.
 */
import config from 'config';

// Stores the physics state for each player, keyed by clientId
// Each entry will have { position: {x, y}, velocity: {x, y} }
const playerPhysicsStates = new Map();

/**
 * Initializes the physics state for a player if it doesn't exist.
 * @param {string} clientId - The ID of the player.
 * @param {object} initialAnchorPos - The initial anchor position {x, y}.
 */
function ensurePhysicsState(clientId, initialAnchorPos) {
    if (!playerPhysicsStates.has(clientId)) {
        playerPhysicsStates.set(clientId, {
            // Start the body slightly below the anchor
            position: { x: initialAnchorPos.x, y: initialAnchorPos.y + config.bungeeRestLength },
            velocity: { x: 0, y: 0 },
        });
    }
    return playerPhysicsStates.get(clientId);
}

/**
 * Renders a single player character, including anchor, body, and bungee cord.
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

    // --- Get Physics State for Body ---
    // Initialize if necessary, using anchor position as reference
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
    // Start path for combined shape
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
 * Updates the player's physics state based on bungee forces, gravity, and damping.
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

    // Physics Constants from Config
    const k = config.bungeeSpringConstant;
    const restLength = config.bungeeRestLength;
    const damping = config.bungeeDampingFactor;
    const gravity = config.gravityAcceleration;
    const mass = config.playerBodyMass || 1; // Avoid division by zero

    // Calculate vector from body to anchor
    const dx = anchorPos.x - state.position.x;
    const dy = anchorPos.y - state.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const stretch = distance - restLength;

    // Calculate Spring Force (Hooke's Law: F = k * stretch, applied along the dx/dy direction)
    // Apply force whether stretching or compressing for a more stable bungee effect
    let springForceX = 0;
    let springForceY = 0;
    if (distance > 0.01) { // Avoid division by zero if distance is tiny
        // Note: We use stretch (positive for extension, negative for compression) directly
        const forceMagnitude = k * stretch;
        springForceX = (dx / distance) * forceMagnitude;
        springForceY = (dy / distance) * forceMagnitude;
    }

    // Calculate Gravity Force
    const gravityForceY = gravity * mass; // Gravity acts downwards

    // Calculate Total Force
    const totalForceX = springForceX;
    const totalForceY = springForceY + gravityForceY;

    // Calculate Acceleration (F = ma => a = F / m)
    const accelerationX = totalForceX / mass;
    const accelerationY = totalForceY / mass;

    // Update Velocity (v = v + a * dt)
    state.velocity.x += accelerationX * deltaTime;
    state.velocity.y += accelerationY * deltaTime;

    // Apply Damping Factor to Velocity
    // This effectively works like air resistance or internal friction in the bungee
    state.velocity.x *= Math.pow(damping, deltaTime * 60); // Scale damping by frame rate (assuming target 60fps)
    state.velocity.y *= Math.pow(damping, deltaTime * 60);


    // Update Position (p = p + v * dt)
    state.position.x += state.velocity.x * deltaTime;
    state.position.y += state.velocity.y * deltaTime;

    // (Optional) Add collision with floor/bounds later if needed
    // e.g., if (state.position.y > canvas.height - config.playerBodyRadius) { ... }

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