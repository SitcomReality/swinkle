/**
 * power-up-manager.js
 * Manages spawning, collecting, and applying power-up effects
 */
import { getRandomPowerUpDefinition, powerUpDefinitions } from './power-up-data.js';
import config from '../config.js';

/**
 * Checks if a new power-up should spawn and generates it if needed
 * @param {number} deltaTime - Time since last frame in seconds
 * @param {number} now - Current timestamp
 * @param {object} activePowerUps - Current active power-ups from roomState
 * @param {number} canvasWidth - Width of the game canvas
 * @param {number} canvasHeight - Height of the game canvas
 * @returns {object} New power-up updates
 */
export function spawnPowerUps(deltaTime, now, activePowerUps, canvasWidth, canvasHeight) {
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
            
            // Position randomly on the screen with margin
            const margin = 150;
            const x = margin + Math.random() * (canvasWidth - margin * 2);
            const y = margin + Math.random() * (canvasHeight - margin * 2);
            
            updates[powerUpId] = {
                id: powerUpId,
                typeId: powerUpDef.id,
                x: x,
                y: y,
                createdAt: now
            };
        }
    }
    
    return updates;
}

/**
 * Checks for collisions between a player and power-ups
 * @param {object} playerBodyPos - Player's body position {x, y}
 * @param {string} clientId - Client ID of the player
 * @param {object} activePowerUps - Active power-ups from roomState
 * @param {object} currentPresence - Current presence of the player
 * @returns {{ powerUpsToRemove: object, presenceUpdates: object }} Updates to apply to room state
 */
export function checkPowerUpCollisions(playerBodyPos, clientId, activePowerUps, currentPresence) {
    const powerUpsToRemove = {};
    let presenceUpdates = {};
    
    if (!playerBodyPos || !clientId || currentPresence?.lost) {
        return { powerUpsToRemove, presenceUpdates };
    }
    
    const collectDistance = config.powerUpCollectDistance || 30;
    const playerX = playerBodyPos.x;
    const playerY = playerBodyPos.y;
    
    Object.entries(activePowerUps || {}).forEach(([powerUpId, powerUp]) => {
        if (!powerUp) return;
        
        // Simple distance check
        const dx = powerUp.x - playerX;
        const dy = powerUp.y - playerY;
        const distanceSquared = dx * dx + dy * dy;
        
        if (distanceSquared <= collectDistance * collectDistance) {
            // Collision detected - collect the power-up
            console.log(`Player ${clientId} collected power-up ${powerUp.typeId}`);
            
            // Mark for removal
            powerUpsToRemove[powerUpId] = null;
            
            // Get the power-up definition
            const powerUpDef = powerUpDefinitions[powerUp.typeId];
            if (powerUpDef && typeof powerUpDef.effect === 'function') {
                // Apply effect to player
                const effectUpdates = powerUpDef.effect(clientId, currentPresence);
                presenceUpdates = { ...presenceUpdates, ...effectUpdates };
                
                // Add active power-up tracking for timed effects
                if (powerUpDef.duration > 0) {
                    const activePowerUps = { ...(currentPresence.activePowerUps || {}) };
                    activePowerUps[powerUpDef.id] = {
                        type: powerUpDef.id,
                        endTime: Date.now() + powerUpDef.duration
                    };
                    presenceUpdates.activePowerUps = activePowerUps;
                }
            }
        }
    });
    
    return { powerUpsToRemove, presenceUpdates };
}

/**
 * Processes active power-ups on a player and returns updates
 * @param {string} clientId - Client ID of the player
 * @param {object} presence - Current presence data for the player
 * @param {number} now - Current timestamp
 * @returns {object} Updates to apply to presence
 */
export function processActivePowerUps(clientId, presence, now) {
    if (!presence || !presence.activePowerUps) {
        return {};
    }
    
    const updates = {};
    const activePowerUps = { ...presence.activePowerUps };
    let changed = false;
    
    // Check for expired power-ups
    Object.entries(activePowerUps).forEach(([powerUpId, powerUpState]) => {
        if (powerUpState.endTime && now >= powerUpState.endTime) {
            // Power-up has expired
            console.log(`Power-up ${powerUpId} expired for player ${clientId}`);
            delete activePowerUps[powerUpId];
            changed = true;
            
            // Handle specific cleanup based on power-up type
            switch (powerUpId) {
                case 'shield':
                    updates.shielded = false;
                    break;
                case 'spring':
                    updates.springyBungee = false;
                    break;
                case 'megaCan':
                    updates.megaCanPowerup = false;
                    break;
                // Add other cases as needed
            }
        }
    });
    
    // Only update if something changed
    if (changed) {
        updates.activePowerUps = activePowerUps;
    }
    
    return updates;
}