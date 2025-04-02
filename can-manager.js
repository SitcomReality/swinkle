/**
 * can-manager.js
 * Manages paint can spawning and updates
 */
import config from 'config';
import { getCurrentPalette } from './level-manager.js'; // Import palette getter

/**
 * Checks if a new paint can should spawn and generates it if needed.
 * Uses the current level's palette to assign one of its two neon colors.
 * @param {number} deltaTime - Time since last frame in seconds
 * @param {number} now - Current timestamp
 * @param {object} availableCans - Current available cans from roomState
 * @param {number} gameAreaWidth - Width of the game area from config
 * @param {number} gameAreaHeight - Height of the game area from config
 * @returns {object} New available paint can updates
 */
export function spawnPaintCans(deltaTime, now, availableCans, gameAreaWidth, gameAreaHeight) {
    const updates = {};

    // Only spawn if below the max number of available cans
    const currentCanCount = Object.values(availableCans || {}).filter(can => can !== null).length;
    if (currentCanCount >= config.maxAvailableCans) {
        return updates; // Don't spawn if max reached
    }

    // Chance-based spawning, adjusted by deltaTime for framerate independence
    const spawnChancePerSecond = 0.4; // Adjust this rate as needed
    const spawnProbability = spawnChancePerSecond * deltaTime;

    if (Math.random() < spawnProbability) {
        const canId = `can-${Math.random().toString(36).substring(2, 9)}-${now}`;

        // Get the current level's palette
        const currentPalette = getCurrentPalette();
        if (!currentPalette || !currentPalette.paint1 || !currentPalette.paint2) {
            console.warn("Cannot spawn can: Current palette or paint colors are missing.");
            return updates; // Don't spawn if palette is invalid
        }

        // Randomly choose one of the two paint colors from the current palette
        const paintColor = Math.random() < 0.5 ? currentPalette.paint1 : currentPalette.paint2;

        const margin = 100; // Keep cans away from edges
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
            vx: 0, // Initialize velocity
            vy: 0,
            isMega: false, // Ensure new cans aren't mega by default
            isCharging: false,
            accumulatedDroplets: 0
        };
        console.log(`Spawned can ${canId} with color ${paintColor}`);

    }

    return updates;
}