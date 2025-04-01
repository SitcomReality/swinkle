/**
 * playerRenderer.js
 * Handles rendering the player character (anchor, body, limbs, eyes, name)
 * and their associated held paint can and bungee.
 * Also renders active power-up effects on the player.
 */
import config from '../config.js';
import { getPlayerPhysicsState } from './playerState.js';
// Import the specific color utils needed
import { calculatePaintOnlyBlendedColor, calculateTotalPaintPercentage, calculateBlendedColor } from './colorUtils.js';
import { renderPaintCan } from './paintCan.js'; // Import renderPaintCan

// Duration for the respawn fade-in animation (MUST match respawn-manager.js)
const RESPAWN_ANIM_DURATION = 500; // milliseconds
// Duration to hide the player at the start of the respawn animation (allows sparkle effect)
const RESPAWN_INITIAL_HIDE_DURATION = 150; // milliseconds
const RESPAWN_FADE_IN_DURATION = RESPAWN_ANIM_DURATION - RESPAWN_INITIAL_HIDE_DURATION;

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
 * Uses the physics state's `lastAnchorPos` for accurate anchor rendering.
 * Handles fade-in effect during respawn animation.
 * If the player is lost, only renders the anchor and "PAINTED OUT!" message.
 *
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {string} clientId - The ID of the player being rendered.
 * @param {string} localClientId - The ID of the current user's client.
 * @param {object} presence - The player's presence data (color, paintedData, currentCanId, power-up flags, activePowerUps, isSpectating, lost, respawnAnimEndTime).
 * @param {object} peer - The player's peer data (username, avatarUrl).
 * @param {object} allPaintCansState - The current state of all paint cans from roomState.paintCans.
 */
