/**
 * local-state.js
 * Manages local client state, such as idle timer variables.
 */
import config from 'config';

let lastSignificantMoveTime = Date.now();
let lastKnownPosition = { x: config.gameAreaWidth / 2, y: config.gameAreaHeight / 2 }; // Default initial position

export function updateIdleState(newPosition) {
    const dx = newPosition.x - lastKnownPosition.x;
    const dy = newPosition.y - lastKnownPosition.y;
    const distSq = dx*dx + dy*dy;

    if (distSq > (config.idleMoveThresholdSq || 25)) {
        lastSignificantMoveTime = Date.now();
        lastKnownPosition = { x: newPosition.x, y: newPosition.y };
        return true; // Movement was significant
    }
    return false; // Movement was not significant
}

export function resetIdleTimer(position) {
     lastSignificantMoveTime = Date.now();
     lastKnownPosition = { x: position.x, y: position.y };
     console.log("Idle timer reset.");
}

export function getLastSignificantMoveTime() {
    return lastSignificantMoveTime;
}

export function getLastKnownPosition() {
    return lastKnownPosition;
}