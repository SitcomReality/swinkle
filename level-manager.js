/**
 * level-manager.js
 * Handles loading and providing access to level data, synchronizing with room state.
 */
import { allLevels } from './levels/level-data.js'; // Import all levels

// Store the currently loaded level data
let currentLevelData = null;
let levelRoom = null; // Store the room instance
let unsubscribeRoomState = () => {};

/**
 * Loads a specific level object based on its ID.
 * @param {string} levelId - The ID of the level to load.
 */
function loadLevelById(levelId) {
    const levelObject = allLevels.find(level => level.id === levelId);

    if (!levelObject) {
        console.error(`Level with ID "${levelId}" not found.`);
        // Fallback to the first level in the array if invalid data is somehow passed
        console.warn("Falling back to the first defined level.");
        currentLevelData = allLevels[0];
    } else {
        console.log(`Loading level: ${levelObject.name} (${levelObject.id})`);
        currentLevelData = levelObject;
        // Update background color
        document.body.style.backgroundColor = currentLevelData.backgroundColor || '#0a0a1e';
        // Potential future extension: Trigger effects or reset player positions?
        // Currently, objects just persist across level changes.
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

    // Initial level load based on current room state
    const initialLevelId = levelRoom.roomState?.currentLevelId;
    if (initialLevelId) {
        loadLevelById(initialLevelId);
    } else {
        // If no level ID in room state yet (e.g., before host initializes it), load default
        console.warn("No initial level ID found in room state, loading default level.");
        loadLevelById(allLevels[0].id); // Load the first level as a fallback
    }

    // Subscribe to room state changes
    unsubscribeRoomState = levelRoom.subscribeRoomState((currentRoomState) => {
        const newLevelId = currentRoomState?.currentLevelId;
        const currentlyLoadedId = currentLevelData?.id;

        // Check if a valid new ID exists and if it's different from the currently loaded one
        if (newLevelId && newLevelId !== currentlyLoadedId) {
            console.log(`Room state changed: New level ID detected - ${newLevelId}`);
            loadLevelById(newLevelId);
        } else if (!newLevelId && currentlyLoadedId) {
            // Handle case where level ID becomes undefined (error state?)
            console.warn("Current level ID missing from room state. Keeping current level loaded.");
        }
    });
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