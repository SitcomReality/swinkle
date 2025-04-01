/**
 * spectate-mode.js
 * Handles logic related to the spectator mode, primarily anchor point movement.
 */
import config from 'config';
// Import room directly ONLY for spectate entry logic to drop cans. Avoid elsewhere.
import { room } from './main.js';

// Stores state for each spectator: { x: number, vx: number }
const spectatorStates = new Map();

const TOP_MARGIN = config.spectatorAnchorMarginY || 10; // Fixed Y position
const MAX_SPEED = config.spectatorMaxSpeed || 150; // Max horizontal speed
const FORCE_MAGNITUDE = config.spectatorForceMagnitude || 2000; // Random force strength
const DAMPING_FACTOR = config.spectatorDampingFactor || 0.95; // Damping

/**
 * Calculates and returns the anchor position for a spectator player.
 * The anchor moves randomly along the top edge of the game area.
 * @param {string} clientId - The ID of the spectator client.
 * @param {number} deltaTime - Time elapsed since the last frame in seconds.
 * @returns {object} The calculated anchor position { x, y }.
 */
export function getSpectatorAnchorPosition(clientId, deltaTime) {
    // Initialize state if it doesn't exist
    if (!spectatorStates.has(clientId)) {
        spectatorStates.set(clientId, {
            x: config.gameAreaWidth / 2, // Start in the middle
            vx: 0,
        });
    }

    const state = spectatorStates.get(clientId);

    // Apply a random horizontal force occasionally
    if (Math.random() < 0.05) { // ~5% chance per frame to apply force
        const randomForce = (Math.random() - 0.5) * 2 * FORCE_MAGNITUDE; // Random force between -MAG and +MAG
        state.vx += randomForce * deltaTime;
    }

    // Apply damping
    state.vx *= Math.pow(DAMPING_FACTOR, deltaTime * 60);

    // Clamp velocity
    state.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, state.vx));

    // Update position
    state.x += state.vx * deltaTime;

    // Clamp position within game boundaries (with a small margin)
    const sideMargin = 10;
    state.x = Math.max(sideMargin, Math.min(config.gameAreaWidth - sideMargin, state.x));

    // Update the stored state
    spectatorStates.set(clientId, state);

    // Return the fixed Y and calculated X
    return {
        x: state.x,
        y: TOP_MARGIN,
    };
}

/**
 * Removes the stored state for a spectator.
 * Called when a player leaves spectator mode or disconnects.
 * @param {string} clientId - The ID of the client whose state should be removed.
 */
export function removeSpectatorState(clientId) {
    spectatorStates.delete(clientId);
    // console.log(`Removed spectator state for client ${clientId}`);
}

/**
 * Handles the logic for a player entering spectator mode.
 * Updates presence and drops the currently held can, if any.
 * @param {string} clientId - The ID of the client entering spectator mode.
 * @param {object} roomInstance - The WebsimSocket room instance.
 */
export function enterSpectateMode(clientId, roomInstance) {
    const localPresence = roomInstance.presence[clientId];
    if (!localPresence || localPresence.isSpectating) return; // Already spectating or no presence

    console.log(`Player ${clientId} entering spectate mode.`);
    const presenceUpdate = { isSpectating: true };
    let roomStateUpdate = {};

    // If holding a can, drop it
    const currentCanId = localPresence.currentCanId;
    if (currentCanId && roomInstance.roomState.paintCans?.[currentCanId]) {
        console.log(`Dropping can ${currentCanId} due to entering spectate mode.`);
        presenceUpdate.currentCanId = null; // Remove from presence

        // Make the can available in room state
        const canState = roomInstance.roomState.paintCans[currentCanId];
        roomStateUpdate = {
            paintCans: { [currentCanId]: null }, // Remove from owned
            availablePaintCans: { // Add to available
                [currentCanId]: {
                    ...canState,
                    ownerId: null,
                    vx: 0, vy: 0, // Reset physics
                    isCharging: false, accumulatedDroplets: 0,
                    isMega: canState.isMega || false // Preserve mega status
                }
            }
        };
    }

    // Send updates
    roomInstance.updatePresence(presenceUpdate);
    if (Object.keys(roomStateUpdate).length > 0) {
        roomInstance.updateRoomState(roomStateUpdate);
    }
}