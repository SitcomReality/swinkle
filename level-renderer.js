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
 * Renders a single rectangular obstacle.
 * @private
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {object} obstacle - The obstacle data object.
 */
function renderRectangleObstacle(ctx, obstacle) {
    const { x, y, width, height, color } = obstacle;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
        console.warn("Invalid dimensions for rectangle obstacle:", obstacle.id);
        return;
    }

    ctx.fillStyle = color || '#555577'; // Default color if none provided
    // Draw centered rectangle
    ctx.fillRect(x - width / 2, y - height / 2, width, height);

    // Optional: Add a subtle stroke for definition
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - width / 2, y - height / 2, width, height);
}

// Potential future extension: renderCircleObstacle, renderPolygonObstacle, etc.