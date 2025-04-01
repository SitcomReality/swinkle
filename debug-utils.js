/**
 * debug-utils.js
 * Contains utility functions for development and debugging purposes,
 * exposed to the browser console.
 */
import { room } from './main.js';
import { allLevels } from './level-manager.js';
import config from 'config';

/**
 * Immediately triggers a change to the next level in the sequence.
 * This sends an update to the room state, which the host should process.
 */
function nextLevel() {
    if (!room || !room.roomState || !room.clientId) {
        console.error("Room not ready or not initialized.");
        return;
    }

    const currentLevelId = room.roomState.currentLevelId || allLevels[0].id;
    const currentLevelIndex = allLevels.findIndex(level => level.id === currentLevelId);
    const nextLevelIndex = (currentLevelIndex + 1) % allLevels.length;
    const nextLevel = allLevels[nextLevelIndex];

    if (nextLevel) {
        console.log(`DEBUG: Forcing level change to ${nextLevel.name} (${nextLevel.id})...`);
        // Update room state to trigger the change.
        // Set next change time slightly in the past relative to 'now' on the host,
        // or just a very small future time to ensure the host logic picks it up quickly.
        const update = {
            currentLevelId: nextLevel.id,
            nextLevelChangeTime: Date.now() + 100 // Trigger slightly in the future
        };
        room.updateRoomState(update);
        console.log("DEBUG: Sent room state update for level change.");
    } else {
        console.error(`DEBUG: Could not find next level at index ${nextLevelIndex}`);
    }
}

/**
 * Attaches debug functions to the window object.
 */
export function exposeDebugUtils() {
    window.dbg = window.dbg || {}; // Create a namespace if it doesn't exist
    window.dbg.nextLevel = nextLevel;
    console.log("Debug utilities exposed under `window.dbg` (e.g., `window.dbg.nextLevel()`)");
}