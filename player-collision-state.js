/**
 * player-collision-state.js
 * Tracks collision states for players to enable reactive expressions
 */

// Store collision timestamps by clientId
const playerCollisionStates = new Map();

/**
 * Records a collision event for a player
 * @param {string} clientId - The player's client ID
 * @param {string} collisionType - Type of collision (e.g., 'level', 'boundary')
 */
export function recordPlayerCollision(clientId, collisionType) {
    if (!playerCollisionStates.has(clientId)) {
        playerCollisionStates.set(clientId, {
            hasCollided: true,
            lastCollisionTime: Date.now(),
            collisionType: collisionType
        });
    } else {
        const state = playerCollisionStates.get(clientId);
        state.hasCollided = true;
        state.lastCollisionTime = Date.now();
        state.collisionType = collisionType;
    }
}

/**
 * Gets the current collision state for a player
 * @param {string} clientId - The player's client ID
 * @returns {object|null} Collision state or null if no recent collisions
 */
export function getPlayerCollisionState(clientId) {
    return playerCollisionStates.get(clientId) || null;
}

/**
 * Clears stale collision states (called periodically)
 * @param {number} now - Current timestamp
 * @param {number} staleThreshold - Time in ms after which a collision is considered stale
 */
export function cleanupStaleCollisionStates(now, staleThreshold = 500) {
    playerCollisionStates.forEach((state, clientId) => {
        if (now - state.lastCollisionTime > staleThreshold) {
            playerCollisionStates.delete(clientId);
        }
    });
}