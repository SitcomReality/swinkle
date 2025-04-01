/**
 * boundary-renderer.js
 * Handles rendering the visual representation of the game area boundaries.
 */
import config from 'config';

/**
 * Renders the game boundaries onto the canvas.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 */
export function renderBoundaries(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; // Faint white lines
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]); // Dashed lines

    // Draw rectangle using game area config
    // Use strokeRect centered at 0,0 if needed, or adjust coordinates
    // Assuming top-left is 0,0 for the game world
    ctx.strokeRect(1, 1, config.gameAreaWidth - 2, config.gameAreaHeight - 2); // Inset slightly

    ctx.restore(); // Restore line dash, stroke style etc.
}