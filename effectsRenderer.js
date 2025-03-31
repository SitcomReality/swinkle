/**
 * effectsRenderer.js
 * Manages and renders temporary visual effects like droplet splats.
 */
import config from 'config';

const activeEffects = new Map(); // Store effects: { id, type, x, y, color, startTime, duration, ...otherProps }
let effectCounter = 0; // Simple unique ID generation

/**
 * Adds a new visual effect to be rendered.
 * @param {string} type - The type of effect (e.g., 'splat').
 * @param {object} properties - Properties specific to the effect (x, y, color, etc.).
 */
export function addEffect(type, properties) {
    const id = `effect-${effectCounter++}`;
    const now = Date.now();
    let duration;

    switch (type) {
        case 'splat':
            duration = config.splatEffectDuration || 500; // Default duration
            break;
        default:
            console.warn(`Unknown effect type: ${type}`);
            return; // Don't add unknown effects
        }
    
    activeEffects.set(id, {
        id,
        type,
        ...properties,
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

    activeEffects.forEach(effect => {
        const age = now - effect.startTime;
        if (age >= effect.duration) {
            effectsToRemove.push(effect.id);
            return; // Skip rendering expired effects
        }

        // Render based on type
        switch (effect.type) {
            case 'splat':
                renderSplat(ctx, effect, age);
                break;
            // Add other types here
        }
    });

    // Clean up expired effects
    effectsToRemove.forEach(id => activeEffects.delete(id));

    // Reset any global context changes if necessary (e.g., globalAlpha)
    ctx.globalAlpha = 1.0;
}

/**
 * Renders a single splat effect.
 * @private
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {object} effect - The splat effect object.
 * @param {number} age - The current age of the effect in milliseconds.
 */
function renderSplat(ctx, effect, age) {
    const progress = age / effect.duration; // 0 to 1

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
}

/**
 * Clears all active effects. Useful for game resets etc.
 */
export function clearEffects() {
    activeEffects.clear();
}