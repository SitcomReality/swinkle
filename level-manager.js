/**
 * level-manager.js
 * Handles loading and providing access to level data, synchronizing with room state.
 */
import { levelGenerate } from './level-generator.js';
import { allLevels } from './levels/level-data.js'; // Import all levels
import { startLevelTransition, isTransitionActive } from './level-transition.js'; // Import transition functions
// Import palettes and random palette getter
import { palettes, getRandomPalette } from './paletteData.js'; // Import palettes and getRandomPalette

// Store the currently loaded level data and palette
let currentLevelData = null;
let currentPalette = null; // Track the currently active palette
let nextPalette = null; // Store palette for the level being transitioned TO
let levelRoom = null; // Store the room instance
let unsubscribeRoomState = () => {};
let genConfig = {}; // Assuming this is defined somewhere, it's not in the provided plan
let generata = {}; // Assuming this is defined somewhere, it's not in the provided plan

/**
 * Selects a random palette that is different from the current one, if possible.
 * @param {object | null} current - The currently active palette object.
 * @returns {object} The selected palette object.
 */
function selectNextRandomPalette(current) {
    if (!palettes || palettes.length === 0) {
        console.warn("No palettes defined. Using default fallback.");
        // Define a default fallback palette inline if palettes array is empty
        return { paint1: '#FF00FF', paint2: '#00FFFF', backgroundBase: '#0a0a1e' };
    }
    if (palettes.length === 1) {
        return palettes[0]; // Only one choice
    }

    let potentialNext;
    let attempts = 0;
    const maxAttempts = palettes.length * 2; // Avoid infinite loop in unlikely scenarios

    do {
        potentialNext = getRandomPalette();
        attempts++;
    } while (
        current && // Only check for difference if a current palette exists
        potentialNext.paint1 === current.paint1 && // Simple check based on first paint color for difference
        potentialNext.paint2 === current.paint2 &&
        potentialNext.backgroundBase === current.backgroundBase &&
        attempts < maxAttempts // Safety break
    );

    if (attempts >= maxAttempts) {
        console.warn("Could not find a different random palette after multiple attempts. Repeating palette.");
    }

    return potentialNext;
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
    // If nextPalette was set (meaning a transition just ended), use that.
    if (nextPalette) {
        currentPalette = nextPalette;
        nextPalette = null; // Clear nextPalette after using it
        console.log(`Internal level set to ${levelObject.id}. Current palette updated after transition. Paint1: ${currentPalette?.paint1}`);
    } else {
         // This case should only happen on initial load before any transitions
         // If currentPalette is already set (initial random selection), keep it.
         // If not, select a random one.
         if (!currentPalette) {
              currentPalette = selectNextRandomPalette(null); // Select initial random palette
              console.warn(`Internal level set to ${levelObject.id}, but nextPalette was null. Setting initial random palette. Paint1: ${currentPalette?.paint1}`);
         } else {
              console.log(`Internal level set to ${levelObject.id}. Keeping existing palette. Paint1: ${currentPalette?.paint1}`);
         }
    }
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

    // --- Initial Setup ---
    // Select initial random palette FIRST
    currentPalette = selectNextRandomPalette(null); // Select the very first palette randomly
    console.log(`Initial palette selected randomly. Paint1: ${currentPalette?.paint1}`);

    const initialLevels = getInitialLevels();
    const initialLevelId = room.roomState?.currentLevelId;
    const initialLevelObject = initialLevels.find(level => level.id === initialLevelId) || initialLevels[0];

    if (!initialLevelId) {
        console.warn("No initial level ID found in room state, loading default level.");
    }
    // Set initial level data (this will keep the already selected currentPalette)
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
                // Select the *next* palette randomly, ensuring it's different from the current one
                nextPalette = selectNextRandomPalette(currentPalette); // Pass current palette
                const oldPalette = currentPalette; // The palette we are transitioning FROM
                console.log(`Transitioning to level ${newLevelId}. Old palette P1: ${oldPalette?.paint1}, New palette P1: ${nextPalette?.paint1}`);

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
 * Now uses generated levels instead of  
 */
export function getInitialLevels() {
    // Gen 10 random levels on first run   
    if (!allLevels || allLevels.length === 0) {
        allLevels = generateRandomLs(10);   
    }
    
    return allLevels;
}

/**
 * Generates random levels
 * @param {number} count - The number of levels to generate
 * @returns {object[]} The generated levels
 */
function generateRandomLs(count) {
    const levels = [];
    for (let i = 0; i < count; i++) {
        const level = levelGenerate(genConfig);
        level.name = generata.generateLevelName();  
        levels.push(level);
    }
    return levels;
}

/**
 * Adds a new random level to the list of levels
 */
export function addRandomLevel() {
    const level = levelGenerate(genConfig);
    level.name = generata.generateLevelName();  
    allLevels.push(level);
    return level;
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