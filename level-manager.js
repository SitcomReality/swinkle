/**
 * level-manager.js
 * Handles loading and providing access to level data, synchronizing with room state.
 */
import { allLevels } from './levels/level-data.js'; // Import all levels
import { startLevelTransition, isTransitionActive } from './level-transition.js'; // Import transition functions

// Store the currently loaded level data
let currentLevelData = null;
let levelRoom = null; // Store the room instance
let unsubscribeRoomState = () => {};
let waitingForTransition = false; // Flag to track if we're waiting for a transition to finish

/**
 * Loads a specific level object based on its ID.
 * This is now primarily called AFTER a transition completes.
 * @param {object} levelObject - The level data object to load.
 */
function loadLevel(levelObject) {
    if (!levelObject) {
        console.error("loadLevel called with invalid levelObject.");
        return;
    }
    console.log(`Loading level: ${levelObject.name} (${levelObject.id})`);
    currentLevelData = levelObject;
    // Background color update is now handled by level-transition.js
    // document.body.style.backgroundColor = currentLevelData.backgroundColor || '#0a0a1e';
}

/**
 * Callback function for level-transition.js to signal completion.
 * @param {object} completedLevelData - The data of the level that just finished transitioning in.
 */
export function notifyTransitionComplete(completedLevelData) {
     if (completedLevelData) {
        loadLevel(completedLevelData); // Officially load the new level data
     } else {
        console.error("Transition completed but no level data provided.");
     }
     waitingForTransition = false;
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
    const initialLevelId = levelRoom.roomState?.currentLevelId;
    const initialLevelObject = allLevels.find(level => level.id === initialLevelId) || allLevels[0];

    if (!initialLevelId) {
        console.warn("No initial level ID found in room state, loading default level.");
    }
    // Set initial background immediately
    document.body.style.backgroundColor = initialLevelObject.backgroundColor || '#0a0a1e';
    loadLevel(initialLevelObject); // Load initial level data directly


    // Subscribe to room state changes
    unsubscribeRoomState = levelRoom.subscribeRoomState((currentRoomState) => {
        // Don't process updates if a transition is already in progress
        if (isTransitionActive()) return;

        const newLevelId = currentRoomState?.currentLevelId;
        const currentlyLoadedId = currentLevelData?.id;

        // Check if a valid new ID exists and if it's different from the currently loaded one
        if (newLevelId && newLevelId !== currentlyLoadedId) {
            console.log(`Room state changed: New level ID detected - ${newLevelId}`);
            const newLevelObject = allLevels.find(level => level.id === newLevelId);
            if (newLevelObject) {
                // Start transition instead of loading directly
                startLevelTransition(currentLevelData, newLevelObject);
                waitingForTransition = true;
            } else {
                 console.error(`Level with ID "${newLevelId}" found in room state but not in level-data.js!`);
                 // Potentially fall back or keep current level?
            }
        } else if (!newLevelId && currentlyLoadedId) {
            // Handle case where level ID becomes undefined (error state?)
            console.warn("Current level ID missing from room state. Keeping current level loaded.");
        }
    });
}

/**
 * Gets the currently loaded level data (stable state, not mid-transition).
 * Other modules (like collision) should call this to get level geometry.
 * @returns {object | null} The current level data object, or null if none is loaded.
 */
export function getCurrentLevel() {
    if (!currentLevelData) {
        console.warn("Attempted to get current level, but none is loaded.");
    }
    return currentLevelData;
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