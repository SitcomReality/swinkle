/**
 * player-effects-renderer.js
 * Handles rendering active power-up visual effects directly onto the player character.
 * Called by playerRenderer.js.
 */
import config from './config.js';
import { powerUpDefinitions } from './power-ups/power-up-data.js'; // May need definitions for colors/icons

// Helper function to draw a star (copied from playerRenderer)
function drawStarIcon(ctx, x, y, size, spikes = 5, innerFactor = 0.5) {
    const outerRadius = size / 2;
    const innerRadius = outerRadius * innerFactor;

    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (Math.PI * i) / spikes - Math.PI / 2;
        const pointX = x + radius * Math.cos(angle);
        const pointY = y + radius * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(pointX, pointY);
        } else {
            ctx.lineTo(pointX, pointY);
        }
    }
    ctx.closePath();
}

// Helper to draw a simple 'burst' icon
function drawBurstIconIndicator(ctx, x, y, size) {
    const numLines = 5;
    const innerRadius = size / 8;
    const outerRadius = size / 2;
    const lineWidth = size / 14;

    ctx.strokeStyle = ctx.fillStyle; // Use fillStyle for lines
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    for (let i = 0; i < numLines; i++) {
        const angle = (i / numLines) * Math.PI * 2 + (Date.now() * 0.001); // Add slow rotation
        const startX = x + innerRadius * Math.cos(angle);
        const startY = y + innerRadius * Math.sin(angle);
        const endX = x + outerRadius * Math.cos(angle);
        const endY = y + outerRadius * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }
    ctx.lineCap = 'butt'; // Reset line cap
}

// Helper to draw a simple 'rope' icon
function drawRopeIconIndicator(ctx, x, y, size) {
    const radius = size / 2.8;
    const lineWidth = size / 7;
    ctx.strokeStyle = ctx.fillStyle; // Use fillStyle for lines
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    // Draw two overlapping arcs to simulate a tight coil/knot
    ctx.beginPath();
    ctx.arc(x, y - radius * 0.1, radius * 0.8, Math.PI * 0.4, Math.PI * 1.6);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y + radius * 0.1, radius, Math.PI * 1.4, Math.PI * 0.6);
    ctx.stroke();

    ctx.lineCap = 'butt'; // Reset line cap
}


/**
 * Renders visual effects on the player based on active power-ups.
 * Assumes it's called within the playerRenderer's rendering context,
 * specifically after the player body/eyes are drawn but before the final restore.
 * It receives the canvas context with the player's rotation/translation potentially applied,
 * and the current `combinedAlpha`.
 *
 * @param {CanvasRenderingContext2D} ctx - The drawing context (potentially transformed).
 * @param {string} clientId - The ID of the player being rendered.
 * @param {string} localClientId - The ID of the current user's client.
 * @param {object} presence - The player's presence data.
 * @param {object} peer - The player's peer data.
 * @param {object} physicsState - The player's physics state.
 */
