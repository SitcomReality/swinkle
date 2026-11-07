/**
 * playerRenderer.js
 * Handles rendering the player character (anchor, body, limbs, eyes, name)
 * and their associated held paint can and bungee.
 * Calls a separate module for rendering active power-up effects on the player.
 */
import config from './config.js';
import { getPlayerPhysicsState } from './playerState.js';
import { getPlayerCollisionState } from './player-collision-state.js';
// Import the specific color utils needed
import { calculatePaintOnlyBlendedColor, calculateTotalPaintPercentage, calculateBlendedColor } from './colorUtils.js';
import { renderPaintCan } from './paintCan.js'; // Import renderPaintCan
// Import the new power-up effects renderer
import { renderPlayerPowerUpEffects } from './player-effects-renderer.js';
// Import the new player expressions module
import { calculateEyeMovement, calculateEyeExpression, renderPlayerEyes } from './player-expressions.js';

// Duration for the respawn fade-in animation (MUST match respawn-manager.js)
const RESPAWN_ANIM_DURATION = 500; // milliseconds
// Duration to hide the player at the start of the respawn animation (allows sparkle effect)
const RESPAWN_INITIAL_HIDE_DURATION = 150; // milliseconds
const RESPAWN_FADE_IN_DURATION = RESPAWN_ANIM_DURATION - RESPAWN_INITIAL_HIDE_DURATION;

/**
 * Renders a single player character, including anchor, body, bungee cord, limbs,
 * and their held paint can if applicable. Calls effect renderer for power-up visuals.
 * Uses the physics state's `lastAnchorPos` for accurate anchor rendering.
 * Handles fade-in effect during respawn animation.
 * If the player is lost, only renders the anchor and "INKED OUT!" message.
 *
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {string} clientId - The ID of the player being rendered.
 * @param {string} localClientId - The ID of the current user's client.
 * @param {object} presence - The player's presence data (color, paintedData, currentCanId, power-up flags, activePowerUps, isSpectating, lost, respawnAnimEndTime).
 * @param {object} peer - The player's peer data (username, avatarUrl).
 * @param {object} allPaintCansState - The current state of all paint cans from roomState.paintCans.
 * @param {object} roomInstance - The WebsimSocket room instance.
 */
export function renderPlayer(ctx, clientId, localClientId, presence, peer, allPaintCansState, roomInstance) {
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
        // Player is lost, only render the "INKED OUT!" message and exit
        ctx.save();
        ctx.fillStyle = config.lossMessageColor || '#FFFFFF';
        ctx.font = config.lossMessageFont || '24px sans-serif';
        ctx.textAlign = 'center';
        // Use physics state position to place the text correctly even if body isn't rendered
        const bodyX = physicsState.position.x;
        const bodyY = physicsState.position.y;
        const bodyHeight = config.playerBodyHeight || 30;
        ctx.fillText("INKED OUT!", bodyX, bodyY - bodyHeight / 2 - 15); // Position above where body would be
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
    ctx.fillStyle = config.playerBodyColor || '#DDDDDD'; // Use base body color (gray)
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

    // Get collision state for expressions
    const collisionState = getPlayerCollisionState(clientId);

    // --- Render Eyes (Relative to Rotated Body Center) ---
    const eyeRadius = config.playerEyeRadius || 4;
    const eyeOffsetX = config.playerEyeOffsetX || 6;
    const eyeOffsetY = config.playerEyeOffsetY || -3;
    
    // Create game state object for eye targeting with required functions
    const gameState = {
        getPlayerPhysicsState: getPlayerPhysicsState
    };
    
    // Calculate eye movement parameters - UPDATED with new parameters
    const eyeMovement = calculateEyeMovement(
        { x: bodyX, y: bodyY },
        { x: anchorX, y: anchorY },
        bodyAngle,
        clientId === localClientId, // Whether this is the local player
        isSpectating,
        clientId,                   // Pass client ID for targeting state
        roomInstance,               // Pass room instance for game state access
        gameState                   // Pass game state object with required functions
    );
    
    // Calculate eye expression based on player state and collisions
    const eyeExpression = calculateEyeExpression(presence, now, collisionState);
    
    // Render the eyes with calculated movement and expression
    renderPlayerEyes(ctx, eyeOffsetX, eyeOffsetY, eyeMovement, eyeExpression);

    // --- Restore Context After Body/Eyes Rotation ---
    ctx.restore(); // Restore translation and rotation (alpha is still combinedAlpha)

    // --- Render Player Name (Not Rotated) ---
    // Alpha is still combinedAlpha
    ctx.fillStyle = config.nameColor || '#FFF';
    ctx.font = config.nameFont || '12px sans-serif';
    ctx.textAlign = 'center';
    const nameYOffset = (bodyHeight / 2) + 14; // Position below the capsule (world Y)
    ctx.fillText(peer.username, bodyX, bodyY + nameYOffset);

    // --- Render Active Power-Up Effects (Calls the new module) ---
    renderPlayerPowerUpEffects(ctx, clientId, localClientId, presence, peer, physicsState);

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