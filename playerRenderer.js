/**
 * playerRenderer.js
 * Handles rendering the player character (anchor, body, limbs, eyes, name).
 */
import config from '../config';
import { getPlayerPhysicsState } from './playerState.js'; 
import { calculateBlendedColor } from './colorUtils.js';

/**
 * Renders a single player character, including anchor, body, bungee cord, and limbs.
 *
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {string} clientId - The ID of the player being rendered.
 * @param {string} localClientId - The ID of the current user's client.
 * @param {object} presence - The player's presence data (x, y anchor, color, paintedData, etc.).
 * @param {object} peer - The player's peer data (username, avatarUrl).
 */
export function renderPlayer(ctx, clientId, localClientId, presence, peer) {
    if (!presence || typeof presence.x !== 'number' || typeof presence.y !== 'number'
    ) {
        return; 
    }

    const anchorX = presence.x;
    const anchorY = presence.y;
    const baseColor = presence.color || config.defaultPlayerColor || '#FFF'; 
    const paintedData = presence.paintedData || {}; 

    ctx.beginPath();
    ctx.arc(anchorX, anchorY, config.cursorSize || 8, 0, Math.PI * 2);
    ctx.fillStyle = baseColor; 
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();

    const physicsState = getPlayerPhysicsState(clientId); 
    if (!physicsState) {
        console.warn(`No physics state found for client ${clientId} during render.`);
        return; 
    }
    const bodyX = physicsState.position.x;
    const bodyY = physicsState.position.y;

    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(bodyX, bodyY);
    ctx.strokeStyle = config.bungeeCordColor || 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = config.bungeeCordWidth || 2;
    ctx.stroke();

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
    ctx.lineCap = 'butt'; 

    const bodyWidth = config.playerBodyWidth || 20;
    const bodyHeight = config.playerBodyHeight || 30;
    const radius = bodyWidth / 2;
    const rectHeight = bodyHeight - bodyWidth; 

    const baseStrokeColor = config.playerBodyStrokeColor || '#FF88AA';
    const blendedStrokeColor = calculateBlendedColor(baseStrokeColor, paintedData);

    ctx.fillStyle = config.playerBodyColor || '#FFAABB'; 
    ctx.strokeStyle = blendedStrokeColor; 
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(bodyX - radius, bodyY - rectHeight / 2); 
    ctx.arc(bodyX, bodyY - rectHeight / 2, radius, Math.PI, 0); 
    ctx.lineTo(bodyX + radius, bodyY + rectHeight / 2); 
    ctx.arc(bodyX, bodyY + rectHeight / 2, radius, 0, Math.PI); 
    ctx.lineTo(bodyX - radius, bodyY - rectHeight / 2); 
    ctx.closePath();
    ctx.fill();
    ctx.stroke(); 

    const eyeRadius = config.playerEyeRadius || 4;
    const eyeOffsetX = config.playerEyeOffsetX || 6;
    const eyeOffsetY = config.playerEyeOffsetY || -3; 
    const leftEyeX = bodyX - eyeOffsetX;
    const rightEyeX = bodyX + eyeOffsetX;
    const eyeY = bodyY + eyeOffsetY; 

    ctx.fillStyle = '#FFFFFF'; 
    ctx.strokeStyle = '#000000'; 
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.arc(leftEyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(rightEyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const pupilRadius = eyeRadius * 0.5;
    const maxPupilOffset = eyeRadius - pupilRadius - 1; 
    let pupilOffsetX = 0;
    let pupilOffsetY = 0;

    if (clientId === localClientId) {
        const avgEyeX = bodyX;
        const dirX = anchorX - avgEyeX;
        const dirY = anchorY - eyeY;
        const dist = Math.sqrt(dirX * dirX + dirY * dirY);

        if (dist > 1) { 
            const normX = dirX / dist;
            const normY = dirY / dist;
            pupilOffsetX = normX * maxPupilOffset;
            pupilOffsetY = normY * maxPupilOffset;
        }
    }

    ctx.fillStyle = '#000000';

    ctx.beginPath();
    ctx.arc(leftEyeX + pupilOffsetX, eyeY + pupilOffsetY, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(rightEyeX + pupilOffsetX, eyeY + pupilOffsetY, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = config.nameColor || '#FFF';
    ctx.font = config.nameFont || '12px sans-serif';
    ctx.textAlign = 'center';
    const nameYOffset = (bodyHeight / 2) + 14; 
    ctx.fillText(peer.username, bodyX, bodyY + nameYOffset);
}