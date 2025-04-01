/**
 * power-up-manager.js
 * Manages spawning, collecting, and applying power-up effects
 */
import { getRandomPowerUpDefinition, powerUpDefinitions } from './power-up-data.js';
import config from '../config.js';
import { addEffect } from '../effectsRenderer.js'; // Import for visual feedback
import { room } from '../main.js'; // Import room to access peers
import { broadcastNotification } from '../notification-broadcaster.js'; // Add import

/**
 * Checks if a new power-up should spawn and generates it if needed
 * @param {number} deltaTime - Time since last frame in seconds
 * @param {number} now - Current timestamp
 * @param {object} activePowerUps - Current active power-ups from roomState
 * @param {number} gameAreaWidth - Width of the game area from config
 * @param {number} gameAreaHeight - Height of the game area from config
 * @returns {object} New power-up updates
 */
export function spawnPowerUps(deltaTime, now, activePowerUps, gameAreaWidth, gameAreaHeight) {
    const updates = {};

    // Check how many active power-ups are present
    const currentPowerUpCount = Object.values(activePowerUps || {})
        .filter(p => p !== null).length;

    // Only spawn if we're below the maximum
    if (currentPowerUpCount < (config.maxActivePowerUps || 3)) {
        // Chance-based spawning, adjusted by deltaTime for framerate independence
        // Tuned to be rarer than paint cans (0.003 vs 0.005)
        if (Math.random() < (0.003 * deltaTime * 60)) {
            const powerUpDef = getRandomPowerUpDefinition();
            const powerUpId = `powerup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

            // Position randomly within the game area with margin
            const margin = 150;
            // Use gameAreaWidth and gameAreaHeight for spawning boundaries
            const x = margin + Math.random() * (gameAreaWidth - margin * 2);
            const y = margin + Math.random() * (gameAreaHeight - margin * 2);

            updates[powerUpId] = {
                id: powerUpId,
                typeId: powerUpDef.id,
                x: x,
                y: y,
                createdAt: now
            };
            console.log(`Spawning power-up ${powerUpDef.id} at (${x.toFixed(0)}, ${y.toFixed(0)})`);
        }
    }

    return updates;
}

/**
 * Checks for collisions between a player and power-ups.
 * This function is typically called by the local client for itself.
 * Skips checks if player is spectating.
 * @param {object} playerBodyPos - Player's body position {x, y}
 * @param {string} clientId - Client ID of the player collecting the power-up
 * @param {object} activePowerUps - Active power-ups from roomState.powerUps
 * @param {object} currentPresence - Current presence of the player (used to apply effects, check spectating).
 * @returns {{ powerUpsToRemove: object, presenceUpdates: object }} Updates to apply
 */
export function checkPowerUpCollisions(playerBodyPos, clientId, activePowerUps, currentPresence) {
    const powerUpsToRemove = {};
    let presenceUpdates = {};

    // Don't allow collection if player doesn't exist, has no position, is lost, or is spectating
    if (!playerBodyPos || !clientId || !currentPresence || currentPresence.lost || currentPresence.isSpectating) {
        return { powerUpsToRemove, presenceUpdates };
    }

    const collectDistance = config.powerUpCollectDistance || 30;
    const playerX = playerBodyPos.x;
    const playerY = playerBodyPos.y;

    Object.entries(activePowerUps || {}).forEach(([powerUpId, powerUp]) => {
        if (!powerUp || powerUpsToRemove[powerUpId] === null) return; // Skip if null or already marked for removal this frame

        // Simple distance check
        const dx = powerUp.x - playerX;
        const dy = powerUp.y - playerY;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared <= collectDistance * collectDistance) {
            // Collision detected - collect the power-up
            console.log(`Player ${clientId} collided with power-up ${powerUp.typeId} (ID: ${powerUpId})`);

            // Mark for removal (roomState update)
            powerUpsToRemove[powerUpId] = null;

            // Get the power-up definition
            const powerUpDef = powerUpDefinitions[powerUp.typeId];
            if (powerUpDef && typeof powerUpDef.effect === 'function') {
                // Apply effect to player's presence data
                const effectUpdates = powerUpDef.effect(clientId, currentPresence);
                presenceUpdates = { ...presenceUpdates, ...effectUpdates };

                // Add active power-up tracking for timed effects
                if (powerUpDef.duration > 0) {
                    // Ensure activePowerUps object exists in presence updates
                    if (!presenceUpdates.activePowerUps) {
                        // Start from current presence's active powerups or an empty object
                        presenceUpdates.activePowerUps = { ...(currentPresence.activePowerUps || {}) };
                    }
                    // Add/update the entry for this power-up type
                    presenceUpdates.activePowerUps[powerUpDef.id] = {
                        type: powerUpDef.id,
                        endTime: Date.now() + powerUpDef.duration
                    };
                    console.log(`Applied timed effect ${powerUpDef.id} to ${clientId}, duration ${powerUpDef.duration}ms`);
                } else {
                    console.log(`Applied instant effect ${powerUpDef.id} to ${clientId}`);
                }

                // Add a visual effect at the power-up location upon collection
                addEffect('stealSpark', { x: powerUp.x, y: powerUp.y }); // Reuse steal spark for now

                // Add notification about power-up collection
                import('../notification-manager.js').then(({ addNotification }) => {
                    // Get player username if possible
                    const username = room?.peers?.[clientId]?.username || 'Player';
                    // Broadcast to all players instead
                    broadcastNotification(`${username} collected ${powerUpDef.name}!`, 'pickup', 3000);
                }).catch(err => console.error('Error importing notification manager:', err));

            } else {
                console.warn(`No definition or effect function found for power-up type: ${powerUp.typeId}`);
            }
            // Prevent collecting multiple powerups in the same frame if needed,
            // though current logic applies all collided ones.
        }
    });

    return { powerUpsToRemove, presenceUpdates };
}

/**
 * Processes active power-ups on a player, checks for expiration, and returns updates.
 * @param {string} clientId - Client ID of the player
 * @param {object} presence - Current presence data for the player
 * @param {number} now - Current timestamp
 * @returns {object} Updates to apply to presence
 */
export function processActivePowerUps(clientId, presence, now) {
    // Ensure presence and the activePowerUps object exist
    if (!presence || !presence.activePowerUps) {
        return {};
    }

    const updates = {}; // Store presence updates to return
    const activePowerUps = { ...presence.activePowerUps }; // Work on a copy
    let changed = false; // Track if any updates are needed

    // Check for expired power-ups
    Object.entries(activePowerUps).forEach(([powerUpId, powerUpState]) => {
        // Ensure the power-up state is valid and has an endTime
        if (powerUpState && typeof powerUpState.endTime === 'number') {
            if (now >= powerUpState.endTime) {
                // Power-up has expired
                console.log(`Power-up ${powerUpId} expired for player ${clientId}`);
                delete activePowerUps[powerUpId]; // Remove from the copied active list
                changed = true; // Mark that state has changed

                // Handle specific cleanup based on power-up type ID (which is the key)
                switch (powerUpId) {
                    case 'shield':
                        updates.shielded = false;
                        break;
                    case 'spring':
                        updates.springyBungee = false;
                        break;
                    case 'megaCan':
                        // Note: megaCanPowerup might be consumed on pickup rather than timeout,
                        // but having a timeout is a good backup. We'll refine this in 1.9.5.
                        updates.megaCanPowerup = false;
                        break;
                    // Add cases for other timed power-ups here
                }
            }
        } else {
             // Clean up invalid entries (optional, but good practice)
             console.warn(`Invalid power-up state found for ${powerUpId} on player ${clientId}. Removing.`);
             delete activePowerUps[powerUpId];
             changed = true;
        }
    });

    // If any power-ups expired or were cleaned up, update the activePowerUps map in presence
    if (changed) {
        // If all powerups expired, send an empty object or null. Sending the modified copy ensures removals are synced.
        updates.activePowerUps = activePowerUps;
    }

    return updates;
}