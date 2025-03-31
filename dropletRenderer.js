/**
 * dropletRenderer.js
 * Handles rendering all active paint droplets.
 */
import config from 'config';

/**
 * Renders all droplets currently in the game state.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {object} droplets - The droplets object from roomState.droplets.
 * @param {number} now - The current timestamp (Date.now()) for age calculation.
 */
export function renderDroplets(ctx, droplets, now) {
    // const dropletsToRemove = {}; // No authoritative removal here yet (Step 7)

    Object.entries(droplets).forEach(([id, droplet]) => {
        if (!droplet) return; // Skip if droplet data is null (already removed or invalid)

        const age = now - droplet.createdAt;
        const duration = config.dropletDuration || 2000;

        // Client-side visual removal on timeout
        if (age > duration) {
            // dropletsToRemove[id] = null; // Mark for removal - DISABLED FOR NOW (Step 7)
            return; // Don't render expired droplets
        }

        // Draw the droplet particle (simple circle for now)
        ctx.beginPath();
        // Fade out effect based on age
        const lifeRatio = 1 - (age / duration);
        // Start fading after half life maybe? Or fade linearly from start? Let's do linear fade.
        // ctx.globalAlpha = Math.max(0, Math.min(1, lifeRatio * 2)); // Fade out in last half
        ctx.globalAlpha = Math.max(0, Math.min(1, lifeRatio)); // Linear fade out
        ctx.arc(droplet.x, droplet.y, config.dropletSize || 3, 0, Math.PI * 2); // Use dropletSize, default 3
        ctx.fillStyle = droplet.color || config.dropletColor || '#0FF'; // Use dropletColor from state or config default
        ctx.fill();
    });

    ctx.globalAlpha = 1.0; // Reset global alpha IMPORTANT!

    // Request removal of expired droplets from roomState - Moved to Step 7 / Hit detection
    // if (Object.keys(dropletsToRemove).length > 0) {
    //     roomInstance.updateRoomState({ droplets: dropletsToRemove }); // Needs roomInstance passed in or handled elsewhere
    // }
}