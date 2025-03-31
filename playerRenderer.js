/**
 * playerRenderer.js
 * Handles rendering the player character (anchor, body, limbs, eyes, name)
 * and their associated held paint can and bungee.
 */
import config from '../config.js';
import { getPlayerPhysicsState } from './playerState.js';
import { calculateBlendedColor } from './colorUtils.js';
import { renderPaintCan } from './paintCan.js'; // Import renderPaintCan

/**
 * Renders a single player character, including anchor, body, bungee cord, limbs,
 * and their held paint can if applicable.
 *
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {string} clientId - The ID of the player being rendered.
 * @param {string} localClientId - The ID of the current user's client.
 * @param {object} presence - The player's presence data (x, y anchor, color, paintedData, currentCanId).
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
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(bodyX, bodyY);
    ctx.strokeStyle = config.bungeeCordColor || 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = config.bungeeCordWidth || 2;
    ctx.stroke();

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
    ctx.save(); // Save context before rotating for body/eyes
    ctx.translate(bodyX, bodyY); // Move origin to body center
    ctx.rotate(bodyAngle); // Rotate the context

    // --- Render Player Body (Capsule) ---
    const bodyWidth = config.playerBodyWidth || 20;
    const bodyHeight = config.playerBodyHeight || 30;
    const radius = bodyWidth / 2;
    const rectHeight = bodyHeight - bodyWidth;

    const baseStrokeColor = config.playerBodyStrokeColor || '#FF88AA';
    const blendedStrokeColor = calculateBlendedColor(baseStrokeColor, paintedData);

    // Draw Fill First (centered at the rotated origin 0,0)
    ctx.fillStyle = config.playerBodyColor || '#FFAABB'; // Use base body color
    ctx.beginPath();
    ctx.moveTo(-radius, -rectHeight / 2); // Top-left start of capsule arc
    ctx.arc(0, -rectHeight / 2, radius, Math.PI, 0); // Top semi-circle
    ctx.lineTo(radius, rectHeight / 2); // Right side vertical line
    ctx.arc(0, rectHeight / 2, radius, 0, Math.PI); // Bottom semi-circle
    ctx.lineTo(-radius, -rectHeight / 2); // Left side vertical line
    ctx.closePath();
    ctx.fill();

    // Draw Blended Stroke (potentially with glow)
    // Optional: Add glow to stroke based on blended color? Might be visually noisy.
    // ctx.shadowBlur = glowBlur / 2; // Subtle glow for stroke
    // ctx.shadowColor = blendedStrokeColor;
    ctx.strokeStyle = blendedStrokeColor; // Use blended stroke color
    ctx.lineWidth = 2;
    ctx.stroke(); // Draw blended stroke using the same path

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