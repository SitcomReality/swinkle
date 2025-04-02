/**
 * level-manager.js
 * Handles loading and providing access to level data, synchronizing with room state.
 */
import { levelGenerate } from '../level-generator.js'; 
import { allLevels as initialLevels, defaultLevel } from './levels/level-data.js'; 
import { generateLevelName } from '../level-namer.js';
import { startLevelTransition, isTransitionActive } from './level-transition.js';
// Import palette data and helper functions
import { palettes, getRandomPalette } from './paletteData.js';

// --- State ---
let currentLevelData = null;
let currentPalette = null;
let nextPalette = null; // Store the palette selected for the *next* level during transition
let levelRoom = null;
let unsubscribeRoomState = () => {};
let allLoadedLevels = [...initialLevels]; // Use the initially generated levels

/**
 * Selects a random palette that is different from the current one, if possible.
 * Uses a simple approach: pick random until different or max attempts reached.
 * @param {object | null} current - The currently active palette object.
 * @returns {object} The selected palette object.
 */
function selectNextRandomPalette(current) {
    if (!palettes || palettes.length === 0) {
        console.warn("No palettes defined. Using default fallback.");
        return { paint1: '#FF00FF', paint2: '#00FFFF', backgroundBase: '#0a0a1e' };
    }
    if (palettes.length === 1) return palettes[0];

    let potentialNext;
    let attempts = 0;
    const maxAttempts = palettes.length * 2; // Allow some attempts to find a different one

    do {
        potentialNext = getRandomPalette(); // Get a random palette
        attempts++;
        // Check if it's different from the current palette based on background color (simple check)
    } while (
        current &&
        potentialNext.backgroundBase === current.backgroundBase && // Primary check: background color
        attempts < maxAttempts // Limit attempts
    );

    if (attempts >= maxAttempts && current && potentialNext.backgroundBase === current.backgroundBase) {
        console.warn("Could not find a palette with a different background after multiple attempts. Repeating palette may occur.");
    }

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

    // If nextPalette was set (meaning we just finished a transition), use it.
    if (nextPalette) {
        currentPalette = nextPalette;
        nextPalette = null; // Clear the next palette placeholder
        console.log(`Internal level set to ${levelObject.id}. Current palette updated after transition. Paint1: ${currentPalette?.paint1}, BG: ${currentPalette?.backgroundBase}`);
    }
    // If currentPalette isn't set yet (initial load), select one randomly.
    else if (!currentPalette) {
        currentPalette = selectNextRandomPalette(null); // Select initial random palette
        console.warn(`Internal level set to ${levelObject.id}, but nextPalette was null. Setting initial random palette. Paint1: ${currentPalette?.paint1}, BG: ${currentPalette?.backgroundBase}`);
    }
    // Otherwise (e.g., re-syncing state without transition), keep the existing palette.
    else {
        console.log(`Internal level set to ${levelObject.id}. Keeping existing palette. Paint1: ${currentPalette?.paint1}, BG: ${currentPalette?.backgroundBase}`);
    }

    // Ensure the body background matches the current palette
    if (currentPalette) {
        document.body.style.backgroundColor = currentPalette.backgroundBase || '#0a0a1e';
    }
}

/**
 * Called by level-transition.js when the transition is finished.
 * @param {object} completedLevelData - The data of the level that just finished transitioning in.
 */
export function setCurrentLevelDataFromTransition(completedLevelData) {
     if (completedLevelData) {
        setInternalLevelData(completedLevelData);
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

    // Select the very first palette randomly
    currentPalette = selectNextRandomPalette(null);
    console.log(`Initial palette selected randomly. Paint1: ${currentPalette?.paint1}, BG: ${currentPalette?.backgroundBase}`);

    // Determine the initial level based on room state or default
    const initialLevelId = room.roomState?.currentLevelId;
    let initialLevelObject = allLoadedLevels.find(level => level.id === initialLevelId);

    // Handle case where initialLevelId from room state doesn't match any local level
    if (!initialLevelObject) {
         console.warn(`Initial level ID "${initialLevelId}" not found in generated levels. Using first generated level.`);
         initialLevelObject = allLoadedLevels.length > 0 ? allLoadedLevels[0] : null;
         // If still no level, generate a fallback (shouldn't happen if generation works)
         if (!initialLevelObject) {
             console.error("No levels available to load! Generating a fallback.");
             initialLevelObject = levelGenerate(); // Use generator directly
             initialLevelObject.name = generateLevelName();
             allLoadedLevels.push(initialLevelObject);
         }
         // If this client is the host, update the room state with the resolved level ID
         if (room.clientId === room.roomState.hostClientId && initialLevelObject) {
            room.updateRoomState({ currentLevelId: initialLevelObject.id });
         }
    }

    // Set the internal state based on the determined initial level
    setInternalLevelData(initialLevelObject);

    // Subscribe to room state changes to handle level updates from the host
    unsubscribeRoomState = room.subscribeRoomState((currentRoomState) => {
        if (isTransitionActive()) return; // Don't process changes during transition

        const newLevelId = currentRoomState?.currentLevelId;
        const currentlyLoadedId = currentLevelData?.id;

        // Check if the level ID in room state has changed and is different from the currently loaded one
        if (newLevelId && newLevelId !== currentlyLoadedId) {
            console.log(`Room state changed: New level ID detected - ${newLevelId}`);
            let newLevelObject = allLoadedLevels.find(level => level.id === newLevelId);

            // Ensure the new level object is found locally
            if (!newLevelObject) {
                console.error(`Level with ID "${newLevelId}" not found in local list! Cannot transition.`);
                // Maybe try to sync or request level data? For now, just return.
                return;
            }

            // Select the palette for the *upcoming* level, trying to make it different
            nextPalette = selectNextRandomPalette(currentPalette);
            const oldPalette = currentPalette; // Store the current palette as the 'old' one for the transition
            console.log(`Transitioning to level ${newLevelId}. Old palette BG: ${oldPalette?.backgroundBase}, New palette BG: ${nextPalette?.backgroundBase}`);

            // Start the visual transition effect
            startLevelTransition(currentLevelData, newLevelObject, oldPalette, nextPalette);

        } else if (!newLevelId && currentlyLoadedId) {
            // Handle case where level ID disappears from room state (shouldn't normally happen)
            console.warn("Current level ID missing from room state. Keeping current level loaded.");
            nextPalette = null; // Ensure no next palette is stored
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
 * Used for simple host election.
 * @param {object} peers - The room.peers object.
 * @returns {string|null} The client ID of the peer with the lowest ID, or null if no peers.
 */
export function getLowestClientId(peers) {
    if (!peers || typeof peers !== 'object') return null;
    const peerIds = Object.keys(peers);
    if (peerIds.length === 0) return null;
    peerIds.sort(); // Lexicographical sort finds the "lowest" ID
    return peerIds[0];
}

// Function to add a new generated level to the list (e.g., for debugging or future expansion)
export function addRandomGeneratedLevel() {
    const level = levelGenerate(); // Use generator
    level.name = generateLevelName(); // Assign a name
    allLoadedLevels.push(level);
    console.log(`Added new generated level: ${level.name} (${level.id})`);
    return level;
}

// Export the list of all levels
export { allLoadedLevels as allLevels };