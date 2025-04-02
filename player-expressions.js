/**
 * player-expressions.js
 * Handles player character expressions including eye movement and animations.
 * Extracted from playerRenderer.js to improve modularity and enable more
 * advanced expression handling.
 */
import config from 'config';

/**
 * Calculates eye movement parameters for a player looking at their anchor point.
 * @param {object} playerBodyPos - Position of player body {x, y}
 * @param {object} anchorPos - Position of anchor point {x, y}
 * @param {number} bodyAngle - Current rotation angle of the player body
 * @param {boolean} shouldLook - Whether the eyes should look (true for local player)
 * @param {boolean} isSpectating - Whether the player is spectating
 * @returns {object} Eye movement parameters {pupilOffsetX, pupilOffsetY}
 */
export function calculateEyeMovement(playerBodyPos, anchorPos, bodyAngle, shouldLook, isSpectating) {
    const eyeRadius = config.playerEyeRadius || 4;
    const pupilRadius = eyeRadius * 0.5;
    const maxPupilOffset = eyeRadius - pupilRadius - 1; // Max distance pupil can move
    let pupilOffsetX = 0;
    let pupilOffsetY = 0;

    // Only make local player's eyes look, and only if not spectating
    if (shouldLook && !isSpectating) {
        // Calculate direction from world body center to world anchor
        const worldDirX = anchorPos.x - playerBodyPos.x;
        const worldDirY = anchorPos.y - playerBodyPos.y;

        // Rotation angles for transforming to local coordinates
        const cosAngle = Math.cos(bodyAngle);
        const sinAngle = Math.sin(bodyAngle);

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

    return { pupilOffsetX, pupilOffsetY };
}

/**
 * Calculates eye squint/compression effect based on game states.
 * @param {object} presence - Player's presence data
 * @param {number} now - Current timestamp for animations
 * @param {object} collisionState - Information about recent collisions
 * @returns {object} Eye shape parameters {scaleX, scaleY}
 */
export function calculateEyeExpression(presence, now, collisionState = null) {
    const baseScaleX = 1.0;
    const baseScaleY = 1.0;
    
    // Default expression: normal round eyes
    let scaleX = baseScaleX;
    let scaleY = baseScaleY;
    
    // Wincing during collision state (highest priority)
    if (collisionState && collisionState.hasCollided && now - collisionState.lastCollisionTime < 300) {
        // Wincing/grimacing expression - tight oval
        scaleX = 1.1;
        scaleY = 0.3; 
        return { scaleX, scaleY };
    }
    
    // Squint when charging paint (concentrated look)
    if (presence.currentCanId && presence.isCharging) {
        scaleY = 0.6; // Compress vertically for squinting effect
    }
    
    // Wide eyes when player has high paint percentage (worried look)
    const totalPaint = Object.values(presence.paintedData || {}).reduce((sum, val) => sum + val, 0);
    if (totalPaint > 70) { // Start looking worried at 70%
        const worryFactor = Math.min(1, (totalPaint - 70) / 30); // 0 to 1 based on how close to 100%
        scaleX = 1 + (0.3 * worryFactor); // Wider horizontally
        scaleY = 1 - (0.2 * worryFactor); // Slightly narrower vertically
    }
    
    // Blink occasionally (random)
    const shouldBlink = (Math.sin(now * 0.001) > 0.95);
    if (shouldBlink) {
        scaleY = 0.15; // Almost closed for blinking
    }
    
    return { 
        scaleX, 
        scaleY 
    };
}

/**
 * Adjusts pupil size based on eye shape to prevent pupils from extending beyond eye boundaries.
 * @param {object} eyeMovement - Eye movement parameters
 * @param {object} eyeExpression - Eye expression parameters
 * @returns {object} Adjusted pupil parameters
 */
export function adjustPupilForEyeShape(eyeMovement, eyeExpression) {
    const { pupilOffsetX, pupilOffsetY } = eyeMovement;
    const { scaleX, scaleY } = eyeExpression;
    
    // Calculate how much to compress the pupil in each dimension
    // Only compress when eyes are significantly compressed (below 50%)
    const pupilScaleY = scaleY < 0.5 ? Math.max(0.5, scaleY * 1.5) : 1.0;
    
    // Adjust pupil offset to stay within compressed eye boundaries
    const adjustedOffsetY = pupilOffsetY * (pupilScaleY);
    
    return {
        pupilOffsetX,
        pupilOffsetY: adjustedOffsetY,
        pupilScaleY
    };
}

/**
 * Renders player eyes with appropriate expressions and pupil movement.
 * @param {CanvasRenderingContext2D} ctx - Drawing context
 * @param {number} eyeOffsetX - X offset from body center for eye positioning
 * @param {number} eyeOffsetY - Y offset from body center for eye positioning
 * @param {object} eyeMovement - Eye movement parameters from calculateEyeMovement
 * @param {object} eyeExpression - Eye expression parameters from calculateEyeExpression
 */
export function renderPlayerEyes(ctx, eyeOffsetX, eyeOffsetY, eyeMovement, eyeExpression) {
    const eyeRadius = config.playerEyeRadius || 4;
    const pupilRadius = eyeRadius * 0.5;
    const leftEyeX = -eyeOffsetX; // Relative to rotated (0,0)
    const rightEyeX = +eyeOffsetX;
    const eyeY = eyeOffsetY;
    
    const { scaleX, scaleY } = eyeExpression;
    
    // Adjust pupils for compressed eyes
    const pupilAdjustment = adjustPupilForEyeShape(eyeMovement, eyeExpression);
    const { pupilOffsetX, pupilOffsetY, pupilScaleY } = pupilAdjustment;

    // White part of the eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;

    // Draw left eye (with expression scaling)
    ctx.save();
    ctx.translate(leftEyeX, eyeY);
    ctx.scale(scaleX, scaleY);
    ctx.beginPath();
    ctx.arc(0, 0, eyeRadius, 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();
    ctx.stroke();

    // Draw right eye (with expression scaling)
    ctx.save();
    ctx.translate(rightEyeX, eyeY);
    ctx.scale(scaleX, scaleY);
    ctx.beginPath();
    ctx.arc(0, 0, eyeRadius, 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();
    ctx.stroke();

    // Draw pupils (affected by eye movement and compression)
    ctx.fillStyle = '#000000'; // Black pupils

    // Left Pupil (with scaling)
    ctx.save();
    ctx.translate(leftEyeX + pupilOffsetX, eyeY + pupilOffsetY);
    ctx.scale(1.0, pupilScaleY); // Scale pupil to match eye compression
    ctx.beginPath();
    ctx.arc(0, 0, pupilRadius, 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();

    // Right Pupil (with scaling)
    ctx.save();
    ctx.translate(rightEyeX + pupilOffsetX, eyeY + pupilOffsetY);
    ctx.scale(1.0, pupilScaleY); // Scale pupil to match eye compression
    ctx.beginPath();
    ctx.arc(0, 0, pupilRadius, 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();
}