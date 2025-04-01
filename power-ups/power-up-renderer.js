/**
 * power-up-renderer.js
 * Handles rendering power-up objects in the game world.
 */
import { powerUpDefinitions } from './power-up-data.js';

/**
 * Renders a power-up in the game world
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
 * @param {object} powerUp - The power-up object to render
 * @param {number} now - Current timestamp for animations
 */
export function renderPowerUp(ctx, powerUp, now) {
    if (!powerUp || !powerUp.id || !powerUp.x || !powerUp.y) return;

    // Get the definition for this power-up type
    const definition = powerUpDefinitions[powerUp.typeId];
    if (!definition) return;

    const x = powerUp.x;
    const y = powerUp.y;
    const size = definition.size || 20;
    const color = definition.color || '#FFFFFF';
    const glowColor = definition.glowColor || color;

    // Create a pulsing/bobbing effect
    const age = now - powerUp.createdAt;
    const pulseSpeed = 0.003; // Speed of the pulse
    const pulseAmount = 0.15;  // How much size varies
    const pulseFactor = 1 + pulseAmount * Math.sin(age * pulseSpeed);

    // Calculate bobbing motion
    const bobSpeed = 0.002; // Speed of bobbing
    const bobAmount = 5; // How much it moves up/down
    const bobOffset = Math.sin(age * bobSpeed) * bobAmount;

    // Save context for transformations
    ctx.save();

    // Apply glow effect
    ctx.shadowBlur = 15;
    ctx.shadowColor = glowColor;

    // Draw the power-up based on its icon type
    ctx.fillStyle = color;

    // Apply scale and bob
    const renderSize = size * pulseFactor;
    const renderY = y + bobOffset;

    switch (definition.icon) {
        case 'shield':
            drawShieldIcon(ctx, x, renderY, renderSize);
            break;
        case 'droplet':
            drawDropletIcon(ctx, x, renderY, renderSize);
            break;
        case 'spring':
            drawSpringIcon(ctx, x, renderY, renderSize);
            break;
        case 'can':
            drawCanIcon(ctx, x, renderY, renderSize);
            break;
        case 'rope': 
            drawRopeIcon(ctx, x, renderY, renderSize);
            break;
        case 'burst': 
            drawBurstIcon(ctx, x, renderY, renderSize);
            break;
        default:
            // Default star shape
            drawStarIcon(ctx, x, renderY, renderSize);
    }

    // Restore context
    ctx.restore();
}

// Helper drawing functions for different power-up icons
function drawShieldIcon(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y - size/2);
    ctx.lineTo(x + size/2, y - size/4);
    ctx.lineTo(x + size/2, y + size/4);
    ctx.lineTo(x, y + size/2);
    ctx.lineTo(x - size/2, y + size/4);
    ctx.lineTo(x - size/2, y - size/4);
    ctx.closePath();
    ctx.fill();

    // Inner detail
    ctx.beginPath();
    ctx.arc(x, y, size/4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fill();
}

function drawDropletIcon(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y - size/2);
    ctx.bezierCurveTo(
        x + size/2, y - size/4,
        x + size/2, y + size/4,
        x, y + size/2
    );
    ctx.bezierCurveTo(
        x - size/2, y + size/4,
        x - size/2, y - size/4,
        x, y - size/2
    );
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.arc(x - size/5, y - size/5, size/8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fill();
}

function drawSpringIcon(ctx, x, y, size) {
    ctx.lineWidth = size/5;
    ctx.strokeStyle = ctx.fillStyle;

    // Draw zigzag spring
    ctx.beginPath();
    ctx.moveTo(x - size/2, y - size/3);
    ctx.lineTo(x + size/3, y - size/3);
    ctx.lineTo(x - size/3, y);
    ctx.lineTo(x + size/3, y);
    ctx.lineTo(x - size/3, y + size/3);
    ctx.lineTo(x + size/2, y + size/3);
    ctx.stroke();

    // Draw small circles at ends
    ctx.beginPath();
    ctx.arc(x - size/2, y - size/3, size/10, 0, Math.PI * 2);
    ctx.arc(x + size/2, y + size/3, size/10, 0, Math.PI * 2);
    ctx.fill();
}

function drawCanIcon(ctx, x, y, size) {
    // Can body
    ctx.fillRect(x - size/3, y - size/2, size*2/3, size);

    // Can top
    ctx.beginPath();
    ctx.ellipse(x, y - size/2, size/3, size/8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Paint splash
    ctx.beginPath();
    ctx.moveTo(x + size/5, y - size/2);
    ctx.lineTo(x + size/2, y - size);
    ctx.lineTo(x + size/1.8, y - size/1.2);
    ctx.closePath();
    ctx.fill();
}

/**
 * Draws a rope icon (coiled rope).
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {number} x - Center X coordinate.
 * @param {number} y - Center Y coordinate.
 * @param {number} size - Approximate diameter of the icon.
 */
function drawRopeIcon(ctx, x, y, size) {
    const radius = size / 2.5;
    const lineWidth = size / 6;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    // Draw three overlapping circles/arcs to simulate a coil
    ctx.beginPath();
    ctx.arc(x, y - radius * 0.1, radius * 0.8, Math.PI * 0.2, Math.PI * 1.8);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y + radius * 0.1, radius, Math.PI * 0.1, Math.PI * 1.9);
    ctx.stroke();

    // Small knot/end
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(x + radius * 0.6, y - radius * 0.6, lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'butt'; // Reset line cap
}

/**
 * Draws a burst icon (exploding star/lines).
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {number} x - Center X coordinate.
 * @param {number} y - Center Y coordinate.
 * @param {number} size - Approximate diameter of the icon.
 */
function drawBurstIcon(ctx, x, y, size) {
    const numLines = 8;
    const innerRadius = size / 6;
    const outerRadius = size / 2;
    const lineWidth = size / 12;

    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    for (let i = 0; i < numLines; i++) {
        const angle = (i / numLines) * Math.PI * 2;
        const startX = x + innerRadius * Math.cos(angle);
        const startY = y + innerRadius * Math.sin(angle);
        const endX = x + outerRadius * Math.cos(angle);
        const endY = y + outerRadius * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }

    // Center dot
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(x, y, innerRadius * 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'butt'; // Reset line cap
}

function drawStarIcon(ctx, x, y, size) {
    // Default star shape
    const spikes = 5;
    const outerRadius = size/2;
    const innerRadius = size/4;

    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (Math.PI * i) / spikes - Math.PI/2;
        const pointX = x + radius * Math.cos(angle);
        const pointY = y + radius * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(pointX, pointY);
        } else {
            ctx.lineTo(pointX, pointY);
        }
    }
    ctx.closePath();
    ctx.fill();
}