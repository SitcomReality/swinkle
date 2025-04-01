/**
 * spectate-mode.js
 * Handles logic related to the spectator mode, primarily anchor point movement.
 */
import config from 'config';
// Import room directly ONLY for spectate entry logic to drop cans. Avoid elsewhere.
import { room } from './main.js';
// Import GLOBAL notification manager
import { addGlobalNotification } from './notification-manager.js';

// Stores state for each spectator: { x: number, vx: number }
const spectatorStates = new Map();

/**
 * Calculates and returns the anchor position for a spectator player.
 * The anchor moves randomly along the top edge of the game area.
 * Uses constants defined in config.js
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

    // Use config values for physics parameters
    const forceMagnitude = config.spectatorForceMagnitude;
    const dampingFactor = config.spectatorDampingFactor;
    const maxSpeed = config.spectatorMaxSpeed;
    const topMargin = config.spectatorAnchorMarginY;

    // Apply a random horizontal force occasionally
    if (Math.random() < 0.05) { // ~5% chance per frame to apply force
        const randomForce = (Math.random() - 0.5) * 2 * forceMagnitude; // Random force between -MAG and +MAG
        state.vx += randomForce * deltaTime;
    }

    // Apply damping (using Math.pow for frame rate independence)
    state.vx *= Math.pow(dampingFactor, deltaTime * 60);

    // Clamp velocity
    state.vx = Math.max(-maxSpeed, Math.min(maxSpeed, state.vx));

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
        y: topMargin,
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
 * Updates presence, drops the currently held can (if any), and sends a global notification.
 * @param {string} clientId - The ID of the client entering spectator mode.
 * @param {object} roomInstance - The WebsimSocket room instance.
 */
export function enterSpectateMode(clientId, roomInstance) {
    const localPresence = roomInstance.presence[clientId];
    if (!localPresence || localPresence.isSpectating) return; // Already spectating or no presence

    const username = roomInstance.peers[clientId]?.username || 'Player';
    console.log(`Player ${username} (${clientId}) entering spectate mode.`);
    // Send GLOBAL notification
    addGlobalNotification(`${username} is now spectating.`, 'info', 3000)
        .catch(err => console.error('Error sending global spectate notification:', err));

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

/**
 * Renders the "Spectating - Click to Respawn" UI text if the local player is spectating.
 * Applies a pulsating effect.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {boolean} isSpectating - Whether the local player is currently spectating.
 */
export function renderSpectateUI(ctx, isSpectating) {
    if (!isSpectating) return;

    const now = Date.now();
    const text = "Spectating - Click to Respawn";
    const pulseSpeed = 0.003; // Speed of pulsation
    const minAlpha = 0.6;
    const maxAlpha = 1.0;
    const alphaRange = maxAlpha - minAlpha;
    const alpha = minAlpha + (alphaRange * (1 + Math.sin(now * pulseSpeed)) / 2); // Pulsate between min and max alpha

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Position near the bottom center of the screen
    const x = config.gameAreaWidth / 2;
    const y = config.gameAreaHeight - 60; // Adjust vertical position as needed

    ctx.fillText(text, x, y);

    ctx.restore();
}