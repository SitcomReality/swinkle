/**
 * respawn-manager.js
 * Handles player respawn logic
 */
import { addNotification } from './notification-manager.js'; // Import notification function
import { room } from './main.js'; // Import room to access peers
import config from 'config'; // Import config for spawn coordinates

/**
 * Checks if a player should respawn and generates presence updates
 * @param {string} localClientId - The ID of the local client
 * @param {object} localPresence - The local player's presence data
 * @param {number} now - Current timestamp
 * @param {number} gameAreaWidth - Width of the game area from config
 * @param {number} gameAreaHeight - Height of the game area from config
 * @returns {object} Presence updates for respawn
 */
export function checkPlayerRespawn(localClientId, localPresence, now, gameAreaWidth, gameAreaHeight) {
    if (localPresence.lost && localPresence.respawnTime && now >= localPresence.respawnTime) {
        console.log(`Respawning player ${localClientId}`);

        // Get username for notification
        const username = room.peers[localClientId].username || 'Player';
        addNotification(`${username} respawned!`, 'info', 3000);

        // Spawn in the middle of the defined game area
        const spawnX = gameAreaWidth / 2;
        const spawnY = gameAreaHeight / 2;

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