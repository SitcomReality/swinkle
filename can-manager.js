/**
 * can-manager.js
 * Manages paint can spawning and updates
 */
import config from 'config';

/**
 * Checks if a new paint can should spawn and generates it if needed
 * @param {number} deltaTime - Time since last frame in seconds
 * @param {number} now - Current timestamp
 * @param {object} availableCans - Current available cans from roomState
 * @param {number} gameAreaWidth - Width of the game area from config
 * @param {number} gameAreaHeight - Height of the game area from config
 * @returns {object} New available paint can updates
 */
export function spawnPaintCans(deltaTime, now, availableCans, gameAreaWidth, gameAreaHeight) {
    const updates = {};

    // Chance-based spawning, adjusted by deltaTime for framerate independence
    if (Math.random() < (0.005 * deltaTime * 60)) { // ~0.5% chance per second
        if (Object.keys(availableCans).filter(id => availableCans[id] !== null).length < config.maxAvailableCans) {
            const canId = `can-${Math.random().toString(36).substring(2, 9)}-${now}`;
            const colorIndex = Math.floor(Math.random() * config.paintCanColors.length);
            const margin = 100;
            // Use gameAreaWidth and gameAreaHeight for spawning boundaries
            const x = margin + Math.random() * (gameAreaWidth - margin * 2);
            const y = margin + Math.random() * (gameAreaHeight - margin * 2);

            updates[canId] = {
                id: canId,
                ownerId: null,
                paintColor: config.paintCanColors[colorIndex],
                paintAmount: config.paintCanInitialAmount,
                x: x,
                y: y
            };
        }
    }

    return updates;
}