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
    const shouldGlow = config.dropletGlow;
    const glowBlur = config.neonGlowBlur || 10;

    Object.entries(droplets).forEach(([id, droplet]) => {
        if (!droplet) return; // Skip if droplet data is null (already removed or invalid)

        const age = now - droplet.createdAt;
        const duration = config.dropletDuration || 2000;

        // Client-side visual removal on timeout
        if (age > duration) {
            return; // Don't render expired droplets
        }

        const lifeRatio = 1 - (age / duration);
        const dropletColor = droplet.color || config.dropletColor || '#0FF';

        ctx.save(); // Save context state before drawing droplet

        // Fade out effect based on age
        ctx.globalAlpha = Math.max(0, Math.min(1, lifeRatio)); // Linear fade out

        // Add glow effect
        if (shouldGlow) {
            ctx.shadowBlur = glowBlur;
            ctx.shadowColor = dropletColor; // Use droplet color for glow
        }

        // Draw the droplet particle
        ctx.beginPath();
        ctx.arc(droplet.x, droplet.y, config.dropletSize || 3, 0, Math.PI * 2);
        ctx.fillStyle = dropletColor;
        ctx.fill();

        ctx.restore(); // Restore context state (resets alpha, shadow)
    });
}