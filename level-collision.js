/**
 * level-collision.js
 * Handles collision detection and response between dynamic objects (players, cans)
 * and static level geometry.
 */
import config from 'config';
import { getCurrentLevel } from './level-manager.js';

/**
 * Checks for collision between a circular representation of an object (e.g., player body center)
 * and a rectangular obstacle. Basic AABB check for simplicity.
 * A more accurate capsule vs rectangle or SAT collision would be better later.
 * @param {object} objectState - Physics state with position {x, y}.
 * @param {object} obstacle - Level obstacle data { x, y, width, height }.
 * @param {number} objectRadius - Approximate radius for collision check.
 * @returns {boolean} True if colliding, false otherwise.
 */
function checkCircleRectCollision(objectState, obstacle, objectRadius) {
    const circle = { x: objectState.position.x, y: objectState.position.y, radius: objectRadius };
    const rect = {
        left: obstacle.x - obstacle.width / 2,
        right: obstacle.x + obstacle.width / 2,
        top: obstacle.y - obstacle.height / 2,
        bottom: obstacle.y + obstacle.height / 2
    };

    // Find the closest point to the circle within the rectangle
    const closestX = Math.max(rect.left, Math.min(circle.x, rect.right));
    const closestY = Math.max(rect.top, Math.min(circle.y, rect.bottom));

    // Calculate the distance between the circle's center and this closest point
    const distanceX = circle.x - closestX;
    const distanceY = circle.y - closestY;

    // If the distance is less than the circle's radius, an overlap occurs
    const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    return distanceSquared < (circle.radius * circle.radius);
}

/**
 * Resolves collision between a dynamic object and a static rectangle obstacle.
 * Modifies the object's position and velocity directly.
 * Basic response: push out, apply friction and restitution.
 * @param {object} objectState - The physics state object { position: {x, y}, velocity: {x, y} }
 * @param {object} obstacle - The obstacle data object { x, y, width, height, properties: { friction, restitution } }.
 * @param {number} objectRadius - Approximate radius used for collision check.
 */
function resolveCollision(objectState, obstacle, objectRadius) {
    const objPos = objectState.position;
    const objVel = objectState.velocity;
    const rectCenterX = obstacle.x;
    const rectCenterY = obstacle.y;
    const rectHalfWidth = obstacle.width / 2;
    const rectHalfHeight = obstacle.height / 2;

    // Default physics properties if not defined on the obstacle
    const restitution = obstacle.properties?.restitution ?? 0.1; // Default slight bounce
    const friction = obstacle.properties?.friction ?? 0.9;     // Default friction

    const dx = objPos.x - rectCenterX; // Vector from rect center to circle center
    const dy = objPos.y - rectCenterY;

    // Calculate overlap in x and y directions
    const overlapX = (rectHalfWidth + objectRadius) - Math.abs(dx);
    const overlapY = (rectHalfHeight + objectRadius) - Math.abs(dy);

    // Only resolve if there's actually an overlap (should always be true if called after collision check)
    if (overlapX > 0 && overlapY > 0) {
        // Determine minimum push direction
        if (overlapX < overlapY) {
            // Push horizontally
            const pushSign = dx > 0 ? 1 : -1;
            objPos.x += pushSign * overlapX; // Push out

            // Apply restitution and friction
            // Velocity component perpendicular to the surface (normal velocity)
            const normalVelX = objVel.x;
            // Velocity component parallel to the surface (tangential velocity)
            const tangentVelY = objVel.y;

            // Modify velocity based on collision response
            objVel.x = -normalVelX * restitution; // Reverse and dampen normal velocity (bounce)
            objVel.y = tangentVelY * friction;    // Apply friction to tangential velocity

        } else {
            // Push vertically
            const pushSign = dy > 0 ? 1 : -1;
            objPos.y += pushSign * overlapY; // Push out

            // Apply restitution and friction
            // Velocity component perpendicular to the surface (normal velocity)
            const normalVelY = objVel.y;
            // Velocity component parallel to the surface (tangential velocity)
            const tangentVelX = objVel.x;

            // Modify velocity based on collision response
            objVel.y = -normalVelY * restitution; // Reverse and dampen normal velocity (bounce)
            objVel.x = tangentVelX * friction;    // Apply friction to tangential velocity
        }
    }
}

/**
 * Checks and resolves collisions between the player's body and level obstacles.
 * Modifies the player's physics state directly if a collision occurs.
 * @param {object} playerState - The player's full physics state object.
 */
export function handlePlayerLevelCollision(playerState) {
    const levelData = getCurrentLevel();
    if (!levelData || !levelData.obstacles || !playerState) return;

    // Using half-width as a rough radius for collision detection/response
    const playerRadius = config.playerBodyWidth / 2;

    levelData.obstacles.forEach(obstacle => {
        if (obstacle.type === 'rectangle') {
            if (checkCircleRectCollision(playerState, obstacle, playerRadius)) {
                resolveCollision(playerState, obstacle, playerRadius);
            }
        }
        // Add checks for other obstacle types later
    });

    // Note: Limbs are ignored for now
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
             if (checkCircleRectCollision(adaptedCanState, obstacle, canRadius)) {
                 resolveCollision(adaptedCanState, obstacle, canRadius);
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