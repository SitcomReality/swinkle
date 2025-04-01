/**
 * respawn-manager.js
 * Handles player respawn logic
 */
import { addNotification } from './notification-manager.js'; // Import notification function
// Import room to access peers for username lookup
import { room } from './main.js';
import config from 'config'; // Import config for spawn coordinates
import { removeSpectatorState } from './spectate-mode.js'; // Import spectator state cleanup
import { addEffect } from './effectsRenderer.js'; // Import addEffect

/**
 * Checks if a player should respawn based on timer and generates presence updates.
 * Also sends a notification upon automatic respawn.
 * @param {string} localClientId - The ID of the local client
 * @param {object} localPresence - The local player's presence data
 * @param {number} now - Current timestamp
 * @param {number} gameAreaWidth - Width of the game area from config
 * @param {number} gameAreaHeight - Height of the game area from config
 * @returns {object} Presence updates for respawn
 */
export function checkPlayerRespawn(localClientId, localPresence, now, gameAreaWidth, gameAreaHeight) {
    // Check for respawn timer completion
    if (localPresence.lost && localPresence.respawnTime && now >= localPresence.respawnTime) {
        console.log(`Respawning player ${localClientId} after loss`);

        // Get username for notification
        const username = room.peers[localClientId]?.username || 'Player';
        addNotification(`${username} respawned!`, 'info', 3000);

        // Generate and return the respawn presence update object
        // triggerManualRespawn handles the effect and spectator cleanup
        return triggerManualRespawn(localClientId, gameAreaWidth, gameAreaHeight);
    }
    return {};
}

/**
 * Generates the presence update object needed for a player to respawn or rejoin manually.
 * Resets relevant state and places the player in the center.
 * Also cleans up spectator state and adds a visual effect.
 * Does NOT send notification (callers should handle that).
 * @param {string} clientId - The ID of the client respawning.
 * @param {number} gameAreaWidth - Width of the game area from config.
 * @param {number} gameAreaHeight - Height of the game area from config.
 * @returns {object} Presence updates for respawn/rejoin.
 */
export function triggerManualRespawn(clientId, gameAreaWidth, gameAreaHeight) {
    console.log(`Generating respawn/rejoin presence update for player ${clientId}`);

    // Spawn in the middle of the defined game area
    const spawnX = gameAreaWidth / 2;
    const spawnY = gameAreaHeight / 2;

    // Clean up spectator state upon respawn/rejoin
    removeSpectatorState(clientId);

    // Add respawn visual effect
    addEffect('respawnSparkle', { x: spawnX, y: spawnY });

    // Return the presence update object
    return {
        lost: false,            // No longer lost
        paintedData: {},        // Clear paint
        respawnTime: null,      // Clear respawn timer
        currentCanId: null,     // Ensure no can on respawn/rejoin
        x: spawnX,              // Reset anchor position to center
        y: spawnY,
        isSpectating: false,    // Player is no longer spectating
        // Keep score, potentially reset other power-up states if necessary?
        // For now, only reset core respawn-related fields.
    };
}