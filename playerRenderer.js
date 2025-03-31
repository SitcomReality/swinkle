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

    // --- Render Anchor Point (Cursor) ---
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, config.cursorSize || 8, 0, Math.PI * 2);
    ctx.fillStyle = baseColor; 
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();

    // --- Get Player Physics State ---
    const physicsState = getPlayerPhysicsState(clientId); 
    if (!physicsState) {
        console.warn(`No physics state found for client ${clientId} during render.`);
        return; // Cannot render body/limbs without physics state
    }
    const bodyX = physicsState.position.x;
    const bodyY = physicsState.position.y;

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

    physicsState.limbs.forEach(limb => {
        const attachmentPointX = bodyX + limb.attachmentOffset.x;
        const attachmentPointY = bodyY + limb.attachmentOffset.y;
        ctx.beginPath();
        ctx.moveTo(attachmentPointX, attachmentPointY);
        ctx.lineTo(limb.position.x, limb.position.y);
        ctx.stroke();
    });
    ctx.lineCap = 'butt'; // Reset line cap

    // --- Render Player Body (Capsule) ---
    const bodyWidth = config.playerBodyWidth || 20;
    const bodyHeight = config.playerBodyHeight || 30;
    const radius = bodyWidth / 2;
    const rectHeight = bodyHeight - bodyWidth; 

    const baseStrokeColor = config.playerBodyStrokeColor || '#FF88AA';
    const blendedStrokeColor = calculateBlendedColor(baseStrokeColor, paintedData);

    ctx.fillStyle = config.playerBodyColor || '#FFAABB'; // Use base body color
    ctx.strokeStyle = blendedStrokeColor; // Use blended stroke color
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(bodyX - radius, bodyY - rectHeight / 2); // Top-left start of capsule arc
    ctx.arc(bodyX, bodyY - rectHeight / 2, radius, Math.PI, 0); // Top semi-circle
    ctx.lineTo(bodyX + radius, bodyY + rectHeight / 2); // Right side vertical line
    ctx.arc(bodyX, bodyY + rectHeight / 2, radius, 0, Math.PI); // Bottom semi-circle
    ctx.lineTo(bodyX - radius, bodyY - rectHeight / 2); // Left side vertical line
    ctx.closePath();
    ctx.fill();
    ctx.stroke(); // Draw blended stroke

    // --- Render Eyes ---
    const eyeRadius = config.playerEyeRadius || 4;
    const eyeOffsetX = config.playerEyeOffsetX || 6;
    const eyeOffsetY = config.playerEyeOffsetY || -3; 
    const leftEyeX = bodyX - eyeOffsetX;
    const rightEyeX = bodyX + eyeOffsetX;
    const eyeY = bodyY + eyeOffsetY; 

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

    // --- Render Pupils (Look towards anchor point for local player) ---
    const pupilRadius = eyeRadius * 0.5;
    const maxPupilOffset = eyeRadius - pupilRadius - 1; // Max distance pupil can move
    let pupilOffsetX = 0;
    let pupilOffsetY = 0;

    // Only make local player's eyes look
    if (clientId === localClientId) {
        const avgEyeX = bodyX; // Look from center between eyes
        const dirX = anchorX - avgEyeX;
        const dirY = anchorY - eyeY; // Look towards anchor Y relative to eye Y
        const dist = Math.sqrt(dirX * dirX + dirY * dirY);

        if (dist > 1) { // Avoid division by zero or tiny values
            const normX = dirX / dist;
            const normY = dirY / dist;
            pupilOffsetX = normX * maxPupilOffset;
            pupilOffsetY = normY * maxPupilOffset;
        }
    } // Other players' pupils stay centered

    ctx.fillStyle = '#000000'; // Black pupils

    // Left Pupil
    ctx.beginPath();
    ctx.arc(leftEyeX + pupilOffsetX, eyeY + pupilOffsetY, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    // Right Pupil
    ctx.beginPath();
    ctx.arc(rightEyeX + pupilOffsetX, eyeY + pupilOffsetY, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    // --- Render Player Name ---
    ctx.fillStyle = config.nameColor || '#FFF';
    ctx.font = config.nameFont || '12px sans-serif';
    ctx.textAlign = 'center';
    const nameYOffset = (bodyHeight / 2) + 14; // Position below the capsule
    ctx.fillText(peer.username, bodyX, bodyY + nameYOffset);

    // --- Render Held Paint Can and Bungee (if applicable) ---
    const currentCanId = presence?.currentCanId;
    if (currentCanId && allPaintCansState && allPaintCansState[currentCanId]) {
        const canState = allPaintCansState[currentCanId];

        // Render can bungee cord (Player Body -> Can)
        ctx.beginPath();
        ctx.moveTo(bodyX, bodyY); // Start from player body center
        ctx.lineTo(canState.x, canState.y); // Go to can center
        ctx.strokeStyle = config.paintCanBungeeColor || 'rgba(180, 180, 180, 0.6)';
        ctx.lineWidth = config.paintCanBungeeWidth || 1.5;
        ctx.stroke();

        // Render the can itself
        renderPaintCan(ctx, canState);
    }
}