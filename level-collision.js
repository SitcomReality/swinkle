/**
 * level-collision.js
 * Handles collision detection and response between dynamic objects (players, cans)
 * and static level geometry.
 */
import config from 'config';
import { getCurrentLevel } from './level-manager.js';
import { recordPlayerCollision } from './player-collision-state.js';

/**
 * Checks for collision between a circular representation of an object
 * and a potentially rotated rectangular obstacle.
 * Uses Separating Axis Theorem (SAT) for accuracy with rotation.
 * @param {object} objectState - Physics state with position {x, y}.
 * @param {object} obstacle - Level obstacle data { x, y, width, height, angle }.
 * @param {number} objectRadius - Approximate radius for collision check.
 * @returns {object|null} Collision details { overlap, normal: {x, y} } or null if no collision.
 */
function checkCircleRotatedRectCollision(objectState, obstacle, objectRadius) {
    const circlePos = objectState.position;
    const rectCenter = { x: obstacle.x, y: obstacle.y };
    const rectHalfWidth = obstacle.width / 2;
    const rectHalfHeight = obstacle.height / 2;
    const rectAngle = obstacle.angle || 0; // Default angle is 0

    // Transform circle center to rectangle's local coordinates
    const cosA = Math.cos(-rectAngle);
    const sinA = Math.sin(-rectAngle);
    const dx = circlePos.x - rectCenter.x;
    const dy = circlePos.y - rectCenter.y;
    const localCircleX = dx * cosA - dy * sinA;
    const localCircleY = dx * sinA + dy * cosA;

    // Find the closest point on the AABB in the rectangle's local space
    const closestX = Math.max(-rectHalfWidth, Math.min(localCircleX, rectHalfWidth));
    const closestY = Math.max(-rectHalfHeight, Math.min(localCircleY, rectHalfHeight));

    // Calculate the distance squared between the local circle center and this closest point
    const localDistX = localCircleX - closestX;
    const localDistY = localCircleY - closestY;
    const distanceSquared = (localDistX * localDistX) + (localDistY * localDistY);

    // If the distance is less than the radius squared, an overlap occurs
    if (distanceSquared < (objectRadius * objectRadius)) {
        // Collision detected! Calculate overlap and normal
        const distance = Math.sqrt(distanceSquared);
        const overlap = objectRadius - distance;

        if (distance < 0.001) {
            // Circle center is inside the rectangle - push out along axis with min overlap
            const overlapX = objectRadius + (localCircleX > 0 ? rectHalfWidth - localCircleX : rectHalfWidth + localCircleX);
            const overlapY = objectRadius + (localCircleY > 0 ? rectHalfHeight - localCircleY : rectHalfHeight + localCircleY);
             if (overlapX < overlapY) {
                 const normalX_local = localCircleX > 0 ? 1 : -1;
                 const normalY_local = 0;
                 // Rotate normal back to world space
                 const normalX_world = normalX_local * Math.cos(rectAngle) - normalY_local * Math.sin(rectAngle);
                 const normalY_world = normalX_local * Math.sin(rectAngle) + normalY_local * Math.cos(rectAngle);
                 return { overlap: overlapX, normal: { x: normalX_world, y: normalY_world } };
             } else {
                 const normalX_local = 0;
                 const normalY_local = localCircleY > 0 ? 1 : -1;
                 // Rotate normal back to world space
                 const normalX_world = normalX_local * Math.cos(rectAngle) - normalY_local * Math.sin(rectAngle);
                 const normalY_world = normalX_local * Math.sin(rectAngle) + normalY_local * Math.cos(rectAngle);
                 return { overlap: overlapY, normal: { x: normalX_world, y: normalY_world } };
             }

        } else {
            // Push out from the closest point direction
            const normalX_local = localDistX / distance;
            const normalY_local = localDistY / distance;
            // Rotate normal back to world space
            const normalX_world = normalX_local * Math.cos(rectAngle) - normalY_local * Math.sin(rectAngle);
            const normalY_world = normalX_local * Math.sin(rectAngle) + normalY_local * Math.cos(rectAngle);
            return { overlap, normal: { x: normalX_world, y: normalY_world } };
        }
    }

    return null; // No collision
}


/**
 * Resolves collision between a dynamic object and a static rectangle obstacle.
 * Modifies the object's position and velocity directly.
 * Uses collision normal for more accurate response.
 * @param {object} objectState - The physics state object { position: {x, y}, velocity: {x, y} }
 * @param {object} obstacle - The obstacle data object { properties: { friction, restitution } }.
 * @param {object} collisionInfo - Result from collision check { overlap, normal: {x, y} }.
 */