export function renderPlayerPowerUpEffects(ctx, clientId, localClientId, presence, peer, physicsState) {
    const isShielded = presence.shielded || false;
    const hasMegaCanPowerup = presence.activePowerUps?.['megaCan']; // Check if ready to apply
    const isShortRopeActive = presence.shortRopeActive || false;
    const isBigBurstActive = presence.bigBurstActive || false;

    const bodyX = physicsState.position.x;
    const bodyY = physicsState.position.y;
    const bodyAngle = physicsState.angle || 0;
    const bodyWidth = config.playerBodyWidth || 20;
    const bodyHeight = config.playerBodyHeight || 30;
    const radius = bodyWidth / 2;
    const rectHeight = bodyHeight - bodyWidth;
    const glowBlur = config.neonGlowBlur || 10;
    const now = Date.now();

    // --- Render Shield ---
    if (isShielded) {
        ctx.save();
        // Apply rotation/translation again IF NEEDED (depends where called in playerRenderer)
        // Assuming called AFTER player body rotation is applied in playerRenderer...
        // The context is already rotated/translated to the player's body center.

        const shieldPulseSpeed = 0.004; // Speed of the pulse
        const shieldPulseAmount = 3;    // How much the shield expands (pixels)
        const shieldOffset = 3 + shieldPulseAmount * Math.sin(now * shieldPulseSpeed); // Expand from base offset

        const shieldRadius = radius + shieldOffset;
        const shieldRectHeight = rectHeight + shieldOffset * 2; // Increase height too

        ctx.beginPath();
        ctx.moveTo(-shieldRadius, -shieldRectHeight / 2);
        ctx.arc(0, -shieldRectHeight / 2, shieldRadius, Math.PI, 0);
        ctx.lineTo(shieldRadius, shieldRectHeight / 2);
        ctx.arc(0, shieldRectHeight / 2, shieldRadius, 0, Math.PI);
        ctx.lineTo(-shieldRadius, -shieldRectHeight / 2);
        ctx.closePath();

        const shieldColor = powerUpDefinitions['shield']?.color || '#88FFFF';
        const shieldGlow = powerUpDefinitions['shield']?.glowColor || '#00FFFF';
        ctx.strokeStyle = shieldColor; // Shield color
        ctx.lineWidth = 2;
        const currentCombinedAlpha = ctx.globalAlpha;
        ctx.globalAlpha = currentCombinedAlpha * (0.6 + 0.3 * Math.sin(now * shieldPulseSpeed));
        ctx.shadowBlur = glowBlur;
        ctx.shadowColor = shieldGlow;
        ctx.stroke();
        ctx.restore(); // Restore alpha, shadow settings etc.
    }

    // --- Render Mega Can Ready Indicator ---
    if (hasMegaCanPowerup) {
        // Render relative to the player body (non-rotated context expected here?)
        // Let's assume playerRenderer restored rotation before calling this,
        // OR we restore it temporarily here.
        // Safer: Draw relative to body center, but WITHOUT rotation.
        ctx.save();
        // Undo rotation if needed (optional, depends on call location)
        // ctx.rotate(-bodyAngle);

        const indicatorDef = powerUpDefinitions['megaCan'];
        const starSize = 10; // Small indicator
        // Position relative to non-rotated body center
        const starX = bodyWidth / 2 + starSize / 2 + 2; // Position to the right of body center
        const starY = 0; // Center vertically with body center

        ctx.fillStyle = indicatorDef?.color || config.megaCanIndicatorColor;
        ctx.shadowBlur = 5;
        ctx.shadowColor = indicatorDef?.glowColor || config.megaCanIndicatorColor;
        drawStarIcon(ctx, starX, starY, starSize, 5, 0.5);
        ctx.fill();
        ctx.restore(); // Restore shadow, rotation etc.
    }

    // --- Render Short Rope Indicator ---
    if (isShortRopeActive) {
        ctx.save();
        const indicatorDef = powerUpDefinitions['shortRope'];
        const iconSize = 12;
        // Position slightly above the body center
        const iconX = 0;
        const iconY = -bodyHeight / 2 - iconSize / 2 - 2; // Above body

        // Pulsate alpha for visibility
        const pulseSpeed = 0.005;
        const minAlpha = 0.5;
        const alphaRange = 1.0 - minAlpha;
        const alpha = minAlpha + (alphaRange * (1 + Math.sin(now * pulseSpeed)) / 2);
        ctx.globalAlpha *= alpha; // Multiply with existing combined alpha

        ctx.fillStyle = indicatorDef?.color || '#FFA500'; // Use defined color or default
        ctx.shadowBlur = 3;
        ctx.shadowColor = indicatorDef?.glowColor || '#FF8C00';
        drawRopeIconIndicator(ctx, iconX, iconY, iconSize);
        ctx.restore();
    }

    // --- Render Big Burst Ready Indicator ---
    if (isBigBurstActive) {
        ctx.save();
        const indicatorDef = powerUpDefinitions['bigBurst'];
        const iconSize = 14;
        // Position slightly below the body center
        const iconX = 0;
        const iconY = bodyHeight / 2 + iconSize / 2 + 2; // Below body

        // Pulsate size for visibility
        const pulseSpeed = 0.004;
        const pulseAmount = 0.1;
        const pulseFactor = 1 + pulseAmount * Math.sin(now * pulseSpeed);
        const renderSize = iconSize * pulseFactor;

        ctx.fillStyle = indicatorDef?.color || '#FF4500'; // Use defined color or default
        ctx.shadowBlur = 5;
        ctx.shadowColor = indicatorDef?.glowColor || '#FF6347';
        drawBurstIconIndicator(ctx, iconX, iconY, renderSize);
        ctx.restore();
    }
}