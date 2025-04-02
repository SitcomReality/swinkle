/**
 * level-manager.js
 * Handles loading and providing access to level data, synchronizing with room state.
 */
import { levelGenerate } from '../level-generator.js';
import { allLevels as initialLevels, defaultLevel } from './levels/level-data.js';
import { generateLevelName } from '../level-namer.js';
import { startLevelTransition, isTransitionActive } from './level-transition.js';
// Import specific palette functions
import { palettes, getRandomPalette, getPaletteByIndex } from './paletteData.js'; // Updated import

// --- State ---
let currentLevelData = null;
let currentPalette = null;
let nextPalette = null;
let levelRoom = null;
let unsubscribeRoomState = () => {};
let allLoadedLevels = [...initialLevels];

/**
 * Selects a random palette that is different from the current one, if possible.
 * @param {object | null} current - The currently active palette object.
 * @returns {object} The selected palette object.
 */
function selectNextRandomPalette(current) {
    if (!palettes || palettes.length === 0) {
        // Use the fallback mechanism from paletteData.js
        return getPaletteByIndex(0);
    }
    if (palettes.length === 1) return palettes[0];

    let potentialNext;
    let attempts = 0;
    const maxAttempts = palettes.length * 2; // Allow more attempts to find a different one

    do {
        potentialNext = getRandomPalette(); // Use the imported function
        attempts++;
    } while (
        current && // Only check for difference if a current palette exists
        potentialNext && // Ensure potentialNext is valid
        potentialNext.name === current.name && // Compare by name for simplicity, assuming names are unique
        attempts < maxAttempts // Limit attempts
    );

    if (attempts >= maxAttempts) {
        console.warn("Could not find a different random palette after multiple attempts. Repeating palette is possible.");
    }

    // Log the selected palette name for debugging
    // console.log(`Selected next palette: ${potentialNext?.name}`);
    return potentialNext;
}

/**
 * Sets the current level data internally.
 * Also updates the currentPalette based on the transition state.
 * @param {object} levelObject - The level data object to load.
 */
function setInternalLevelData(levelObject) {
    if (!levelObject) {
        console.error("setInternalLevelData called with invalid levelObject.");
        return;
    }
    currentLevelData = levelObject;

    if (nextPalette) {
        // If transitioning, use the 'next' palette determined before the transition
        currentPalette = nextPalette;
        nextPalette = null; // Clear the next palette placeholder
        console.log(`Internal level set to ${levelObject.id} (${levelObject.name}). Palette updated after transition to: ${currentPalette?.name}`);
    } else if (!currentPalette) {
        // If no current palette exists (initial load), select a random one
        currentPalette = selectNextRandomPalette(null);
        console.warn(`Internal level set to ${levelObject.id} (${levelObject.name}). No 'nextPalette' found, setting initial random palette: ${currentPalette?.name}`);
    } else {
        // If not transitioning and a palette already exists, keep the existing one
        // This scenario shouldn't happen often with the transition logic, but good fallback
        console.log(`Internal level set to ${levelObject.id} (${levelObject.name}). Keeping existing palette: ${currentPalette?.name}`);
    }

    // Apply the background color from the final current palette
    if (currentPalette && currentPalette.backgroundBase) {
        document.body.style.backgroundColor = currentPalette.backgroundBase;
    } else {
        console.warn(`Current palette or its backgroundBase is missing for level ${levelObject.id}. Using default background.`);
        document.body.style.backgroundColor = '#0a0a1e'; // Default fallback
    }
}

/**
 * Called by level-transition.js when the transition is finished.
 * @param {object} completedLevelData - The data of the level that just finished transitioning in.
 */
export function setCurrentLevelDataFromTransition(completedLevelData) {
     if (completedLevelData) {
        setInternalLevelData(completedLevelData); // Sets level and handles palette update
     } else {
        console.error("setCurrentLevelDataFromTransition called but no level data provided.");
     }
}

/**
 * Initializes the level manager.
 * @param {object} room - The WebsimSocket room instance.
 */