function resolveCollision(objectState, obstacle, collisionInfo) {
    const objPos = objectState.position;
    const objVel = objectState.velocity;
    const normal = collisionInfo.normal;
    const overlap = collisionInfo.overlap;

    // Default physics properties if not defined on the obstacle
    const restitution = obstacle.properties?.restitution ?? 0.1; // Default slight bounce
    const friction = obstacle.properties?.friction ?? 0.9;     // Default friction

    // --- Positional Correction ---
    // Push the object out of the obstacle along the collision normal
    // Use a small buffer (slop) to prevent constant contact / jitter
    const slop = 0.01;
    const correctionMagnitude = Math.max(0, overlap - slop);
    objPos.x += normal.x * correctionMagnitude;
    objPos.y += normal.y * correctionMagnitude;

    // --- Velocity Resolution ---
    // Calculate relative velocity along the normal
    const normalVelocity = objVel.x * normal.x + objVel.y * normal.y;

    // If object is moving into the wall, apply bounce and friction
    if (normalVelocity < 0) {
        // Calculate impulse magnitude for bounce (restitution)
        // Simplified impulse calculation (assuming obstacle mass is infinite)
        const impulseMagnitude = -(1 + restitution) * normalVelocity;

        // Apply bounce impulse along the normal
        objVel.x += normal.x * impulseMagnitude;
        objVel.y += normal.y * impulseMagnitude;

        // Calculate tangential velocity vector
        const tangent = { x: -normal.y, y: normal.x };
        const tangentVelocity = objVel.x * tangent.x + objVel.y * tangent.y;

        // Apply friction impulse opposing tangential velocity
        // Simple friction model: reduce tangential velocity directly
        // A more accurate model uses impulse magnitude and friction coefficients
        objVel.x -= tangent.x * tangentVelocity * (1 - friction);
        objVel.y -= tangent.y * tangentVelocity * (1 - friction);
    }
}

/**
 * Checks and resolves collisions between the player's body and level obstacles.
 * Modifies the player's physics state directly if a collision occurs.
 * Skips checks if player is spectating.
 * @param {object} playerState - The player's full physics state object.
 * @param {object} presence - The player's presence data (needed to check isSpectating).
 * @param {string} clientId - The player's client ID (for collision state tracking)
 */
export function handlePlayerLevelCollision(playerState, presence, clientId) {
    const levelData = getCurrentLevel();
    // Skip if no level, no state, or if the player is spectating
    if (!levelData || !levelData.obstacles || !playerState || presence?.isSpectating) {
        return;
    }

    // Using half-width as a rough radius for collision detection/response
    const playerRadius = config.playerBodyWidth / 2;
    let hasCollided = false;

    levelData.obstacles.forEach(obstacle => {
        if (obstacle.type === 'rectangle') {
            const collisionInfo = checkCircleRotatedRectCollision(playerState, obstacle, playerRadius);
            if (collisionInfo) {
                resolveCollision(playerState, obstacle, collisionInfo);
                hasCollided = true; // Track that a collision occurred
            }
        }
        // Add checks for other obstacle types later
    });

    // Check boundary collisions
    const boundaryCollision = checkBoundaryCollision(playerState);
    if (boundaryCollision) {
        hasCollided = true;
    }

    // Record collision state if a collision occurred
    if (hasCollided && clientId) {
        recordPlayerCollision(clientId, 'level');
    }
}

/**
 * Checks if player collided with game area boundaries
 * @param {object} playerState - The player's physics state
 * @returns {boolean} True if a boundary collision occurred
 */
function checkBoundaryCollision(playerState) {
    const playerRadius = config.playerBodyWidth / 2;
    const playerHalfHeight = config.playerBodyHeight / 2;
    
    return (
        playerState.position.x - playerRadius <= 0 || 
        playerState.position.x + playerRadius >= config.gameAreaWidth ||
        playerState.position.y - playerHalfHeight <= 0 ||
        playerState.position.y + playerHalfHeight >= config.gameAreaHeight
    );
}

/**
 * Checks and resolves collisions between a paint can and level obstacles.
 * Modifies the can's state directly if a collision occurs.
 * @param {object} canState - The paint can's state object { x, y, vx, vy }.
 */
export function handleCanLevelCollision(canState) {
     const levelData = getCurrentLevel();
     if (!levelData || !levelData.obstacles || !canState) return;

     // Using half-width as a rough radius
     const canRadius = config.paintCanWidth / 2;
     // Need to adapt canState to the { position: {x, y}, velocity: {x, y} } format
     const adaptedCanState = {
         position: { x: canState.x, y: canState.y },
         velocity: { x: canState.vx || 0, y: canState.vy || 0 }
     };

     levelData.obstacles.forEach(obstacle => {
         if (obstacle.type === 'rectangle') {
             const collisionInfo = checkCircleRotatedRectCollision(adaptedCanState, obstacle, canRadius);
             if (collisionInfo) {
                 resolveCollision(adaptedCanState, obstacle, collisionInfo);
                 // Update original canState with resolved position/velocity
                 canState.x = adaptedCanState.position.x;
                 canState.y = adaptedCanState.position.y;
                 canState.vx = adaptedCanState.velocity.x;
                 canState.vy = adaptedCanState.velocity.y;
             }
         }
         // Add checks for other obstacle types later
     });
}