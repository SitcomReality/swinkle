/**
 * respawn-manager.js
 * Handles player respawn logic
 */

/**
 * Checks if a player should respawn and generates presence updates
 * @param {string} localClientId - The ID of the local client
 * @param {object} localPresence - The local player's presence data
 * @param {number} now - Current timestamp
 * @param {number} canvasWidth - Width of the game canvas
 * @param {number} canvasHeight - Height of the game canvas
 * @returns {object} Presence updates for respawn
 */
export function checkPlayerRespawn(localClientId, localPresence, now, canvasWidth, canvasHeight) {
    if (localPresence?.lost && localPresence.respawnTime && now >= localPresence.respawnTime) {
        console.log(`Respawning player ${localClientId}`);
        
        const spawnX = canvasWidth / 2;
        const spawnY = canvasHeight / 2;
        
        return {
            lost: false,
            paintedData: {},
            respawnTime: null,
            currentCanId: null, // Ensure no can on respawn
            x: spawnX, // Reset anchor position
            y: spawnY
        };
    }
    
    return {};
}