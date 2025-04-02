/**
 * can-manager.js
 * Manages paint can spawning and updates
 */
import config from 'config';
import { getCurrentPalette } from './level-manager.js'; // Import palette getter

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
    const spawnChancePerSecond = 0.005; // Target ~0.5% chance per second
    const spawnProbability = spawnChancePerSecond * deltaTime * 60;

    if (Math.random() < spawnProbability) {
        if (Object.keys(availableCans).filter(id => availableCans[id] !== null).length < config.maxAvailableCans) {
            const canId = `can-${Math.random().toString(36).substring(2, 9)}-${now}`;

            // Get the current level's palette
            const currentPalette = getCurrentPalette();
            if (!currentPalette || !currentPalette.paint1 || !currentPalette.paint2) {
                console.warn("Cannot spawn can: Current palette or paint colors are missing.");
                return updates; // Don't spawn if palette is invalid
            }

            // Randomly choose one of the two paint colors from the current palette
            const paintColor = Math.random() < 0.5 ? currentPalette.paint1 : currentPalette.paint2;

            const margin = 100;
            // Use gameAreaWidth and gameAreaHeight for spawning boundaries
            const x = margin + Math.random() * (gameAreaWidth - margin * 2);
            const y = margin + Math.random() * (gameAreaHeight - margin * 2);

            updates[canId] = {
                id: canId,
                ownerId: null,
                paintColor: paintColor, // Use the selected palette color
                paintAmount: config.paintCanInitialAmount,
                x: x,
                y: y,
                isMega: false // Ensure new cans aren't mega by default
            };
            // console.log(`Spawned can ${canId} with color ${paintColor}`);
        }
    }

    return updates;
}