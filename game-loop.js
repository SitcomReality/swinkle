/**
 * game-loop.js
 * Manages the main rendering cycle of the game. Coordinates updates and rendering.
 */
import config from 'config';
// Player state management (only for disconnection cleanup)
import { removePlayerPhysicsState } from './playerState.js';
// Effects (only for clearing on start)
import { clearEffects } from './effectsRenderer.js';
// Game Updater Module (handles logic)
import { updateGameState } from './gameUpdater.js';
// Game Renderer Module (handles drawing)
import { renderGame } from './gameRenderer.js';

let roomInstance = null;
let lastTimestamp = 0; // For calculating delta time
let previousPeers = new Set(); // To track disconnected peers

// UI Element References (initialized in startGameLoop)
let paintIndicatorElement;
let paintIndicatorFillElement;
let paintIndicatorTextElement;

// Local state for interaction confirmation
let localPickupAttempt = { canId: null };
let localStealAttempt = { canId: null };

/**
 * Updates the paint level indicator UI element.
 */
// Removed, now handled in gameRenderer.js

// --- Main Game Loop Function ---
function gameLoop(timestamp) {
    if (!roomInstance) {
        console.error("Room instance not available in game loop.");
        return; // Stop the loop if room is not set
    }

    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return; // Stop if canvas isn't there
    }
    const ctx = canvas.getContext('2d');
    const now = Date.now();
    const localClientId = roomInstance.clientId;

    // --- Delta Time Calculation ---
    if (!lastTimestamp) lastTimestamp = timestamp;
    const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;

    // --- Canvas Resizing ---
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }

    // --- Detect Disconnected Peers ---
    const currentPeerIds = new Set(Object.keys(roomInstance.peers));
    previousPeers.forEach(clientId => {
        if (!currentPeerIds.has(clientId)) {
            removePlayerPhysicsState(clientId); // Uses player state module
            // Note: Can ownership release is handled via presence subscription in main.js
            console.log(`Peer ${clientId} disconnected, player physics removed.`);
        }
    });
    previousPeers = currentPeerIds;

    // --- Update Game State Logic ---
    // Calls the updater module which handles physics, interactions, collisions, etc.
    // and returns the necessary state changes.
    const {
        roomStateUpdates,
        localPresenceUpdates: immediateLocalPresenceUpdates, // Updates not needing confirmation (respawn, paint, empty drop)
        presenceRequests,
        pickupAttempt, // Stores canId if local client *tried* to pick up this frame
        stealAttempt // Stores canId if local client *tried* to steal this frame
    } = updateGameState(roomInstance, deltaTime, now, canvas, localClientId);

    // Update local tracking of attempts
    localPickupAttempt = pickupAttempt;
    localStealAttempt = stealAttempt;

    // --- Confirm Pickup/Steal Attempts ---
    // Check if a previously attempted pickup/steal was successful based on received roomState.
    let confirmedInteractionPresenceUpdate = {};
    if (localPickupAttempt.canId) {
        const canState = roomInstance.roomState.paintCans?.[localPickupAttempt.canId];
        if (canState && canState.ownerId === localClientId) {
            console.log(`Pickup confirmed for can ${localPickupAttempt.canId}`);
            confirmedInteractionPresenceUpdate.currentCanId = localPickupAttempt.canId;
        } else {
             console.log(`Pickup failed or pending for can ${localPickupAttempt.canId}`);
             // No presence update needed, maybe attempt failed or state hasn't arrived yet
        }
        localPickupAttempt.canId = null; // Reset attempt check for next frame
    }
    if (localStealAttempt.canId) {
         const canState = roomInstance.roomState.paintCans?.[localStealAttempt.canId];
         if (canState && canState.ownerId === localClientId) {
             console.log(`Steal confirmed for can ${localStealAttempt.canId}`);
             confirmedInteractionPresenceUpdate.currentCanId = localStealAttempt.canId;
         } else {
             console.log(`Steal failed or pending for can ${localStealAttempt.canId}`);
             // Steal failed (target might have dropped it, or another player stole first)
         }
        localStealAttempt.canId = null; // Reset attempt check
    }


    // --- Send Batched Updates ---
    // Room State Updates (Proposals for pickup/steal, physics, drops, spawns)
    if (Object.keys(roomStateUpdates).length > 0) {
        roomInstance.updateRoomState(roomStateUpdates);
    }

    // Local Presence Updates (Combine immediate changes + confirmed interactions)
    const finalLocalPresenceUpdates = {
         ...immediateLocalPresenceUpdates,
         ...confirmedInteractionPresenceUpdate
    };
    if (Object.keys(finalLocalPresenceUpdates).length > 0) {
        roomInstance.updatePresence(finalLocalPresenceUpdates);
    }

    // Presence Update Requests (Steal Requests - asking target to drop)
    presenceRequests.forEach(req => roomInstance.requestPresenceUpdate(req.targetId, req.update));

    // --- Render Scene ---
    // Calls the renderer module
    renderGame(
        ctx,
        roomInstance,
        now,
        deltaTime,
        localClientId,
        paintIndicatorElement,
        paintIndicatorFillElement,
        paintIndicatorTextElement
    );

    requestAnimationFrame(gameLoop);
}

/**
 * Initializes and starts the game loop.
 * @param {object} room - The WebsimSocket room instance.
 */
export function startGameLoop(room) {
    if (!room) {
        throw new Error("startGameLoop requires a valid room instance.");
    }
    roomInstance = room;
    console.log("Starting game loop...");

    // Get UI element references ONCE after DOM is ready
    paintIndicatorElement = document.getElementById('paint-level-indicator');
    if (paintIndicatorElement) {
        paintIndicatorFillElement = paintIndicatorElement.querySelector('.indicator-bar-fill');
        paintIndicatorTextElement = paintIndicatorElement.querySelector('.indicator-text');
        if (!paintIndicatorFillElement || !paintIndicatorTextElement) {
             console.error("Paint level indicator elements not found!");
             paintIndicatorElement = null; // Disable if children are missing
        }
    } else {
         console.error("Paint level indicator container not found!");
    }

    lastTimestamp = 0;
    previousPeers = new Set(Object.keys(room.peers || {}));
    localPickupAttempt = { canId: null }; // Reset local state on start
    localStealAttempt = { canId: null };
    clearEffects(); // Clear any lingering effects from previous session
    requestAnimationFrame(gameLoop);
}