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
            const flicker = Math.random() > 0.3 ? 1 : 0; // Flicker effect
            ctx.globalAlpha = alpha * flicker;

            oldLevel.obstacles.forEach(obstacle => {
                if (obstacle.type === 'rectangle') {
                    renderRectangleObstacle(ctx, obstacle, 1.0); // Render at normal scale
                }
            });
        }
    } else if (phase === 'fade_in') {
        const newLevel = getNewLevelData();
        if (newLevel?.obstacles) {
            // Fade in: Zoom/Scale effect
            // Ease-out scaling: Start fast, slow down
            const scale = Math.sin(progress * Math.PI / 2);
            ctx.globalAlpha = scale; // Fade in alpha as well

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
 * @param {object} levelData - The level data to render.
 */
function renderStableObstacles(ctx, levelData) {
    if (!levelData || !levelData.obstacles) {
        // console.warn("No stable level data or obstacles found to render.");
        return; // Don't warn every frame
    }

    ctx.save(); // Save context state before drawing level

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
    ctx.lineWidth = 1 / scale; // Keep stroke visually consistent when scaling down
    ctx.strokeRect(-width / 2, -height / 2, width, height);

    ctx.restore(); // Restore context (removes translation, rotation, scaling)
}

// Potential future extension: renderCircleObstacle, renderPolygonObstacle, etc.