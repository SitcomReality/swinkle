/**
 * level-manager.js
 * Handles loading and providing access to level data, synchronizing with room state.
 */
import { allLevels } from './levels/level-data.js'; // Import all levels
import { startLevelTransition, isTransitionActive } from './level-transition.js'; // Import transition functions
import { palettes, getPaletteByIndex } from '../paletteData.js'; // Import palettes

// Store the currently loaded level data and palette
let currentLevelData = null;
let currentPalette = null;
let nextPalette = null; // Store palette for the level being transitioned TO
let levelRoom = null; // Store the room instance
let unsubscribeRoomState = () => {};

/**
 * Determines the palette to use for a given level ID.
 * Uses the level's index in the allLevels array.
 * @param {string} levelId - The ID of the level.
 * @returns {object} The selected palette object.
 */
function getPaletteForLevel(levelId) {
    const levelIndex = allLevels.findIndex(level => level.id === levelId);
    if (levelIndex === -1 || palettes.length === 0) {
        console.warn(`Could not find level index for ${levelId} or no palettes defined. Using default palette.`);
        return getPaletteByIndex(0); // Fallback to the first palette
    }
    // Use modulo to wrap around the available palettes
    const paletteIndex = levelIndex % palettes.length;
    return getPaletteByIndex(paletteIndex);
}

/**
 * Sets the current level data. Called internally or by level-transition.js.
 * Background color updates are now handled by the transition process.
 * Also sets the currentPalette based on the provided level object.
 * @param {object} levelObject - The level data object to load.
 */
function setInternalLevelData(levelObject) {
    if (!levelObject) {
        console.error("setInternalLevelData called with invalid levelObject.");
        return;
    }
    currentLevelData = levelObject;
    // Update currentPalette synchronously when the level data is set internally
    // If nextPalette was set (meaning a transition just ended), use that. Otherwise, calculate it.
    if (nextPalette) {
        currentPalette = nextPalette;
        nextPalette = null; // Clear nextPalette after using it
    } else {
        currentPalette = getPaletteForLevel(levelObject.id);
    }
    console.log(`Internal level set to ${levelObject.id}, current palette paint1: ${currentPalette?.paint1}`);
}

/**
 * Public function called by level-transition.js when the transition is finished
 * to update the manager's internal state.
 * @param {object} completedLevelData - The data of the level that just finished transitioning in.
 */
export function setCurrentLevelDataFromTransition(completedLevelData) {
     if (completedLevelData) {
        setInternalLevelData(completedLevelData); // This now also sets currentPalette using nextPalette
     } else {
        console.error("setCurrentLevelDataFromTransition called but no level data provided.");
     }
}

/**
 * Initializes the level manager.
 * Subscribes to room state to load the correct level based on `currentLevelId`.
 * @param {object} room - The WebsimSocket room instance.
 */
export function initializeLevelManager(room) {
    if (!room) {
        console.error("Level Manager initialization requires a valid room instance.");
        return;
    }
    levelRoom = room;

    console.log("Initializing level manager...");

    // Initial level load based on current room state (no transition on first load)
    const initialLevelId = room.roomState?.currentLevelId;
    const initialLevelObject = allLevels.find(level => level.id === initialLevelId) || allLevels[0];

    if (!initialLevelId) {
        console.warn("No initial level ID found in room state, loading default level.");
    }
    // Set initial level data and palette immediately
    setInternalLevelData(initialLevelObject);

    // Set initial background color based on the initial palette
    if (currentPalette) {
         document.body.style.backgroundColor = currentPalette.backgroundBase || '#0a0a1e';
    }

    // Subscribe to room state changes
    unsubscribeRoomState = room.subscribeRoomState((currentRoomState) => {
        // Don't process updates if a transition is already in progress
        if (isTransitionActive()) return;

        const newLevelId = currentRoomState?.currentLevelId;
        const currentlyLoadedId = currentLevelData?.id;

        // Check if a valid new ID exists and if it's different from the currently loaded one
        if (newLevelId && newLevelId !== currentlyLoadedId) {
            console.log(`Room state changed: New level ID detected - ${newLevelId}`);
            const newLevelObject = allLevels.find(level => level.id === newLevelId);
            if (newLevelObject) {
                // Determine the palettes for old and new levels
                const oldPalette = currentPalette; // Get the currently active palette
                nextPalette = getPaletteForLevel(newLevelId); // Determine and store the palette for the incoming level
                console.log(`Transitioning to level ${newLevelId}, next palette paint1: ${nextPalette?.paint1}`);

                // Start transition, passing level data AND palette data
                startLevelTransition(currentLevelData, newLevelObject, oldPalette, nextPalette);
            } else {
                 console.error(`Level with ID "${newLevelId}" found in room state but not in level-data.js!`);
                 // Potentially fall back or keep current level?
                 nextPalette = null; // Clear nextPalette if transition fails
            }
        } else if (!newLevelId && currentlyLoadedId) {
            // Handle case where level ID becomes undefined (error state?)
            console.warn("Current level ID missing from room state. Keeping current level loaded.");
            nextPalette = null; // Clear nextPalette if state is invalid
        }
    });
}

/**
 * Gets the currently loaded level data (stable state, not mid-transition).
 * Other modules (like collision) should call this to get level geometry.
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
 * Returns null if no transition is active or imminent.
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

    // Sort IDs lexicographically and return the first one
    peerIds.sort();
    return peerIds[0];
}

// Re-export allLevels so game-loop can use it for cycling
export { allLevels };