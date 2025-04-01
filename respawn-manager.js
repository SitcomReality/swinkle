/**
 * respawn-manager.js
 * Handles player respawn logic
 */
import { addNotification } from './notification-manager.js'; // Import notification function
// Import room to access peers for username lookup
import { room } from './main.js';
import config from 'config'; // Import config for spawn coordinates, player color
import { removeSpectatorState, enterSpectateMode } from './spectate-mode.js'; // Import spectator state cleanup and enterSpectateMode
import { addEffect } from './effectsRenderer.js'; // Import addEffect
// Import utility to calculate paint percentage
import { calculateTotalPaintPercentage } from './colorUtils.js';
import { broadcastNotification } from './notification-broadcaster.js'; // Add import

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
        console.log(`Player ${localClientId} respawn time reached - entering spectate mode`);

        // Instead of respawning automatically, enter spectate mode
        enterSpectateMode(localClientId, room);
        
        // Return empty updates - enterSpectateMode handles the presence changes
        return {};
    }
    return {};
}

/**
 * Generates the presence update object needed for a player to respawn or rejoin manually.
 * Resets relevant state and places the player at their last cursor location (or center as fallback),
 * *or* at specific coordinates if provided (e.g., from a click event).
 * Conditionally resets paintedData based on whether the player was fully painted out.
 * Also cleans up spectator state and adds a visual effect using the player's base color.
 * Sets the animation end time for the fade-in effect.
 * Does NOT send notification (callers should handle that).
 * @param {string} clientId - The ID of the client respawning.
 * @param {object} currentPresence - The presence data of the player *before* respawning.
 * @param {number} gameAreaWidth - Width of the game area from config.
 * @param {number} gameAreaHeight - Height of the game area from config.
 * @param {number} now - The current timestamp (Date.now()).
 * @param {number} [clickX] - Optional specific X coordinate for spawning (e.g., from click).
 * @param {number} [clickY] - Optional specific Y coordinate for spawning (e.g., from click).
 * @returns {object} Presence updates for respawn/rejoin.
 */
export function triggerManualRespawn(clientId, currentPresence, gameAreaWidth, gameAreaHeight, now, clickX, clickY) {
    console.log(`Generating respawn/rejoin presence update for player ${clientId}`);

    let spawnX = gameAreaWidth / 2;
    let spawnY = gameAreaHeight / 2;

    // Prioritize click coordinates if provided
    if (typeof clickX === 'number' && typeof clickY === 'number') {
        spawnX = clickX;
        spawnY = clickY;
        console.log(`Respawning player ${clientId} at provided coordinates: (${spawnX.toFixed(0)}, ${spawnY.toFixed(0)})`);
    }
    // Fallback to player's last known anchor point (cursor position) if available in presence
    else if (currentPresence && typeof currentPresence.x === 'number' && typeof currentPresence.y === 'number') {
        spawnX = currentPresence.x;
        spawnY = currentPresence.y;
        console.log(`Respawning player ${clientId} at cursor location from presence: (${spawnX.toFixed(0)}, ${spawnY.toFixed(0)})`);
    } else {
        console.warn(`Player ${clientId} respawning at center due to missing/invalid location data.`);
    }

    // Clamp spawn coordinates to ensure they are within the game area
    spawnX = Math.max(0, Math.min(gameAreaWidth, spawnX));
    spawnY = Math.max(0, Math.min(gameAreaHeight, spawnY));

    // Clean up spectator state upon respawn/rejoin
    removeSpectatorState(clientId);

    // Get player's base color for the effect
    const playerBaseColor = currentPresence?.color || config.defaultPlayerColor || '#FFFFFF';

    // Add respawn visual effect, passing the base color
    addEffect('respawnSparkle', {
        x: spawnX,
        y: spawnY,
        baseColor: playerBaseColor // Pass the determined base color
    });

    // Determine if paint should be reset
    const shouldResetPaint = currentPresence?.lost === true;

    console.log(`Player ${clientId} respawning. Was lost: ${currentPresence?.lost}. Resetting paint: ${shouldResetPaint}`);

    // Prepare the presence update object
    const respawnUpdates = {
        lost: false,
        respawnTime: null,
        currentCanId: null,
        x: spawnX,              // Set anchor position to the calculated spawn location
        y: spawnY,
        isSpectating: false,
        respawnAnimEndTime: now + RESPAWN_ANIM_DURATION,
    };

    if (shouldResetPaint) {
        respawnUpdates.paintedData = {}; // Clear paint
    } else {
        respawnUpdates.paintedData = currentPresence?.paintedData || {};
    }

    return respawnUpdates;
}