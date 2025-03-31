/**
 * playerRenderer.js
 * Handles rendering the player character (anchor, body, limbs, eyes, name)
 * and their associated held paint can and bungee.
 * Also renders active power-up effects on the player.
 */
import config from '../config.js';
import { getPlayerPhysicsState } from './playerState.js';
import { calculateBlendedColor } from './colorUtils.js';
import { renderPaintCan } from './paintCan.js'; // Import renderPaintCan

// Helper function to draw a star (reused for mega can indicator)
// Could be moved to a utils file later
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

/**
 * Renders a single player character, including anchor, body, bungee cord, limbs,
 * and their held paint can if applicable. Includes power-up visual indicators.
 *
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {string} clientId - The ID of the player being rendered.
 * @param {string} localClientId - The ID of the current user's client.
 * @param {object} presence - The player's presence data (x, y anchor, color, paintedData, currentCanId, power-up flags, activePowerUps).
 * @param {object} peer - The player's peer data (username, avatarUrl).
 * @param {object} allPaintCansState - The current state of all paint cans from roomState.paintCans.
 */
export function renderPlayer(ctx, clientId, localClientId, presence, peer, allPaintCansState) {
    if (!presence || typeof presence.x !== 'number' || typeof presence.y !== 'number') {
        return; // Basic presence check
    }

    const anchorX = presence.x;
    const anchorY = presence.y;
    const baseColor = presence.color || config.defaultPlayerColor || '#FFF';
    const paintedData = presence.paintedData || {};
    const glowBlur = config.neonGlowBlur || 10;
    const anchorGlowColor = config.anchorPointGlowColor || 'rgba(255, 255, 255, 0.7)';
    const isSpringy = presence.springyBungee || false; // Check for springy power-up
    const isShielded = presence.shielded || false; // Check for shield power-up
    const hasMegaCanPowerup = presence.activePowerUps?.['megaCan']; // Check for active mega can powerup

    // --- Render Anchor Point (Cursor) ---
    ctx.save();
    ctx.shadowBlur = glowBlur;
    ctx.shadowColor = anchorGlowColor; // White/Translucent glow for anchor

    ctx.beginPath();
    ctx.arc(anchorX, anchorY, config.cursorSize || 8, 0, Math.PI * 2);
    ctx.fillStyle = baseColor;
    ctx.fill();

    // Draw a less prominent stroke over the glow
    ctx.shadowBlur = 0; // Turn off shadow for the stroke
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore(); // Restore shadow settings etc.

    // --- Get Player Physics State ---
    const physicsState = getPlayerPhysicsState(clientId);
    if (!physicsState) {
        console.warn(`No physics state found for client ${clientId} during render.`);
        return; // Cannot render body/limbs without physics state
    }
    const bodyX = physicsState.position.x;
    const bodyY = physicsState.position.y;
    const bodyAngle = physicsState.angle || 0; // Get the angle from physics state

    // --- Render Player Bungee Cord (Anchor -> Body) ---
    ctx.save(); // Save context for potential bungee modifications
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(bodyX, bodyY);
    // Modify bungee appearance if springy power-up is active
    if (isSpringy) {
        ctx.strokeStyle = '#FFFF00'; // Yellow for springy
        ctx.lineWidth = (config.bungeeCordWidth || 2) * 1.5; // Make it thicker
        ctx.shadowBlur = glowBlur / 2;
        ctx.shadowColor = '#FFFF00';
    } else {
        ctx.strokeStyle = config.bungeeCordColor || 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = config.bungeeCordWidth || 2;
    }
    ctx.stroke();
    ctx.restore(); // Restore context after bungee

    // --- Render Limbs ---
    ctx.strokeStyle = config.limbColor;
    ctx.lineWidth = config.limbWidth;
    ctx.lineCap = 'round';

    const cosAngle = Math.cos(bodyAngle);
    const sinAngle = Math.sin(bodyAngle);

    physicsState.limbs.forEach(limb => {
        // Calculate world attachment point based on body rotation
        const rotatedOffsetX = limb.attachmentOffset.x * cosAngle - limb.attachmentOffset.y * sinAngle;
        const rotatedOffsetY = limb.attachmentOffset.x * sinAngle + limb.attachmentOffset.y * cosAngle;
        const attachmentPointX = bodyX + rotatedOffsetX;
        const attachmentPointY = bodyY + rotatedOffsetY;

        ctx.beginPath();
        ctx.moveTo(attachmentPointX, attachmentPointY);
        ctx.lineTo(limb.position.x, limb.position.y);
        ctx.stroke();
    });
    ctx.lineCap = 'butt'; // Reset line cap

    // --- Apply Rotation for Body, Eyes ---
    ctx.save(); // Save context before rotating for body/eyes/shield
    ctx.translate(bodyX, bodyY); // Move origin to body center
    ctx.rotate(bodyAngle); // Rotate the context

    // --- Render Player Body (Capsule) ---
    const bodyWidth = config.playerBodyWidth || 20;
    const bodyHeight = config.playerBodyHeight || 30;
    const radius = bodyWidth / 2;
    const rectHeight = bodyHeight - bodyWidth;

    const baseStrokeColor = config.playerBodyStrokeColor || '#FF88AA';
    const blendedStrokeColor = calculateBlendedColor(baseStrokeColor, paintedData);

    // Create capsule path (used for fill, stroke, and shield)
    ctx.beginPath();
    ctx.moveTo(-radius, -rectHeight / 2); // Top-left start of capsule arc
    ctx.arc(0, -rectHeight / 2, radius, Math.PI, 0); // Top semi-circle
    ctx.lineTo(radius, rectHeight / 2); // Right side vertical line
    ctx.arc(0, rectHeight / 2, radius, 0, Math.PI); // Bottom semi-circle
    ctx.lineTo(-radius, -rectHeight / 2); // Left side vertical line
    ctx.closePath();

    // Draw Fill First (centered at the rotated origin 0,0)
    ctx.fillStyle = config.playerBodyColor || '#FFAABB'; // Use base body color
    ctx.fill(); // Fill the path

    // Draw Blended Stroke
    ctx.strokeStyle = blendedStrokeColor; // Use blended stroke color
    ctx.lineWidth = 2;
    ctx.stroke(); // Draw blended stroke using the same path

    // --- Render Shield Effect (if active) ---
    if (isShielded) {
        ctx.save();
        // Draw pulsating shield outline around the existing capsule path
        const shieldPulseSpeed = 0.004; // Speed of the pulse
        const shieldPulseAmount = 3;    // How much the shield expands (pixels)
        const shieldOffset = 3 + shieldPulseAmount * Math.sin(Date.now() * shieldPulseSpeed); // Expand from base offset

        // Slightly larger radius for shield outline
        const shieldRadius = radius + shieldOffset;
        const shieldRectHeight = rectHeight + shieldOffset * 2; // Increase height too

        // Create slightly larger shield path
        ctx.beginPath();
        ctx.moveTo(-shieldRadius, -shieldRectHeight / 2);
        ctx.arc(0, -shieldRectHeight / 2, shieldRadius, Math.PI, 0);
        ctx.lineTo(shieldRadius, shieldRectHeight / 2);
        ctx.arc(0, shieldRectHeight / 2, shieldRadius, 0, Math.PI);
        ctx.lineTo(-shieldRadius, -shieldRectHeight / 2);
        ctx.closePath();

        // Style and draw the shield
        ctx.strokeStyle = '#88FFFF'; // Shield color
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6 + 0.3 * Math.sin(Date.now() * shieldPulseSpeed); // Pulsating alpha
        ctx.shadowBlur = glowBlur;
        ctx.shadowColor = '#00FFFF';
        ctx.stroke();
        ctx.restore(); // Restore alpha, shadow settings etc.
    }

    // --- Render Eyes (Relative to Rotated Body Center) ---
    const eyeRadius = config.playerEyeRadius || 4;
    const eyeOffsetX = config.playerEyeOffsetX || 6;
    const eyeOffsetY = config.playerEyeOffsetY || -3;
    const leftEyeX = -eyeOffsetX; // Relative to rotated (0,0)
    const rightEyeX = +eyeOffsetX;
    const eyeY = eyeOffsetY;

    ctx.fillStyle = '#FFFFFF'; // White part of the eye
    ctx.strokeStyle = '#000000'; // Black outline
    ctx.lineWidth = 1;

    // Left Eye
    ctx.beginPath();
    ctx.arc(leftEyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Right Eye
    ctx.beginPath();
    ctx.arc(rightEyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // --- Render Pupils (Look towards anchor point for local player - needs world coordinates) ---
    const pupilRadius = eyeRadius * 0.5;
    const maxPupilOffset = eyeRadius - pupilRadius - 1; // Max distance pupil can move
    let pupilOffsetX = 0;
    let pupilOffsetY = 0;

    // Only make local player's eyes look
    if (clientId === localClientId) {
        // Calculate direction from world body center to world anchor
        const worldDirX = anchorX - bodyX;
        const worldDirY = anchorY - bodyY;

        // Rotate this world direction vector into the player's local coordinate system
        // Rotation by -bodyAngle
        const localDirX = worldDirX * cosAngle + worldDirY * sinAngle;
        const localDirY = -worldDirX * sinAngle + worldDirY * cosAngle;

        const localDist = Math.sqrt(localDirX * localDirX + localDirY * localDirY);

        if (localDist > 1) { // Avoid division by zero or tiny values
            const localNormX = localDirX / localDist;
            const localNormY = localDirY / localDist;
            pupilOffsetX = localNormX * maxPupilOffset; // Apply offset in local space
            pupilOffsetY = localNormY * maxPupilOffset;
        }
    } // Other players' pupils stay centered

    ctx.fillStyle = '#000000'; // Black pupils

    // Left Pupil (Offset relative to local eye position)
    ctx.beginPath();
    ctx.arc(leftEyeX + pupilOffsetX, eyeY + pupilOffsetY, pupilRadius, 0, Math.PI * 2); // Already in local rotated space
    ctx.fill();

    // Right Pupil (Offset relative to local eye position)
    ctx.beginPath();
    ctx.arc(rightEyeX + pupilOffsetX, eyeY + pupilOffsetY, pupilRadius, 0, Math.PI * 2); // Already in local rotated space
    ctx.fill();

    // --- Restore Context After Body/Eyes ---
    ctx.restore(); // Restore translation and rotation

    // --- Render Player Name (Not Rotated) ---
    ctx.fillStyle = config.nameColor || '#FFF';
    ctx.font = config.nameFont || '12px sans-serif';
    ctx.textAlign = 'center';
    const nameYOffset = (bodyHeight / 2) + 14; // Position below the capsule (world Y)
    ctx.fillText(peer.username, bodyX, bodyY + nameYOffset);

    // --- Render Mega Can Ready Indicator (Not Rotated) ---
    if (hasMegaCanPowerup) {
        ctx.save();
        const starSize = 10; // Small indicator
        const starX = bodyX + bodyWidth/2 + starSize/2 + 2; // Position to the right of body
        const starY = bodyY; // Center vertically with body
        ctx.fillStyle = config.megaCanIndicatorColor;
        ctx.shadowBlur = 5;
        ctx.shadowColor = config.megaCanIndicatorColor;
        drawStarIcon(ctx, starX, starY, starSize, 5, 0.5); // Reuse star drawing logic
        ctx.fill();
        ctx.restore();
    }

    // --- Display Loss Message if Player has Lost (Not Rotated) ---
    if (presence.lost) {
        ctx.fillStyle = config.lossMessageColor || '#FFFFFF';
        ctx.font = config.lossMessageFont || '24px sans-serif';
        ctx.textAlign = 'center'; // Ensure it's centered
        ctx.fillText("PAINTED OUT!", bodyX, bodyY - bodyHeight); // Position above body (world Y)
    }

    // --- Render Held Paint Can and Bungee (if applicable) ---
    const currentCanId = presence?.currentCanId;
    if (currentCanId && allPaintCansState && allPaintCansState[currentCanId]) {
        const canState = allPaintCansState[currentCanId];

        // Render can bungee cord (Player Body Center -> Can World Pos)
        ctx.beginPath();
        ctx.moveTo(bodyX, bodyY); // Start from player body center (world coords)
        ctx.lineTo(canState.x, canState.y); // Go to can center (world coords)
        ctx.strokeStyle = config.paintCanBungeeColor || 'rgba(180, 180, 180, 0.6)';
        ctx.lineWidth = config.paintCanBungeeWidth || 1.5;
        ctx.stroke();

        // Render the can itself (at its world position)
        renderPaintCan(ctx, canState);
    }
}