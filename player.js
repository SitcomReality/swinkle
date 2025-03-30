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
 * @param {object} presence - The player's presence data (x, y anchor, color, etc.).
 * @param {object} peer - The player's peer data (username, avatarUrl).
 */
export function renderPlayer(ctx, clientId, presence, peer) {
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

    // --- Render Player Body (based on physics) ---
    ctx.beginPath();
    ctx.arc(bodyX, bodyY, config.playerBodyRadius || 15, 0, Math.PI * 2);
    ctx.fillStyle = config.playerBodyColor || '#FFAABB';
    ctx.fill();
    ctx.strokeStyle = config.playerBodyStrokeColor || '#FF88AA';
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- Render Player Name ---
    ctx.fillStyle = config.nameColor || '#FFF';
    ctx.font = config.nameFont || '12px sans-serif';
    ctx.textAlign = 'center';
    // Position name below the physics body
    ctx.fillText(peer.username, bodyX, bodyY + (config.playerBodyRadius || 15) + 14);
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

    // Calculate Spring Force (Hooke's Law: F = -kx, applied along the dx/dy direction)
    // Only apply spring force if stretched beyond rest length
    let springForceX = 0;
    let springForceY = 0;
    if (stretch > 0 && distance > 0.01) { // Avoid division by zero if distance is tiny
        const forceMagnitude = k * stretch;
        springForceX = (dx / distance) * forceMagnitude;
        springForceY = (dy / distance) * forceMagnitude;
    }

    // Calculate Gravity Force
    const gravityForceY = gravity * mass; // Gravity acts downwards

    // Calculate Damping Force (Opposes velocity: F = -c * v)
    // Note: A simple velocity scaling factor is used here instead of a strict damping constant 'c'.
    // This provides a more intuitive damping effect (0=no damping, 1=immediate stop).
    // We apply it *after* calculating new velocity based on forces.

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
    state.velocity.x *= damping;
    state.velocity.y *= damping;

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