/**
 * effectsRenderer.js
 * Manages and renders temporary visual effects like droplet splats.
 */
import config from 'config';

const activeEffects = new Map(); // Store effects: { id, type, x, y, color, startTime, duration, ...otherProps }
let effectCounter = 0; // Simple unique ID generation

/**
 * Adds a new visual effect to be rendered.
 * @param {string} type - The type of effect (e.g., 'splat', 'stealSpark', 'blockSpark', 'respawnSparkle').
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
        case 'stealSpark': // Also used for can pickup and powerup collect
            duration = config.stealSparkEffectDuration || 300;
            break;
        case 'blockSpark': // For shield blocks
             duration = config.blockSparkEffectDuration || 250;
             break;
        case 'respawnSparkle': // For player respawn
             duration = 600; // Slightly longer duration for respawn
             break;
        default:
            console.warn(`Unknown effect type: ${type}`);
            return; // Don't add unknown effects
        }

    // Basic validation
    if (typeof duration !== 'number' || duration <= 0) {
        console.warn(`Invalid duration for effect type ${type}:`, duration);
        return;
    }
     if (typeof properties.x !== 'number' || typeof properties.y !== 'number') {
         console.warn(`Invalid position for effect type ${type}:`, properties);
         return;
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

        // Validate calculated age and duration before proceeding
        if (typeof age !== 'number' || typeof effect.duration !== 'number' || effect.duration <= 0) {
             console.warn(`Invalid age or duration for effect ${effect.id}. Removing.`, { age, duration: effect.duration });
             effectsToRemove.push(effect.id);
             return;
        }


        if (age >= effect.duration) {
            effectsToRemove.push(effect.id);
            return; // Skip rendering expired effects
        }

        // Ensure progress is clamped between 0 and 1 to avoid potential issues
        const progress = Math.max(0, Math.min(1, age / effect.duration));

        // Render based on type
        switch (effect.type) {
            case 'splat':
                renderSplat(ctx, effect, progress);
                break;
            case 'stealSpark':
                renderStealSpark(ctx, effect, progress);
                break;
            case 'blockSpark':
                 renderBlockSpark(ctx, effect, progress);
                 break;
            case 'respawnSparkle':
                 renderRespawnSparkle(ctx, effect, progress);
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
    // Ensure radius is non-negative
    const currentRadius = Math.max(0, maxRadius * Math.sin(progress * Math.PI / 2)); // Ease-out expansion

    // Calculate current opacity (fade out)
    const opacity = 1 - progress;

    ctx.beginPath();
    ctx.arc(effect.x, effect.y, currentRadius, 0, Math.PI * 2);
    ctx.fillStyle = effect.color || '#FF0000'; // Added default color
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
    // Ensure radius is non-negative
    const currentRadius = Math.max(0, maxRadius * progress); // Linear expansion
    const opacity = 1 - progress; // Linear fade out
    // Ensure line width is non-negative
    const currentLineWidth = Math.max(0.1, 3 * (1 - progress)); // Line gets thinner, ensure min width 0.1

    // Only draw if radius is positive
    if (currentRadius > 0 && currentLineWidth > 0) {
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, currentRadius, 0, Math.PI * 2);
        ctx.strokeStyle = config.stealSparkColor || '#FFFF00';
        ctx.lineWidth = currentLineWidth;
        ctx.globalAlpha = Math.max(0, opacity);
        ctx.stroke();
    }
    ctx.globalAlpha = 1.0; // Reset alpha
}

/**
 * Renders a shield block spark effect (e.g., expanding white cross/spark).
 * @private
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {object} effect - The block spark effect object.
 * @param {number} progress - The normalized age of the effect (0 to 1).
 */
function renderBlockSpark(ctx, effect, progress) {
    const maxRadius = config.blockSparkRadius || 15;
    const currentRadius = Math.max(0, maxRadius * progress); // Linear expansion
    const opacity = 1 - progress; // Linear fade out
    const lineWidth = Math.max(0.1, 4 * (1 - progress)); // Thick lines fading out

    if (currentRadius > 0 && lineWidth > 0) {
        ctx.save();
        ctx.translate(effect.x, effect.y);
        ctx.strokeStyle = config.blockSparkColor || '#FFFFFF';
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = Math.max(0, opacity);
        ctx.lineCap = 'round';

        // Draw a 4-pointed star/cross
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2); // Rotate 90 degrees for each line
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, currentRadius);
            ctx.stroke();
        }

        ctx.restore();
    }
    ctx.globalAlpha = 1.0; // Reset alpha
    ctx.lineCap = 'butt'; // Reset line cap
}

/**
 * Renders a respawn sparkle effect (e.g., multiple outward moving particles).
 * @private
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {object} effect - The respawn sparkle effect object.
 * @param {number} progress - The normalized age of the effect (0 to 1).
 */
function renderRespawnSparkle(ctx, effect, progress) {
    const particleCount = 8;
    const maxRadius = 40; // How far particles travel
    const startSize = 5;
    const endSize = 1;
    const color = '#FFFFFF';

    // Ease-out progress for movement, linear for alpha/size fade
    const movementProgress = Math.sin(progress * Math.PI / 2);
    const fadeProgress = progress;

    const currentRadius = maxRadius * movementProgress;
    const currentSize = startSize + (endSize - startSize) * fadeProgress;
    const currentAlpha = 1.0 - fadeProgress;

    if (currentSize <= 0 || currentAlpha <= 0) return;

    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = Math.max(0, currentAlpha);
    ctx.shadowBlur = 5;
    ctx.shadowColor = color;

    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const particleX = effect.x + Math.cos(angle) * currentRadius;
        const particleY = effect.y + Math.sin(angle) * currentRadius;

        ctx.beginPath();
        ctx.arc(particleX, particleY, Math.max(0.1, currentSize), 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1.0; // Reset global alpha explicitly
}

/**
 * Clears all active effects. Useful for game resets etc.
 */
export function clearEffects() {
    activeEffects.clear();
}