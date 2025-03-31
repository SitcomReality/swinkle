/**
 * effectsRenderer.js
 * Manages and renders temporary visual effects like droplet splats.
 */
import config from 'config';

const activeEffects = new Map(); // Store effects: { id, type, x, y, color, startTime, duration, ...otherProps }
let effectCounter = 0; // Simple unique ID generation

/**
 * Adds a new visual effect to be rendered.
 * @param {string} type - The type of effect (e.g., 'splat', 'stealSpark').
 * @param {object} properties - Properties specific to the effect (x, y, color, etc.).
 */
export function addEffect(type, properties) {
    const id = `effect-${effectCounter++}`;
    const now = Date.now();
    let duration;

    switch (type) {
        case 'splat':
            duration = config.splatEffectDuration || 500;
            break;
        case 'stealSpark':
            duration = config.stealSparkEffectDuration || 300;
            break;
        default:
            console.warn(`Unknown effect type: ${type}`);
            return; // Don't add unknown effects
        }

    activeEffects.set(id, {
        id,
        type,
        ...properties, // Includes x, y, potentially color
        startTime: now,
        duration: duration,
    });
}

/**
 * Updates and renders all active effects. Removes expired effects.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {number} deltaTime - Time elapsed since the last frame in seconds (unused for now, but good practice).
 * @param {number} now - The current timestamp (Date.now()).
 */
export function updateAndRenderEffects(ctx, deltaTime, now) {
    const effectsToRemove = [];
    ctx.save(); // Save context state before drawing effects

    activeEffects.forEach(effect => {
        const age = now - effect.startTime;
        if (age >= effect.duration) {
            effectsToRemove.push(effect.id);
            return; // Skip rendering expired effects
        }

        const progress = age / effect.duration; // 0 to 1

        // Render based on type
        switch (effect.type) {
            case 'splat':
                renderSplat(ctx, effect, progress);
                break;
            case 'stealSpark':
                renderStealSpark(ctx, effect, progress);
                break;
            // Add other types here
        }
    });

    // Clean up expired effects
    effectsToRemove.forEach(id => activeEffects.delete(id));

    // Reset any global context changes if necessary (e.g., globalAlpha)
    ctx.restore(); // Restore context state
}

/**
 * Renders a single splat effect.
 * @private
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {object} effect - The splat effect object.
 * @param {number} progress - The normalized age of the effect (0 to 1).
 */
function renderSplat(ctx, effect, progress) {
    // Calculate current radius (expands quickly then stops/shrinks?)
    // Simple linear expansion for now
    const maxRadius = config.splatEffectMaxRadius || 15;
    const currentRadius = maxRadius * Math.sin(progress * Math.PI / 2); // Ease-out expansion

    // Calculate current opacity (fade out)
    const opacity = 1 - progress;

    ctx.beginPath();
    ctx.arc(effect.x, effect.y, currentRadius, 0, Math.PI * 2);
    ctx.fillStyle = effect.color;
    ctx.globalAlpha = Math.max(0, opacity); // Apply fade out
    ctx.fill();
    ctx.globalAlpha = 1.0; // Reset alpha for next effect
}

/**
 * Renders a steal spark effect (e.g., expanding yellow circle).
 * @private
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {object} effect - The steal spark effect object.
 * @param {number} progress - The normalized age of the effect (0 to 1).
 */
function renderStealSpark(ctx, effect, progress) {
    const maxRadius = config.stealSparkRadius || 20;
    const currentRadius = maxRadius * progress; // Linear expansion
    const opacity = 1 - progress; // Linear fade out

    ctx.beginPath();
    ctx.arc(effect.x, effect.y, currentRadius, 0, Math.PI * 2);
    ctx.strokeStyle = config.stealSparkColor || '#FFFF00';
    ctx.lineWidth = 3 * (1 - progress); // Line gets thinner as it expands/fades
    ctx.globalAlpha = Math.max(0, opacity);
    ctx.stroke();
    ctx.globalAlpha = 1.0; // Reset alpha
}

/**
 * Clears all active effects. Useful for game resets etc.
 */
export function clearEffects() {
    activeEffects.clear();
}