export function initializeLevelManager(room) {
    if (!room) {
        console.error("Level Manager initialization requires a valid room instance.");
        return;
    }
    levelRoom = room;
    console.log("Initializing level manager...");

    // Select initial palette randomly before setting level data
    currentPalette = selectNextRandomPalette(null);
    console.log(`Initial palette selected randomly: ${currentPalette?.name}`);

    const initialLevelId = room.roomState?.currentLevelId;
    let initialLevelObject = allLoadedLevels.find(level => level.id === initialLevelId);

    if (!initialLevelObject) {
         console.warn(`Initial level ID "${initialLevelId}" not found in generated levels. Using first generated level.`);
         initialLevelObject = allLoadedLevels.length > 0 ? allLoadedLevels[0] : null;
         if (!initialLevelObject) {
             console.error("No levels available to load! Generating a fallback.");
             initialLevelObject = levelGenerate();
             initialLevelObject.name = generateLevelName();
             allLoadedLevels.push(initialLevelObject);
         }
         // Host responsibility to set the initial level ID in room state if missing
         if (room.clientId === room.roomState?.hostClientId && initialLevelObject) {
            console.log(`Host setting initial level ID in room state: ${initialLevelObject.id}`);
            room.updateRoomState({ currentLevelId: initialLevelObject.id });
         }
    }

    // Set initial level data and apply initial palette's background
    setInternalLevelData(initialLevelObject);

    unsubscribeRoomState = room.subscribeRoomState((currentRoomState) => {
        // Prevent starting a new transition if one is already active
        if (isTransitionActive()) return;

        const newLevelId = currentRoomState?.currentLevelId;
        const currentlyLoadedId = currentLevelData?.id;

        // Detect if the level ID in room state has changed
        if (newLevelId && newLevelId !== currentlyLoadedId) {
            console.log(`Room state changed: New level ID detected - ${newLevelId}`);
            let newLevelObject = allLoadedLevels.find(level => level.id === newLevelId);

            if (!newLevelObject) {
                console.error(`Level with ID "${newLevelId}" not found in local list! Cannot transition.`);
                // Potentially try to generate/fetch the level, or fallback
                return;
            }

            // Determine the palette for the upcoming level
            // Select a new random palette, attempting to make it different from the current one
            nextPalette = selectNextRandomPalette(currentPalette); // This becomes the 'newPalette' for the transition
            const oldPalette = currentPalette; // Store the current one as 'oldPalette'

            console.log(`Starting transition to level ${newLevelId} (${newLevelObject.name}). Old Palette: ${oldPalette?.name}, New Palette: ${nextPalette?.name}`);
            // Start the visual transition, passing both old and new level/palette data
            startLevelTransition(currentLevelData, newLevelObject, oldPalette, nextPalette);
            // Note: setInternalLevelData will be called by the transition module upon completion

        } else if (!newLevelId && currentlyLoadedId) {
            console.warn("Current level ID missing from room state. Keeping current level loaded.");
            // Reset nextPalette just in case a transition was prematurely planned
            nextPalette = null;
        }
    });
}

/**
 * Gets the currently loaded level data (stable state, not mid-transition).
 * @returns {object | null} The current level data object, or null if none is loaded.
 */
export function getCurrentLevel() {
    return currentLevelData;
}

/**
 * Gets the currently active palette.
 * @returns {object | null} The current palette object, or null if none is loaded.
 */
export function getCurrentPalette() {
    return currentPalette;
}

/**
 * Gets the palette selected for the *next* level during a transition.
 * @returns {object | null} The next palette object or null.
 */
export function getNextPalette() {
    return nextPalette;
}

/**
 * Finds the client ID with the "lowest" value (lexicographically).
 * @param {object} peers - The room.peers object.
 * @returns {string|null} The client ID of the peer with the lowest ID, or null if no peers.
 */
export function getLowestClientId(peers) {
    if (!peers || typeof peers !== 'object') return null;
    const peerIds = Object.keys(peers);
    if (peerIds.length === 0) return null;
    // Sort lexicographically (default string sort)
    peerIds.sort();
    return peerIds[0];
}

/**
 * Generates a new random level and adds it to the list of available levels.
 * @returns {object} The newly generated level object.
 */
export function addRandomGeneratedLevel() {
    const level = levelGenerate(); // Assumes levelGenerate uses its internal config
    level.name = generateLevelName(); // Assign a random name
    allLoadedLevels.push(level);
    console.log(`Added new generated level: ${level.name} (${level.id})`);
    return level;
}

// Export the list of all levels (useful for debugging or potentially listing levels)
export { allLoadedLevels as allLevels };