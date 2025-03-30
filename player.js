/**
 * player.js
 * Handles player character rendering and logic.
 */
import config from 'config';

// Basic placeholder structure for player data
// This will evolve to include physics state (velocity, bungee attachment, etc.)
const playerState = {
    body: { x: 0, y: 0 }, // Will eventually dangle below the anchor point
    // Add properties for eyes, limbs, physics state later
};

/**
 * Renders a single player character.
 * Placeholder implementation - draws a simple shape for now.
 *
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {object} presence - The player's presence data (x, y anchor, color, etc.).
 * @param {object} peer - The player's peer data (username, avatarUrl).
 */
export function renderPlayer(ctx, presence, peer) {
    if (!presence || typeof presence.x !== 'number' || typeof presence.y !== 'number') {
        return; // Don't render if position data is missing
    }

    const anchorX = presence.x;
    const anchorY = presence.y;
    const color = presence.color || config.defaultPlayerColor || '#FFF';

    // --- Render Anchor Point (formerly the cursor) ---
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, config.cursorSize || 8, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // Add a subtle outline
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();

    // --- Render Placeholder Character Body ---
    // For now, just draw a circle slightly below the anchor
    // This will be replaced with the SVG character and bungee physics later
    const bodyX = anchorX; // Simple positioning for now
    const bodyY = anchorY + 20; // Offset below the anchor
    const bodyRadius = 15;

    ctx.beginPath();
    ctx.arc(bodyX, bodyY, bodyRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFAABB'; // Temporary placeholder color
    ctx.fill();
    ctx.strokeStyle = '#FF88AA';
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- Render Player Name ---
    ctx.fillStyle = config.nameColor || '#FFF';
    ctx.font = config.nameFont || '12px sans-serif';
    ctx.textAlign = 'center';
    // Position name below the placeholder body
    ctx.fillText(peer.username, bodyX, bodyY + bodyRadius + 14);
}

/**
 * Updates the player's physics state (Placeholder).
 * This will handle bungee calculations later.
 *
 * @param {number} deltaTime - Time elapsed since the last frame.
 */
export function updatePlayerPhysics(deltaTime) {
    // Placeholder for physics simulation (spring, gravity, damping)
}