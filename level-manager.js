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
        console.warn("No palettes defined. Using default fallback.");
        return { paint1: '#FF00FF', paint2: '#00FFFF', backgroundBase: '#0a0a1e' };
    }
    if (palettes.length === 1) return palettes[0];

    let potentialNext;
    let attempts = 0;
    const maxAttempts = palettes.length * 2;

    do {
        potentialNext = getRandomPalette();
        attempts++;
    } while (
        current &&
        potentialNext.paint1 === current.paint1 &&
        potentialNext.paint2 === current.paint2 &&
        potentialNext.backgroundBase === current.backgroundBase &&
        attempts < maxAttempts
    );

    if (attempts >= maxAttempts) {
        console.warn("Could not find a different random palette. Repeating palette.");
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

    if (nextPalette) {
        currentPalette = nextPalette;
        nextPalette = null;
        console.log(`Internal level set to ${levelObject.id}. Current palette updated after transition. Paint1: ${currentPalette?.paint1}`);
    } else if (!currentPalette) {
        currentPalette = selectNextRandomPalette(null);
        console.warn(`Internal level set to ${levelObject.id}, but nextPalette was null. Setting initial random palette. Paint1: ${currentPalette?.paint1}`);
    } else {
        console.log(`Internal level set to ${levelObject.id}. Keeping existing palette. Paint1: ${currentPalette?.paint1}`);
    }

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

    currentPalette = selectNextRandomPalette(null);
    console.log(`Initial palette selected randomly. Paint1: ${currentPalette?.paint1}`);

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
         if (room.clientId === room.roomState.hostClientId && initialLevelObject) {
            room.updateRoomState({ currentLevelId: initialLevelObject.id });
         }
    }

    setInternalLevelData(initialLevelObject);

    unsubscribeRoomState = room.subscribeRoomState((currentRoomState) => {
        if (isTransitionActive()) return;

        const newLevelId = currentRoomState?.currentLevelId;
        const currentlyLoadedId = currentLevelData?.id;

        if (newLevelId && newLevelId !== currentlyLoadedId) {
            console.log(`Room state changed: New level ID detected - ${newLevelId}`);
            let newLevelObject = allLoadedLevels.find(level => level.id === newLevelId);

            if (!newLevelObject) {
                console.error(`Level with ID "${newLevelId}" not found in local list!`);
                return;
            }

            nextPalette = selectNextRandomPalette(currentPalette);
            const oldPalette = currentPalette;
            console.log(`Transitioning to level ${newLevelId}. Old palette P1: ${oldPalette?.paint1}, New palette P1: ${nextPalette?.paint1}`);
            startLevelTransition(currentLevelData, newLevelObject, oldPalette, nextPalette);

        } else if (!newLevelId && currentlyLoadedId) {
            console.warn("Current level ID missing from room state. Keeping current level loaded.");
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