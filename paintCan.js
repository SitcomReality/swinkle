/**
 * paintCan.js
 * Handles paint can rendering and physics simulation.
 */
import config from 'config';

/**
 * Updates the physics simulation for a paint can attached to a player.
 * @param {object} canState - The state object for the can { x, y, vx, vy }.
 * @param {object} playerBodyPos - The current position of the player's body {x, y}.
 * @param {number} deltaTime - Time elapsed since the last frame in seconds.
 */
export function updatePaintCanPhysics(canState, playerBodyPos, deltaTime) {
    // Physics Constants from Config (specific to paint can bungee)
    const k = config.paintCanBungeeSpringConstant;
    const restLength = config.paintCanBungeeRestLength;
    const damping = config.paintCanBungeeDampingFactor;
    const gravity = config.gravityAcceleration * config.paintCanGravityFactor;
    const mass = config.paintCanMass;
    const maxLength = restLength * config.paintCanBungeeMaxLengthMultiplier;

    // Attachment point is the player's body position
    const attachmentPoint = { x: playerBodyPos.x, y: playerBodyPos.y };

    // Calculate vector from can to its attachment point
    const dx = attachmentPoint.x - canState.x;
    const dy = attachmentPoint.y - canState.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    const stretch = distance - restLength;

    // Normalize direction vector
    let normDx = 0, normDy = 0;
    if (distance > 0.01) {
        normDx = dx / distance;
        normDy = dy / distance;
    }

    // --- Forces ---
    // Spring Force (pulls can towards attachment point)
    const springForceMagnitude = k * stretch;
    const springForceX = normDx * springForceMagnitude;
    const springForceY = normDy * springForceMagnitude;

    // Gravity Force
    const gravityForceY = gravity * mass;

    // Total Force
    const totalForceX = springForceX;
    const totalForceY = springForceY + gravityForceY;

    // --- Acceleration & Velocity ---
    const accelerationX = totalForceX / mass;
    const accelerationY = totalForceY / mass;

    // Initialize velocity if it doesn't exist (e.g., first frame after pickup)
    if (typeof canState.vx !== 'number') canState.vx = 0;
    if (typeof canState.vy !== 'number') canState.vy = 0;

    canState.vx += accelerationX * deltaTime;
    canState.vy += accelerationY * deltaTime;

    // Apply Damping (using Math.pow for frame rate independence)
    canState.vx *= Math.pow(damping, deltaTime * 60);
    canState.vy *= Math.pow(damping, deltaTime * 60);

    // --- Update Position ---
    canState.x += canState.vx * deltaTime;
    canState.y += canState.vy * deltaTime;

    // --- Max Length Constraint (relative to attachment point) ---
    const newDx = attachmentPoint.x - canState.x;
    const newDy = attachmentPoint.y - canState.y;
    const newDistance = Math.sqrt(newDx * newDx + newDy * newDy);

    if (newDistance > maxLength) {
        const clampRatio = maxLength / newDistance;
        canState.x = attachmentPoint.x - newDx * clampRatio;
        canState.y = attachmentPoint.y - newDy * clampRatio;

        // Dampen velocity component moving away from attachment point
        const canDirX = newDx / newDistance;
        const canDirY = newDy / newDistance;
        const dotProduct = canState.vx * canDirX + canState.vy * canDirY;
        if (dotProduct > 0) {
            canState.vx -= dotProduct * canDirX;
            canState.vy -= dotProduct * canDirY;
        }
    }
}

/**
 * Renders a paint can.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {object} canState - The state of the paint can { x, y, paintColor, paintAmount, isCharging, accumulatedDroplets }.
 */
export function renderPaintCan(ctx, canState) {
    const x = canState.x;
    const y = canState.y;
    const width = config.paintCanWidth;
    const height = config.paintCanHeight;
    const color = canState.paintColor || '#CCCCCC'; // Default grey if no color
    const strokeColor = config.paintCanStrokeColor;
    const strokeWidth = config.paintCanStrokeWidth;

    // Draw can body (rectangle)
    ctx.fillStyle = '#DDDDDD'; // Can metal color
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.rect(x - width / 2, y - height / 2, width, height);
    ctx.fill();
    ctx.stroke();

    // Draw paint level indicator (filled rectangle inside)
    const maxAmount = config.paintCanInitialAmount;
    const currentAmount = canState.paintAmount || 0;
    const fillRatio = Math.max(0, Math.min(1, currentAmount / maxAmount));
    const fillHeight = height * fillRatio;
    const fillY = y + height / 2 - fillHeight; // Start from bottom

    if (fillHeight > 0) {
        ctx.fillStyle = color;
        ctx.beginPath();
        // Inset the fill slightly
        const inset = strokeWidth * 1.5;
        ctx.rect(
            x - width / 2 + inset,
            fillY + inset / 2, // Adjust Y based on bottom alignment
            width - inset * 2,
            fillHeight - inset * 1.5 // Adjust height slightly more
        );
        ctx.fill();
    }

    // Draw label area (simple band for now)
    ctx.fillStyle = '#EEEEEE';
    ctx.beginPath();
    const labelHeight = height * 0.3;
    const labelY = y - labelHeight * 0.5; // Center vertically
    ctx.rect(x - width / 2, labelY, width, labelHeight);
    ctx.fill();
    // Maybe add a small color swatch on the label later
    ctx.fillStyle = color;
    ctx.beginPath();
    const swatchSize = width * 0.4;
    ctx.rect(x - swatchSize / 2, labelY + labelHeight*0.1, swatchSize, labelHeight*0.8);
    ctx.fill();


    // Simple top lip
    ctx.fillStyle = '#CCCCCC';
    ctx.beginPath();
    ctx.rect(x - width / 2 - strokeWidth, y - height / 2 - 2, width + strokeWidth*2, 2);
    ctx.fill();
    ctx.stroke();

    // Draw Charge Indicator
    if (canState.isCharging && config.paintCanMaxAccumulatedDroplets > 0) {
        const chargeBarWidth = config.paintCanChargeIndicatorWidth;
        const chargeBarHeight = config.paintCanChargeIndicatorHeight;
        const chargeBarX = x - chargeBarWidth / 2;
        const chargeBarY = y - height / 2 - chargeBarHeight - 4; // Position above the can lip

        const accumulated = canState.accumulatedDroplets || 0;
        const maxAccumulated = config.paintCanMaxAccumulatedDroplets;
        const chargeRatio = Math.min(1, Math.max(0, accumulated / maxAccumulated));

        // Draw background/outline for the bar (optional, can be nice)
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(chargeBarX, chargeBarY, chargeBarWidth, chargeBarHeight);

        // Draw filled portion
        if (chargeRatio > 0) {
            ctx.fillStyle = config.paintCanChargeIndicatorColor;
            ctx.fillRect(chargeBarX, chargeBarY, chargeBarWidth * chargeRatio, chargeBarHeight);
        }
    }
}