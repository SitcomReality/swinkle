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

    // Ensure availableCans is an object, even if null/undefined initially
    const validAvailableCans = availableCans || {};
    // Calculate current count safely
    const currentCanCount = Object.values(validAvailableCans).filter(can => can !== null).length;

    // Use config values or defaults
    const spawnChancePerSecond = config.paintCanSpawnChancePerSecond || 0.3; // 30% chance per second
    const maxCans = config.maxAvailableCans || 3;

    // Only attempt to spawn if below the maximum limit
    if (currentCanCount < maxCans) {
        // Framerate independent chance calculation
        const spawnChanceThisFrame = spawnChancePerSecond * deltaTime;

        if (Math.random() < spawnChanceThisFrame) {
            const canId = `can-${Math.random().toString(36).substring(2, 9)}-${now}`;

            // Get the current level's palette
            const currentPalette = getCurrentPalette();
            if (!currentPalette || !currentPalette.paint1 || !currentPalette.paint2) {
                console.warn("Cannot spawn can: Current palette or paint colors are missing.");
                return updates; // Don't spawn if palette is invalid
            }

            // Randomly choose one of the two paint colors from the current palette
            const paintColor = Math.random() < 0.5 ? currentPalette.paint1 : currentPalette.paint2;

            const margin = 100; // Keep margin
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
            console.log(`Spawned can ${canId} with color ${paintColor} from palette ${currentPalette.name}. Total cans: ${currentCanCount + 1}`);
        }
    }

    return updates;
}