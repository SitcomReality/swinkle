/**
 * game-loop.js
 * This file should primarily act as a coordinator, orchestrating the game's update and render cycle.
 * It calls functions from various specialized modules to handle specific tasks like physics,
 * interactions, collisions, rendering, and state management. Avoid adding complex game logic directly here.
 */
import config from 'config';
// Rendering Coordinator Module (NEW)
import { renderScene, initializeRenderer } from './renderer.js';
// Physics & State Modules
import { updatePlayerPhysics } from './playerPhysics.js';
import { updatePaintCanPhysics } from './paintCan.js';
import { getPlayerPhysicsState } from './playerState.js';
// Interaction & Logic Modules
import { handleLocalPlayerInteractions } from './playerInteractions.js';
import { checkCollisionsWithPlayer } from './collisionHandler.js';
import { handlePlayerCollisions } from './collision-system.js';
import { checkExpiredDroplets } from './droplet-manager.js';
import { checkPlayerRespawn } from './respawn-manager.js';
import { initializeUI, updatePaintLevelIndicator } from './ui-manager.js';
import { cleanupAndNotifyPeers } from './peer-manager.js'; // Updated peer manager function
import { addNotification, updateNotifications } from './notification-manager.js'; // Import addNotification/updateNotifications directly
// Power-up Modules
import { checkPowerUpCollisions, processActivePowerUps } from './power-ups/power-up-manager.js'; // Import remaining power-up functions
// Host Logic Module
import { handleHostTasks } from './host-logic.js'; // Import host logic handler
// Effects Module (needed for addEffect call during collision check)
import { addEffect, clearEffects } from './effectsRenderer.js';
// Level Transition Module
import { updateLevelTransition } from './level-transition.js'; // Import level transition updater

let roomInstance = null;
let lastTimestamp = 0; // For calculating delta time
let previousPeerData = {}; // Use object to store peer data { id: { username, ... } }

/**
 * Processes updates for a single player and their owned can (if any).
 * This includes physics updates and, for the local player, interaction checks and owned can physics.
 *
 * @param {string} clientId - The ID of the player to update.
 * @param {object} presence - The player's presence data.
 * @param {number} deltaTime - Time elapsed since the last frame in seconds.
 * @param {number} now - Current timestamp.
 * @param {boolean} isLocalPlayer - Whether this is the local client.
 * @returns {object} Object containing updates to send { paintCanUpdates, dropletsToAdd, presenceUpdates, availablePaintCanUpdates }
 */