export function renderPlayer(ctx, clientId, localClientId, presence, peer, allPaintCansState) {
    // --- Get Player Physics State ---
    const physicsState = getPlayerPhysicsState(clientId);
    if (!physicsState) {
        if (!presence.isSpectating) console.warn(`No physics state found for client ${clientId} during render.`);
        return;
    }
    const anchorX = physicsState.lastAnchorPos.x;
    const anchorY = physicsState.lastAnchorPos.y;

    if (typeof anchorX !== 'number' || typeof anchorY !== 'number') {
        console.warn(`Invalid anchor coordinates in physics state for ${clientId}:`, physicsState.lastAnchorPos);
        return;
    }

    const baseColor = presence.color || config.defaultPlayerColor || '#FFF';
    const paintedData = presence.paintedData || {};
    const glowBlur = config.neonGlowBlur || 10;
    const anchorGlowColor = config.anchorPointGlowColor || 'rgba(255, 255, 255, 0.7)';
    const isSpringy = presence.springyBungee || false;
    const isShielded = presence.shielded || false;
    const hasMegaCanPowerup = presence.activePowerUps?.['megaCan'];

    // --- Render Anchor Point (Always Visible) ---
    ctx.save();
    ctx.shadowBlur = glowBlur;
    ctx.shadowColor = anchorGlowColor;
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, config.cursorSize || 8, 0, Math.PI * 2);
    ctx.fillStyle = baseColor;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // --- Check if player is lost ---
    const isLost = presence.lost || false;
    if (isLost) {
        // Player is lost, only render the "PAINTED OUT!" message and exit
        ctx.save();
        ctx.fillStyle = config.lossMessageColor || '#FFFFFF';
        ctx.font = config.lossMessageFont || '24px sans-serif';
        ctx.textAlign = 'center';
        // Use physics state position to place the text correctly even if body isn't rendered
        const bodyX = physicsState.position.x;
        const bodyY = physicsState.position.y;
        const bodyHeight = config.playerBodyHeight || 30;
        ctx.fillText("PAINTED OUT!", bodyX, bodyY - bodyHeight / 2 - 15); // Position above where body would be
        ctx.restore();
        return; // Exit function, skipping the rest of the rendering
    }

    // --- Proceed with rendering if NOT lost ---

    // --- Calculate Opacity and Visibility based on Respawn/Spectate ---
    const now = Date.now();
    const respawnAnimEndTime = presence.respawnAnimEndTime;
    const isSpectating = presence.isSpectating || false;
    let isHiddenDuringRespawn = false;
    let respawnOpacity = 1.0;

    if (respawnAnimEndTime && now < respawnAnimEndTime) {
        const timeRemaining = respawnAnimEndTime - now;
        const elapsedTime = RESPAWN_ANIM_DURATION - timeRemaining;

        if (elapsedTime < RESPAWN_INITIAL_HIDE_DURATION) {
            // Initial phase: Player is hidden, only anchor visible
            isHiddenDuringRespawn = true;
            respawnOpacity = 0.0; // Explicitly 0 during hide phase
        } else if (RESPAWN_FADE_IN_DURATION > 0) {
            // Fade-in phase
            const timeIntoFade = elapsedTime - RESPAWN_INITIAL_HIDE_DURATION;
            const fadeInProgress = Math.min(1.0, timeIntoFade / RESPAWN_FADE_IN_DURATION);
            respawnOpacity = fadeInProgress;
        } else {
             // Fallback if durations are misconfigured, snap to full opacity
             respawnOpacity = 1.0;
        }
        // Clamp opacity just in case
        respawnOpacity = Math.max(0, Math.min(1, respawnOpacity));
    }

    const baseAlpha = isSpectating ? 0.25 : 1.0;
    // Final combined alpha for elements affected by spectator/respawn state
    const combinedAlpha = baseAlpha * respawnOpacity;

    // --- Exit early if hidden during respawn ---
    // Anchor was already rendered above
    if (isHiddenDuringRespawn) {
        return;
    }

    // --- Apply Combined Opacity and Render Rest of Player ---
    // combinedAlpha is calculated above
    ctx.save();
    ctx.globalAlpha = combinedAlpha; // Apply combined fade/spectator alpha

    const bodyX = physicsState.position.x;
    const bodyY = physicsState.position.y;
    const bodyAngle = physicsState.angle || 0;

    // --- Render Player Bungee Cord (Anchor -> Body) ---
    ctx.save(); // Save context for potential bungee modifications
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY); // Use calculated anchorX, anchorY
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
    const rectHeight = bodyHeight - bodyWidth; // Height of the rectangular part

    // Create capsule path (used for fill, stroke, clip, and shield)
    ctx.beginPath();
    ctx.moveTo(-radius, -rectHeight / 2); // Top-left start of capsule arc
    ctx.arc(0, -rectHeight / 2, radius, Math.PI, 0); // Top semi-circle
    ctx.lineTo(radius, rectHeight / 2); // Right side vertical line
    ctx.arc(0, rectHeight / 2, radius, 0, Math.PI); // Bottom semi-circle
    ctx.lineTo(-radius, -rectHeight / 2); // Left side vertical line
    ctx.closePath();

    // Calculate total paint percentage (capped at loss threshold)
    const totalPaintPercentage = calculateTotalPaintPercentage(paintedData, config.lossThreshold);

    // --- Draw Base Body Color FIRST ---
    // This fills the entire capsule shape with the base color.
    ctx.fillStyle = config.playerBodyColor || '#FFAABB'; // Use base body color
    ctx.fill(); // Fill the capsule path

    // --- Render Paint Fill Background OVER the base color ---
    if (totalPaintPercentage > 0) {
        ctx.save(); // Save context before clipping

        // Apply the capsule path as a clipping region
        // Note: The path is already defined from drawing the base color
        ctx.clip(); // Clip to the capsule path

        // Calculate fill properties
        const fillRatio = Math.min(1, totalPaintPercentage / config.lossThreshold); // Ratio 0 to 1
        const fillHeightAbsolute = bodyHeight * fillRatio;
        // Top Y coordinate of the fill rectangle (relative to capsule center 0,0)
        // Starts from the bottom (bodyHeight / 2) and goes up
        const fillTopYRelative = (bodyHeight / 2) - fillHeightAbsolute;

        // Use paint-only blend for the fill
        const blendedFillColor = calculatePaintOnlyBlendedColor(paintedData);

        // Draw the fill rectangle covering the bottom portion within the clip
        ctx.fillStyle = blendedFillColor;
        // Draw from the calculated top edge down to slightly below the bottom edge to ensure coverage
        ctx.fillRect(-radius - 1, fillTopYRelative, bodyWidth + 2, fillHeightAbsolute + 2);

        ctx.restore(); // Restore context (removes the clip)
    }
    // --- END Paint Fill Background ---


    // --- Draw Blended Stroke ---
    // The stroke color should still blend with the original stroke color
    const baseStrokeColor = config.playerBodyStrokeColor || '#FF88AA';
    const blendedStrokeColor = calculateBlendedColor(baseStrokeColor, paintedData); // Blend based on stroke color
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
        // Use current global alpha (which includes combined spectator/respawn fade)
        const currentCombinedAlpha = ctx.globalAlpha; // Get the current alpha
        // Pulsate alpha relative to the current combined alpha
        ctx.globalAlpha = currentCombinedAlpha * (0.6 + 0.3 * Math.sin(Date.now() * shieldPulseSpeed));
        ctx.shadowBlur = glowBlur;
        ctx.shadowColor = '#00FFFF';
        ctx.stroke();
        ctx.restore(); // Restore alpha, shadow settings etc. (restores alpha back to combinedAlpha)
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

    // Only make local player's eyes look, and only if not spectating
    if (clientId === localClientId && !isSpectating) {
        // Calculate direction from world body center to world anchor
        const worldDirX = anchorX - bodyX; // Use calculated anchorX, anchorY
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
    } // Other players' or spectator's pupils stay centered

    ctx.fillStyle = '#000000'; // Black pupils

    // Left Pupil (Offset relative to local eye position)
    ctx.beginPath();
    ctx.arc(leftEyeX + pupilOffsetX, eyeY + pupilOffsetY, pupilRadius, 0, Math.PI * 2); // Already in local rotated space
    ctx.fill();

    // Right Pupil (Offset relative to local eye position)
    ctx.beginPath();
    ctx.arc(rightEyeX + pupilOffsetX, eyeY + pupilOffsetY, pupilRadius, 0, Math.PI * 2); // Already in local rotated space
    ctx.fill();

    // --- Restore Context After Body/Eyes Rotation ---
    ctx.restore(); // Restore translation and rotation (alpha is still combinedAlpha)

    // --- Render Player Name (Not Rotated) ---
    // Alpha is still combinedAlpha
    ctx.fillStyle = config.nameColor || '#FFF';
    ctx.font = config.nameFont || '12px sans-serif';
    ctx.textAlign = 'center';
    const nameYOffset = (bodyHeight / 2) + 14; // Position below the capsule (world Y)
    ctx.fillText(peer.username, bodyX, bodyY + nameYOffset);

    // --- Render Mega Can Ready Indicator (Not Rotated) ---
    // Alpha is still combinedAlpha
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

    // --- Render Held Paint Can and Bungee (if applicable) ---
    // Alpha is still combinedAlpha
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
        renderPaintCan(ctx, canState); // Render can respects current combinedAlpha
    }

    // --- Restore Main Alpha State ---
    ctx.restore(); // Restores the globalAlpha from before applying combinedAlpha
}