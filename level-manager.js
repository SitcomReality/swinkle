/**
 * level-manager.js
 * Handles loading and providing access to level data, synchronizing with room state.
 */
import { levelGenerate } from '../level-generator.js'; 
import { allLevels as initialLevels, defaultLevel } from './levels/level-data.js'; 
import { generateLevelName } from '../level-namer.js';
import { startLevelTransition, isTransitionActive } from './level-transition.js';
import { palettes, getRandomPalette } from './paletteData.js';

// --- State ---
let currentLevelData = null;
let currentPalette = null;
let nextPalette = null; // Palette selected for the *next* level during transition
let levelRoom = null;
let unsubscribeRoomState = () => {};
let allLoadedLevels = [...initialLevels]; // Use initial generated levels

/**
 * Selects a random palette that is different from the current one, if possible.
 * Ensures better variety by comparing the full palette objects.
 * @param {object | null} current - The currently active palette object.
 * @returns {object} The selected palette object.
 */
function selectNextRandomPalette(current) {
    if (!palettes || palettes.length === 0) {
        console.warn("No palettes defined. Using default fallback.");
        return { id: 'fallback', paint1: '#FF00FF', paint2: '#00FFFF', backgroundBase: '#0a0a1e' };
    }
    if (palettes.length === 1) return palettes[0]; // Only one choice

    let potentialNext;
    let attempts = 0;
    const maxAttempts = palettes.length * 2; // Try a reasonable number of times

    do {
        potentialNext = getRandomPalette();
        attempts++;
    } while (
        current && // Only compare if there *is* a current palette
        potentialNext.id === current.id && // Compare by ID for simplicity and clarity
        attempts < maxAttempts // Stop if we can't find a different one quickly
    );

    if (attempts >= maxAttempts && current && potentialNext.id === current.id) {
        console.warn(`Could not find a different random palette from '${current.id}' after ${maxAttempts} attempts. Repeating palette.`);
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
    const oldLevelId = currentLevelData?.id;
    currentLevelData = levelObject;

    // If nextPalette is set (meaning a transition just ended), make it the current one.
    if (nextPalette) {
        currentPalette = nextPalette;
        nextPalette = null; // Clear the next palette marker
        console.log(`Internal level set to ${levelObject.id}. Palette updated to '${currentPalette?.id}' after transition.`);
    }
    // If there's no current palette (e.g., initial load), select one.
    else if (!currentPalette) {
        currentPalette = selectNextRandomPalette(null); // Select initial random palette
        console.log(`Internal level set to ${levelObject.id}. Initial random palette '${currentPalette?.id}' selected.`);
    }
    // If transitioning to a new level but nextPalette wasn't set (shouldn't happen?), warn and pick a new one.
    else if (oldLevelId && oldLevelId !== levelObject.id && !nextPalette) {
        console.warn(`Transitioned to level ${levelObject.id}, but nextPalette was null. Selecting new random palette.`);
        currentPalette = selectNextRandomPalette(currentPalette); // Select a new one different from the (old) current
        console.log(`New palette selected: '${currentPalette?.id}'`);
    }
    // Otherwise (e.g., re-setting the same level), just keep the current palette.
    else {
         console.log(`Internal level set to ${levelObject.id}. Keeping existing palette '${currentPalette?.id}'.`);
    }

    // Apply background color immediately based on the final currentPalette
    if (currentPalette && currentPalette.backgroundBase) {
        document.body.style.backgroundColor = currentPalette.backgroundBase;
    } else {
        console.warn("Current palette or backgroundBase missing, using default background.");
        document.body.style.backgroundColor = '#0a0a1e'; // Fallback
    }
}

/**
 * Called by level-transition.js when the transition is finished.
 * Sets the level data and updates the palette state.
 * @param {object} completedLevelData - The data of the level that just finished transitioning in.
 */
export function setCurrentLevelDataFromTransition(completedLevelData) {
     if (completedLevelData) {
        // Set the level data. This function will also handle making the `nextPalette` the `currentPalette`.
        setInternalLevelData(completedLevelData);
     } else {
        console.error("setCurrentLevelDataFromTransition called but no level data provided.");
        // Reset nextPalette in case of error?
        nextPalette = null;
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

    // Select initial palette BEFORE setting initial level data
    currentPalette = selectNextRandomPalette(null);
    console.log(`Initial palette selected: '${currentPalette?.id}'`);

    const initialLevelId = room.roomState?.currentLevelId;
    let initialLevelObject = allLoadedLevels.find(level => level.id === initialLevelId);

    if (!initialLevelObject) {
         console.warn(`Initial level ID "${initialLevelId}" not found in generated levels. Using first generated level.`);
         initialLevelObject = allLoadedLevels.length > 0 ? allLoadedLevels[0] : null;
         if (!initialLevelObject) {
             console.error("No levels available to load! Generating a fallback.");
             initialLevelObject = levelGenerate(); // Use generator default config
             initialLevelObject.name = generateLevelName();
             allLoadedLevels.push(initialLevelObject);
         }
         // If this client needs to set the initial level (e.g., host joining empty room)
         if (room.clientId === room.roomState.hostClientId && initialLevelObject) {
            room.updateRoomState({ currentLevelId: initialLevelObject.id });
         }
    }

    // Set the initial level data and apply initial palette's background
    setInternalLevelData(initialLevelObject);

    // --- Room State Subscription ---
    unsubscribeRoomState = room.subscribeRoomState((currentRoomState) => {
        // Don't process level changes while a transition animation is active
        if (isTransitionActive()) return;

        const newLevelId = currentRoomState?.currentLevelId;
        const currentlyLoadedId = currentLevelData?.id;

        // Check if the level ID in the room state is different from the currently loaded one
        if (newLevelId && newLevelId !== currentlyLoadedId) {
            console.log(`Room state change detected: New level ID '${newLevelId}' vs current '${currentlyLoadedId}'.`);
            let newLevelObject = allLoadedLevels.find(level => level.id === newLevelId);

            if (!newLevelObject) {
                console.error(`Level with ID "${newLevelId}" not found in local list! Cannot transition.`);
                // Maybe try to re-sync levels or load a default? For now, just return.
                return;
            }

            // Select the palette for the UPCOMING level
            nextPalette = selectNextRandomPalette(currentPalette);
            const oldPalette = currentPalette; // Keep track of the palette we are transitioning FROM
            console.log(`Starting transition to level '${newLevelObject.name}' (${newLevelId}). Old palette: '${oldPalette?.id}', Next palette: '${nextPalette?.id}'.`);

            // Initiate the visual transition, passing both old and new data
            startLevelTransition(currentLevelData, newLevelObject, oldPalette, nextPalette);
            // Note: setInternalLevelData is called by setCurrentLevelDataFromTransition *after* the animation

        } else if (!newLevelId && currentlyLoadedId) {
            // Handle case where level ID disappears from room state (e.g., error)
            console.warn("Current level ID missing from room state. Keeping current level loaded.");
            // Ensure nextPalette is cleared if a transition was potentially interrupted
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
    peerIds.sort();
    return peerIds[0];
}

export function addRandomGeneratedLevel() {
    const level = levelGenerate();
    level.name = generateLevelName();  
    allLoadedLevels.push(level);
    console.log(`Added new generated level: ${level.name} (${level.id})`);
    return level;
}

export { allLoadedLevels as allLevels };