function updatePlayerAndCan(clientId, presence, deltaTime, now, isLocalPlayer) {
    const updates = {
        paintCanUpdates: {},
        dropletsToAdd: {},
        presenceUpdates: {},
        availablePaintCanUpdates: {}
    };

    // Update player physics regardless of lost state (they still dangle)
    updatePlayerPhysics(clientId, presence, deltaTime);
    const playerPhysicsState = getPlayerPhysicsState(clientId); // Get state *after* update

    // --- Skip interactions if player is lost ---
    if (presence.lost) {
        return updates;
    }

    // Re-fetch presence after potential updates (e.g. from respawn check before this call)
    // We'll use a local copy for modification within this function if needed
    let currentPresence = { ...presence };

    if (!playerPhysicsState) return updates; // Need physics state for positions
    const playerBodyPos = playerPhysicsState.position;

    // --- Handle Local Player Interactions ---
    if (isLocalPlayer) {
        const interactionResults = handleLocalPlayerInteractions(
            clientId,
            currentPresence, // Use potentially updated presence
            playerBodyPos,
            roomInstance.roomState.paintCans || {},
            roomInstance.roomState.availablePaintCans || {},
            deltaTime,
            now
        );
        // Merge interaction results
        updates.paintCanUpdates = { ...updates.paintCanUpdates, ...interactionResults.paintCanUpdates };
        updates.dropletsToAdd = { ...updates.dropletsToAdd, ...interactionResults.newDroplets };
        updates.presenceUpdates = { ...updates.presenceUpdates, ...interactionResults.presenceUpdates };
        updates.availablePaintCanUpdates = { ...updates.availablePaintCanUpdates, ...interactionResults.availablePaintCanUpdates };

        // Update local presence cache immediately for consistency within the frame
        // (e.g., if a can was picked up or dropped)
        if (Object.keys(interactionResults.presenceUpdates).length > 0) {
            currentPresence = { ...currentPresence, ...interactionResults.presenceUpdates };
            // Also update the main room presence cache directly
            Object.assign(roomInstance.presence[clientId], interactionResults.presenceUpdates);
        }
    }

    // --- Update Held Paint Can Physics (Only Owner Calculates & Sends) ---
    const currentCanId = currentPresence.currentCanId; // Use potentially updated presence
    if (isLocalPlayer && currentCanId) {
        // Get the can state, potentially merging with interaction updates from this frame
        const baseCanState = roomInstance.roomState.paintCans?.[currentCanId];
        const interactionCanUpdate = updates.paintCanUpdates[currentCanId];
        let canStateForPhysics = baseCanState ? { ...baseCanState, ...interactionCanUpdate } : null;

        // Check if the can still exists after interactions (might have been dropped/nulled)
        if (canStateForPhysics && canStateForPhysics.ownerId === clientId) {
            // Update the physics using the player's latest body position
            updatePaintCanPhysics(canStateForPhysics, playerBodyPos, deltaTime);

            // Add the calculated physics results to the updates to be sent
            updates.paintCanUpdates[currentCanId] = {
                ...(updates.paintCanUpdates[currentCanId] || {}), // Keep interaction updates
                x: canStateForPhysics.x,
                y: canStateForPhysics.y,
                vx: canStateForPhysics.vx,
                vy: canStateForPhysics.vy
            };
        } else if (baseCanState === null || interactionCanUpdate === null) {
            // If the can was explicitly set to null by interactions (e.g., empty drop),
            // ensure we send the null update and don't try to calculate physics.
            updates.paintCanUpdates[currentCanId] = null;
        }
    }

    return updates;
}

/**
 * Main game loop function.
 */
