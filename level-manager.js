/**
 * level-manager.js
 * Handles loading and providing access to level data.
 */
import { allLevels } from './levels/level-data.js'; // Import all levels

// Store the currently loaded level data
let currentLevelData = null;

/**
 * Loads a specific level object.
 * @param {object} levelObject - The level data object to load.
 */
function loadLevel(levelObject) {
    if (!levelObject || !levelObject.id || !Array.isArray(levelObject.obstacles)) {
        console.error("Invalid level data provided:", levelObject);
        // Fallback to the first level in the array if invalid data is somehow passed
        console.warn("Falling back to the first defined level.");
        currentLevelData = allLevels[0];
    } else {
        console.log(`Loading level: ${levelObject.name} (${levelObject.id})`);
        currentLevelData = levelObject;
    }
    // Potential future extension: Notify other systems that the level has changed.
    // Update background color
    document.body.style.backgroundColor = currentLevelData.backgroundColor || '#0a0a1e';
}

/**
 * Initializes the level manager, loading a random level from the defined list.
 * Should be called once during game setup.
 */
export function initializeLevelManager() {
    // Choose a random level from the imported array
    const randomIndex = Math.floor(Math.random() * allLevels.length);
    const selectedLevel = allLevels[randomIndex];
    loadLevel(selectedLevel);
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