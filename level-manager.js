/**
 * level-manager.js
 * Handles loading and providing access to level data.
 */
import { defaultLevel } from './levels/level-data.js';

// Store the currently loaded level data
let currentLevelData = null;

/**
 * Loads a specific level object.
 * @param {object} levelObject - The level data object to load.
 */
function loadLevel(levelObject) {
    if (!levelObject || !levelObject.id || !Array.isArray(levelObject.obstacles)) {
        console.error("Invalid level data provided:", levelObject);
        // Optionally load default as fallback or throw error
        console.warn("Falling back to default level.");
        currentLevelData = defaultLevel;
    } else {
        console.log(`Loading level: ${levelObject.name} (${levelObject.id})`);
        currentLevelData = levelObject;
    }
    // Potential future extension: Notify other systems that the level has changed.
}

/**
 * Initializes the level manager, loading the default level.
 * Should be called once during game setup.
 */
export function initializeLevelManager() {
    // For now, we just load the default level.
    // Later, this could take arguments to load specific levels.
    loadLevel(defaultLevel);
}

/**
 * Gets the currently loaded level data.
 * Other modules (like rendering or collision) can call this to get level geometry.
 * @returns {object | null} The current level data object, or null if none is loaded.
 */
export function getCurrentLevel() {
    if (!currentLevelData) {
        console.warn("Attempted to get current level, but none is loaded.");
    }
    return currentLevelData;
}