function gameLoop(timestamp) {
    if (!roomInstance) return; // Stop the loop if room is not set

    const canvas = document.getElementById('game-canvas');
    if (!canvas) return; // Stop if canvas isn't there
    const ctx = canvas.getContext('2d');
    const now = Date.now();
    const localClientId = roomInstance.clientId;

    // --- Timing and Canvas Setup ---
    if (!lastTimestamp) lastTimestamp = timestamp;
    const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.1); // Limit max delta time
    lastTimestamp = timestamp;
    if (canvas.width !== config.gameAreaWidth || canvas.height !== config.gameAreaHeight) {
        canvas.width = config.gameAreaWidth;
        canvas.height = config.gameAreaHeight;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear before rendering

    // --- Update Level Transition ---
    // This handles background color changes and transition state updates
    updateLevelTransition(deltaTime, now);

    // --- State Updates & Cleanup ---
    // Update notifications before peer checks
    updateNotifications(now);

    // Check for peer joins/leaves and trigger notifications/cleanup
    previousPeerData = cleanupAndNotifyPeers(previousPeerData, roomInstance.peers, addNotification);

    const localPresenceBeforeUpdate = { ...(roomInstance.presence[localClientId] || {}) }; // Copy before updates

    // --- Respawn Check (Local Player) ---
    let localPresenceUpdates = checkPlayerRespawn(
        localClientId,
        localPresenceBeforeUpdate,
        now,
        config.gameAreaWidth, // Use game area config
        config.gameAreaHeight // Use game area config
    );
    // Apply respawn updates immediately to local cache
    if (Object.keys(localPresenceUpdates).length > 0 && roomInstance.presence[localClientId]) {
        Object.assign(roomInstance.presence[localClientId], localPresenceUpdates);
    }
     // --- Process Expired Power-ups (Local Player) *before* interactions ---
     // Ensures interactions use the correct power-up state
     const presenceAfterRespawn = roomInstance.presence[localClientId] || localPresenceBeforeUpdate;
     const expiredPowerUpUpdates = processActivePowerUps(localClientId, presenceAfterRespawn, now);
     // Merge presence updates from expired power-ups
     localPresenceUpdates = { ...localPresenceUpdates, ...expiredPowerUpUpdates };
     // Update local presence cache immediately after processing expired power-ups
     if (Object.keys(expiredPowerUpUpdates).length > 0 && roomInstance.presence[localClientId]) {
         Object.assign(roomInstance.presence[localClientId], expiredPowerUpUpdates);
     }

    // --- Per-Player Updates (Physics & Interactions) ---
    let allPaintCanUpdates = {};
    let allDropletsToAdd = {};
    let allAvailablePaintCanUpdates = {};

    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        if (presence) {
            const playerUpdates = updatePlayerAndCan(clientId, presence, deltaTime, now, clientId === localClientId);

            // Merge updates from each player/can
            allPaintCanUpdates = { ...allPaintCanUpdates, ...playerUpdates.paintCanUpdates };
            allDropletsToAdd = { ...allDropletsToAdd, ...playerUpdates.dropletsToAdd };
            allAvailablePaintCanUpdates = { ...allAvailablePaintCanUpdates, ...playerUpdates.availablePaintCanUpdates };
            // Merge presence updates specifically for the local player
            if (clientId === localClientId) {
                localPresenceUpdates = { ...localPresenceUpdates, ...playerUpdates.presenceUpdates };
            }
        }
    });

    // --- Global Updates & Checks (Local Client Authority) ---
    let allDropletRemovals = {};
    let presenceRequests = [];
    let allPowerUpUpdates = {}; // Store power-up updates (spawns and removals)
    let powerUpsToRemoveFromState = {}; // Store removals for room state update
    let levelUpdates = {}; // Store level change updates

    // Handle Host Tasks (Spawning, Level Cycling)
    const hostTaskResults = handleHostTasks(
        roomInstance,
        deltaTime,
        now,
        config.gameAreaWidth, // Use game area config
        config.gameAreaHeight // Use game area config
    );
    allAvailablePaintCanUpdates = { ...allAvailablePaintCanUpdates, ...hostTaskResults.availablePaintCanUpdates };
    allPowerUpUpdates = { ...allPowerUpUpdates, ...hostTaskResults.powerUpUpdates };
    levelUpdates = { ...levelUpdates, ...hostTaskResults.levelUpdates };

    // Player-Player Collisions (Stealing)
    const stealCollisionResults = handlePlayerCollisions(localClientId, roomInstance);
    allPaintCanUpdates = { ...allPaintCanUpdates, ...stealCollisionResults.paintCanUpdates };
    localPresenceUpdates = { ...localPresenceUpdates, ...stealCollisionResults.localPresenceUpdates };
    presenceRequests = [...presenceRequests, ...stealCollisionResults.presenceRequests];
    // Update local presence cache immediately for steal results
    if (stealCollisionResults.localPresenceUpdates.currentCanId !== undefined && roomInstance.presence[localClientId]) {
         // Check for undefined to handle cases where currentCanId becomes null
        Object.assign(roomInstance.presence[localClientId], stealCollisionResults.localPresenceUpdates);
    }

    // --- Local Player Specific Updates (Post-Interaction, Pre-Collision) ---
    // Use presence potentially updated by interactions, respawn, stealing, or powerup expiration
    const currentLocalPresence = roomInstance.presence[localClientId];
    const localPlayerPhysics = getPlayerPhysicsState(localClientId);

    // Power-up Collision Check (Local Player)
    if (localPlayerPhysics && currentLocalPresence && !currentLocalPresence.lost) {
        const powerUpCollisionResults = checkPowerUpCollisions(
            localPlayerPhysics.position,
            localClientId,
            roomInstance.roomState.powerUps || {},
            currentLocalPresence // Pass the most current presence state
        );
        // Merge power-up removals into the batch for room state update
        powerUpsToRemoveFromState = { ...powerUpsToRemoveFromState, ...powerUpCollisionResults.powerUpsToRemove };
        // Merge presence updates from collecting power-ups
        localPresenceUpdates = { ...localPresenceUpdates, ...powerUpCollisionResults.presenceUpdates };
        // Update local presence cache immediately after collecting power-ups
        if (Object.keys(powerUpCollisionResults.presenceUpdates).length > 0) {
            Object.assign(roomInstance.presence[localClientId], powerUpCollisionResults.presenceUpdates);
        }
    }

    // Droplet Collision with Local Player
    // Re-fetch physics and presence in case they changed due to respawn/powerups/etc
    const finalLocalPlayerPhysics = getPlayerPhysicsState(localClientId);
    const finalLocalPresence = roomInstance.presence[localClientId];
    if (finalLocalPlayerPhysics && finalLocalPresence && !finalLocalPresence.lost) {
        const { dropletsToRemove: collidedDroplets, collisionPoints } = checkCollisionsWithPlayer(
            finalLocalPlayerPhysics.position,
            roomInstance.roomState.droplets || {},
            localClientId,
            finalLocalPresence,
            now
        );
        allDropletRemovals = { ...allDropletRemovals, ...collidedDroplets };
        collisionPoints.forEach(point => addEffect('splat', { x: point.x, y: point.y, color: point.color }));
        // Note: checkCollisionsWithPlayer updates presence directly for paint/loss state
    }

    // Expired Droplets Check
    const expiredDroplets = checkExpiredDroplets(roomInstance.roomState.droplets || {}, now);
    allDropletRemovals = { ...allDropletRemovals, ...expiredDroplets };

    // --- Send Batched Updates to Server ---
    const roomStateUpdates = {};
    if (Object.keys(allPaintCanUpdates).length > 0) roomStateUpdates.paintCans = allPaintCanUpdates;
    if (Object.keys(allAvailablePaintCanUpdates).length > 0) roomStateUpdates.availablePaintCans = allAvailablePaintCanUpdates;
    if (Object.keys(allDropletsToAdd).length > 0) roomStateUpdates.droplets = allDropletsToAdd;
    if (Object.keys(allDropletRemovals).length > 0) {
        roomStateUpdates.droplets = { ...(roomStateUpdates.droplets || {}), ...allDropletRemovals };
    }
    // Include power-up updates (spawns and removals)
    const finalPowerUpUpdates = { ...allPowerUpUpdates, ...powerUpsToRemoveFromState };
    if (Object.keys(finalPowerUpUpdates).length > 0) {
        roomStateUpdates.powerUps = finalPowerUpUpdates;
    }
    // Include level updates (currentLevelId, nextLevelChangeTime)
    if (Object.keys(levelUpdates).length > 0) {
        // Merge level updates into the main updates object
        Object.assign(roomStateUpdates, levelUpdates);
    }

    // Send room state updates if any occurred
    if (Object.keys(roomStateUpdates).length > 0) {
        roomInstance.updateRoomState(roomStateUpdates);
    }
    // Send local presence updates if any occurred (accumulated from respawn, interactions, stealing, powerups)
    if (Object.keys(localPresenceUpdates).length > 0) {
        roomInstance.updatePresence(localPresenceUpdates);
    }
    // Send presence update requests if any occurred
    presenceRequests.forEach(req => {
        roomInstance.requestPresenceUpdate(req.targetId, req.update);
    });

    // --- Render Scene (Call the Coordinator) ---
    // Pass canvas context, room instance, client ID, time info
    renderScene(ctx, roomInstance, localClientId, now, deltaTime);

    // --- Update UI ---
    // Use the final local presence after all updates this frame
    const finalLocalPresenceForUI = roomInstance.presence[localClientId];
    // Pass owned cans state from roomState for indicator
    const ownedCansForUI = roomInstance.roomState.paintCans || {};
    updatePaintLevelIndicator(localClientId, finalLocalPresenceForUI, ownedCansForUI);

    // --- Request Next Frame ---
    requestAnimationFrame(gameLoop);
}

/**
 * Initializes and starts the game loop.
 * @param {object} room - The WebsimSocket room instance.
 */
export function startGameLoop(room) {
    if (!room) throw new Error("startGameLoop requires a valid room instance.");
    roomInstance = room;
    console.log("Starting game loop...");

    initializeUI(); // Initialize UI elements
    initializeRenderer(); // Initialize Renderer related things (if any)
    lastTimestamp = 0;
    // Initialize previousPeerData with a copy of current peers
    previousPeerData = { ...(room.peers || {}) };
    clearEffects(); // Clear any lingering effects from previous runs
    requestAnimationFrame(gameLoop);
}