/**
 * respawn-manager.js
 * Handles player respawn logic
 */
import { addNotification } from './notification-manager.js'; // Import notification function
// Import room to access peers for username lookup
import { room } from './main.js';
import config from 'config'; // Import config for spawn coordinates, player color
import { removeSpectatorState } from './spectate-mode.js'; // Import spectator state cleanup
import { addEffect } from './effectsRenderer.js'; // Import addEffect
// Import utility to calculate paint percentage
import { calculateTotalPaintPercentage } from './colorUtils.js';

// Duration for the respawn fade-in animation
const RESPAWN_ANIM_DURATION = 500; // milliseconds

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
        // Pass the current presence to conditionally reset paint
        // Pass gameArea dimensions for fallback positioning
        return triggerManualRespawn(localClientId, localPresence, gameAreaWidth, gameAreaHeight, now);
    }
    return {};
}

/**
 * Generates the presence update object needed for a player to respawn or rejoin manually.
 * Resets relevant state and places the player at their last cursor location (or center as fallback).
 * Conditionally resets paintedData based on whether the player was fully painted out.
 * Also cleans up spectator state and adds a visual effect using the player's base color.
 * Sets the animation end time for the fade-in effect.
 * Does NOT send notification (callers should handle that).
 * @param {string} clientId - The ID of the client respawning.
 * @param {object} currentPresence - The presence data of the player *before* respawning.
 * @param {number} gameAreaWidth - Width of the game area from config.
 * @param {number} gameAreaHeight - Height of the game area from config.
 * @param {number} now - The current timestamp (Date.now()).
 * @returns {object} Presence updates for respawn/rejoin.
 */
export function triggerManualRespawn(clientId, currentPresence, gameAreaWidth, gameAreaHeight, now) {
    console.log(`Generating respawn/rejoin presence update for player ${clientId}`);

    let spawnX = gameAreaWidth / 2;
    let spawnY = gameAreaHeight / 2;

    // Use player's last known anchor point (cursor position) if available in presence
    if (currentPresence && typeof currentPresence.x === 'number' && typeof currentPresence.y === 'number') {
        spawnX = currentPresence.x;
        spawnY = currentPresence.y;
        console.log(`Respawning player ${clientId} at cursor location: (${spawnX.toFixed(0)}, ${spawnY.toFixed(0)})`);
    } else {
        console.warn(`Player ${clientId} respawning at center due to missing/invalid cursor location in presence.`);
    }

    // Clamp spawn coordinates to ensure they are within the game area (just in case presence data is weird)
    spawnX = Math.max(0, Math.min(gameAreaWidth, spawnX));
    spawnY = Math.max(0, Math.min(gameAreaHeight, spawnY));

    // Clean up spectator state upon respawn/rejoin
    removeSpectatorState(clientId);

    // Get player's base color for the effect
    // Use presence.color if available, otherwise fallback to config default
    const playerBaseColor = currentPresence?.color || config.defaultPlayerColor || '#FFFFFF';

    // Add respawn visual effect, passing the base color
    addEffect('respawnSparkle', {
        x: spawnX,
        y: spawnY,
        baseColor: playerBaseColor // Pass the determined base color
    });

    // Determine if paint should be reset
    // Reset paint ONLY if the player was previously 'lost' (i.e., fully painted)
    // Initial join paint reset is handled by the initial presence update in main.js
    const shouldResetPaint = currentPresence?.lost === true;

    console.log(`Player ${clientId} respawning. Was lost: ${currentPresence?.lost}. Resetting paint: ${shouldResetPaint}`);

    // Prepare the presence update object
    const respawnUpdates = {
        lost: false,            // No longer lost
        respawnTime: null,      // Clear respawn timer
        currentCanId: null,     // Ensure no can on respawn/rejoin
        x: spawnX,              // Reset anchor position to cursor location (or center fallback)
        y: spawnY,
        isSpectating: false,    // Player is no longer spectating
        respawnAnimEndTime: now + RESPAWN_ANIM_DURATION, // Set animation end time
        // Keep score, reset power-ups? (Currently keeping score, powerups time out)
    };

    // Conditionally add paintedData reset
    if (shouldResetPaint) {
        respawnUpdates.paintedData = {}; // Clear paint
    } else {
        // If not resetting paint, ensure paintedData exists if it did before
        // (although updatePresence usually merges, explicit is safer)
        respawnUpdates.paintedData = currentPresence?.paintedData || {};
    }

    // Return the presence update object
    return respawnUpdates;
}