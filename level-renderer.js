/**
 * level-renderer.js
 * Handles rendering the static level geometry (obstacles).
 */
import { getCurrentLevel } from './level-manager.js';

/**
 * Renders the current level's obstacles onto the canvas.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 */
export function renderLevel(ctx) {
    const levelData = getCurrentLevel();
    if (!levelData || !levelData.obstacles) {
        console.warn("No level data or obstacles found to render.");
        return;
    }

    ctx.save(); // Save context state before drawing level

    levelData.obstacles.forEach(obstacle => {
        if (obstacle.type === 'rectangle') {
            renderRectangleObstacle(ctx, obstacle);
        } else {
            console.warn(`Unsupported obstacle type: ${obstacle.type}`);
        }
    });

    ctx.restore(); // Restore context state
}

/**
 * Renders a single rectangular obstacle, handling optional rotation.
 * @private
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {object} obstacle - The obstacle data object.
 */
function renderRectangleObstacle(ctx, obstacle) {
    const { x, y, width, height, color, angle } = obstacle; // Include angle
    if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
        console.warn("Invalid dimensions for rectangle obstacle:", obstacle.id);
        return;
    }

    ctx.save(); // Save context for potential rotation

    // Translate to the obstacle's center and apply rotation if specified
    ctx.translate(x, y);
    if (typeof angle === 'number') {
        ctx.rotate(angle);
    }

    ctx.fillStyle = color || '#555577'; // Default color if none provided
    // Draw centered rectangle (relative to the translated and rotated origin)
    ctx.fillRect(-width / 2, -height / 2, width, height);

    // Optional: Add a subtle stroke for definition
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-width / 2, -height / 2, width, height);

    ctx.restore(); // Restore context (removes translation and rotation)
}

// Potential future extension: renderCircleObstacle, renderPolygonObstacle, etc.