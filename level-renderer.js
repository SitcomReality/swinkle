/**
 * level-renderer.js
 * Handles rendering the static level geometry (obstacles).
 */
import { getCurrentLevel } from './level-manager.js';
// Import transition state checkers and getters
import { isTransitionActive, getTransitionPhase, getOldLevelData, getNewLevelData, getProgress } from './level-transition.js';

/**
 * Renders the current level's obstacles onto the canvas, handling transitions.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 */
export function renderLevel(ctx) {
    if (isTransitionActive()) {
        renderTransitioningObstacles(ctx);
    } else {
        // When not transitioning, get the current level data from the manager
        // This data should be the correct (new) level after the transition finishes
        const levelData = getCurrentLevel();
        renderStableObstacles(ctx, levelData);
    }
}

/**
 * Renders obstacles during a level transition.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 */
function renderTransitioningObstacles(ctx) {
    const phase = getTransitionPhase();
    const progress = getProgress(); // Progress within the current phase (0-1)

    ctx.save();

    if (phase === 'fade_out') {
        const oldLevel = getOldLevelData();
        if (oldLevel?.obstacles) {
            // Fade out: Rapid flickering / fade alpha
            const alpha = 1.0 - progress; // Simple fade
            // Ensure alpha doesn't go negative or above 1
            const clampedAlpha = Math.max(0, Math.min(1, alpha));
            const flicker = Math.random() > 0.3 ? 1 : 0; // Flicker effect
            ctx.globalAlpha = clampedAlpha * flicker;

            // Render only if alpha is positive to prevent the last flicker
            if (ctx.globalAlpha > 0) {
                oldLevel.obstacles.forEach(obstacle => {
                    if (obstacle.type === 'rectangle') {
                        renderRectangleObstacle(ctx, obstacle, 1.0); // Render at normal scale
                    }
                });
            }
        }
    } else if (phase === 'fade_in') {
        const newLevel = getNewLevelData();
        if (newLevel?.obstacles) {
            // Fade in: Zoom/Scale effect
            // Ease-out scaling: Start fast, slow down
            const scale = Math.sin(progress * Math.PI / 2);
             // Ensure alpha doesn't go negative or above 1
            const clampedAlpha = Math.max(0, Math.min(1, scale));
            ctx.globalAlpha = clampedAlpha; // Fade in alpha as well

            newLevel.obstacles.forEach(obstacle => {
                if (obstacle.type === 'rectangle') {
                    renderRectangleObstacle(ctx, obstacle, scale); // Render scaled
                }
            });
        }
    }

    ctx.restore(); // Restore globalAlpha etc.
}

/**
 * Renders obstacles when no transition is active.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {object} levelData - The level data to render (obtained via getCurrentLevel).
 */
function renderStableObstacles(ctx, levelData) {
    if (!levelData || !levelData.obstacles) {
        // console.warn("No stable level data or obstacles found to render."); // Reduce noise
        return;
    }

    ctx.save(); // Save context state before drawing level
    ctx.globalAlpha = 1.0; // Ensure full opacity

    levelData.obstacles.forEach(obstacle => {
        if (obstacle.type === 'rectangle') {
            renderRectangleObstacle(ctx, obstacle, 1.0); // Render at normal scale
        } else {
            console.warn(`Unsupported obstacle type: ${obstacle.type}`);
        }
    });

    ctx.restore(); // Restore context state
}


/**
 * Renders a single rectangular obstacle, handling optional rotation and scaling.
 * @private
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {object} obstacle - The obstacle data object { x, y, width, height, color, angle }.
 * @param {number} scale - The scaling factor for the obstacle (1.0 for normal size).
 */
function renderRectangleObstacle(ctx, obstacle, scale = 1.0) {
    const { x, y, width, height, color, angle } = obstacle;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
        console.warn("Invalid dimensions for rectangle obstacle:", obstacle.id);
        return;
    }
    // Don't render if scale is effectively zero or negative
    if (scale <= 0.001) return;

    ctx.save(); // Save context for potential rotation/scaling

    // Translate to the obstacle's center
    ctx.translate(x, y);
    // Apply rotation if specified
    if (typeof angle === 'number') {
        ctx.rotate(angle);
    }
    // Apply scaling (relative to the center)
    ctx.scale(scale, scale);

    ctx.fillStyle = color || '#555577'; // Default color if none provided
    // Draw centered rectangle (relative to the translated, rotated, and scaled origin)
    ctx.fillRect(-width / 2, -height / 2, width, height);

    // Optional: Add a subtle stroke for definition (scale linewidth?)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    // Prevent stroke width from becoming infinite when scale is near zero
    ctx.lineWidth = scale > 0.01 ? 1 / scale : 100; // Keep stroke visually consistent, large value if scale is tiny
    ctx.strokeRect(-width / 2, -height / 2, width, height);

    ctx.restore(); // Restore context (removes translation, rotation, scaling)
}

// Potential future extension: renderCircleObstacle, renderPolygonObstacle, etc.