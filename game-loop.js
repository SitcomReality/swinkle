/**
 * game-loop.js
 * This file should primarily act as a coordinator, orchestrating the game's update and render cycle.
 * It calls functions from various specialized modules to handle specific tasks like physics,
 * interactions, collisions, rendering, and state management. Avoid adding complex game logic directly here.
 */
import config from 'config';
// Rendering Modules
import { renderPlayer } from './playerRenderer.js';
import { renderPaintCan } from './paintCan.js';
import { renderDroplets } from './dropletRenderer.js';
import { updateAndRenderEffects, clearEffects, addEffect } from './effectsRenderer.js';
import { renderLevel } from './level-renderer.js'; // Import level renderer
import { renderPowerUp } from './power-ups/power-up-renderer.js'; // Import power-up renderer
import { renderNotifications, updateNotifications } from './notification-manager.js'; // Import notification rendering/update
// Physics & State Modules
import { updatePlayerPhysics } from './playerPhysics.js';
import { updatePaintCanPhysics } from './paintCan.js';
import { getPlayerPhysicsState } from './playerState.js';
// Interaction & Logic Modules
import { handleLocalPlayerInteractions } from './playerInteractions.js';
import { checkCollisionsWithPlayer } from './collisionHandler.js';
import { handlePlayerCollisions } from './collision-system.js';
import { spawnPaintCans } from './can-manager.js';
import { checkExpiredDroplets } from './droplet-manager.js';
import { checkPlayerRespawn } from './respawn-manager.js';
import { initializeUI, updatePaintLevelIndicator } from './ui-manager.js';
import { cleanupAndNotifyPeers } from './peer-manager.js'; // Updated peer manager function
import { addNotification } from './notification-manager.js'; // Import addNotification directly
// Power-up Modules
import { spawnPowerUps, checkPowerUpCollisions, processActivePowerUps } from './power-ups/power-up-manager.js'; // Import power-up functions

let roomInstance = null;
let lastTimestamp = 0; // For calculating delta time
let previousPeerData = {}; // Use object to store peer data { id: { username, ... } }

/**
 * Processes updates for a single player and their owned can (if any).
 * This includes physics updates and, for the local player, interaction checks.
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

    // --- Skip interactions if player is lost ---
    if (presence.lost) {
        return updates;
    }

    const playerPhysicsState = getPlayerPhysicsState(clientId);
    if (!playerPhysicsState) return updates; // Need physics state for positions
    const playerBodyPos = playerPhysicsState.position;

    // --- Handle Local Player Interactions ---
    if (isLocalPlayer) {
        const interactionResults = handleLocalPlayerInteractions(
            clientId,
            presence,
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
            Object.assign(roomInstance.presence[clientId], interactionResults.presenceUpdates);
        }
        // Re-fetch presence after potential updates from interactions
        presence = roomInstance.presence[clientId];
    }

    // --- Update Held Paint Can Physics (Only Owner Calculates) ---
    const currentCanId = presence.currentCanId;
    if (currentCanId && roomInstance.roomState.paintCans?.[currentCanId]) {
        const canState = roomInstance.roomState.paintCans[currentCanId];
        // Physics update for the can is now done globally for all owned cans after player updates
        // We only need the owner check if specific interactions affect can physics directly (not currently)
        // if (canState.ownerId === clientId && isLocalPlayer) { ... }
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
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
        canvas.width,
        canvas.height
    );
    // Apply respawn updates immediately to local cache
    if (Object.keys(localPresenceUpdates).length > 0 && roomInstance.presence[localClientId]) {
        Object.assign(roomInstance.presence[localClientId], localPresenceUpdates);
        // If respawn happened, re-fetch the presence for subsequent checks this frame
        const updatedLocalPresence = roomInstance.presence[localClientId];
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

    // --- Global Owned Can Physics Update (After Player Positions are Finalized) ---
    // Iterate through owned cans and update their physics based on their owner's final position
    Object.entries(roomInstance.roomState.paintCans || {}).forEach(([canId, canState]) => {
        if (canState && canState.ownerId) {
            const ownerPhysics = getPlayerPhysicsState(canState.ownerId);
            const ownerPresence = roomInstance.presence[canState.ownerId];
            // Only update if owner exists, has physics, and is NOT lost (cans drop on loss)
            if (ownerPhysics && ownerPresence && !ownerPresence.lost) {
                updatePaintCanPhysics(canState, ownerPhysics.position, deltaTime);
                // Add physics updates to the batch, merging with potential interaction updates
                allPaintCanUpdates[canId] = {
                    ...(allPaintCanUpdates[canId] || {}),
                    x: canState.x,
                    y: canState.y,
                    vx: canState.vx,
                    vy: canState.vy
                };
            }
        }
    });

    // --- Global Updates & Checks (Local Client Authority) ---
    let allDropletRemovals = {};
    let presenceRequests = [];
    let allPowerUpUpdates = {}; // Store power-up updates (both spawns and removals)
    let powerUpsToRemoveFromState = {}; // Store removals for room state update

    // Player-Player Collisions (Stealing)
    const stealCollisionResults = handlePlayerCollisions(localClientId, roomInstance);
    allPaintCanUpdates = { ...allPaintCanUpdates, ...stealCollisionResults.paintCanUpdates };
    localPresenceUpdates = { ...localPresenceUpdates, ...stealCollisionResults.localPresenceUpdates };
    presenceRequests = [...presenceRequests, ...stealCollisionResults.presenceRequests];
    // Update local presence cache immediately for steal results
    if (stealCollisionResults.localPresenceUpdates.currentCanId && roomInstance.presence[localClientId]) {
        Object.assign(roomInstance.presence[localClientId], stealCollisionResults.localPresenceUpdates);
    }

    // Spawn New Cans
    const newCanUpdates = spawnPaintCans(deltaTime, now, roomInstance.roomState.availablePaintCans || {}, canvas.width, canvas.height);
    allAvailablePaintCanUpdates = { ...allAvailablePaintCanUpdates, ...newCanUpdates };

    // Spawn New Power-ups
    const newPowerUpSpawns = spawnPowerUps(deltaTime, now, roomInstance.roomState.powerUps || {}, canvas.width, canvas.height);
    allPowerUpUpdates = { ...allPowerUpUpdates, ...newPowerUpSpawns };

    // --- Local Player Specific Updates (Post-Interaction, Pre-Collision) ---
    // Use presence potentially updated by interactions, respawn, or stealing
    const currentLocalPresence = roomInstance.presence[localClientId];
    const localPlayerPhysics = getPlayerPhysicsState(localClientId);

    // Process Expired Power-ups (Local Player)
    if (currentLocalPresence) {
        const expiredPowerUpUpdates = processActivePowerUps(localClientId, currentLocalPresence, now);
        // Merge presence updates from expired power-ups
        localPresenceUpdates = { ...localPresenceUpdates, ...expiredPowerUpUpdates };
        // Update local presence cache immediately after processing expired power-ups
        if (Object.keys(expiredPowerUpUpdates).length > 0) {
            Object.assign(roomInstance.presence[localClientId], expiredPowerUpUpdates);
        }
    }

    // Power-up Collision Check (Local Player) - Use presence potentially updated by expiration check
    const presenceAfterExpirationCheck = roomInstance.presence[localClientId];
    if (localPlayerPhysics && presenceAfterExpirationCheck && !presenceAfterExpirationCheck.lost) {
        const powerUpCollisionResults = checkPowerUpCollisions(
            localPlayerPhysics.position,
            localClientId,
            roomInstance.roomState.powerUps || {},
            presenceAfterExpirationCheck // Pass the most current presence state
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
    // Re-fetch physics and presence in case they changed due to respawn/powerups/expiration
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

    // Send room state updates if any occurred
    if (Object.keys(roomStateUpdates).length > 0) {
        roomInstance.updateRoomState(roomStateUpdates);
    }
    // Send local presence updates if any occurred
    if (Object.keys(localPresenceUpdates).length > 0) {
        roomInstance.updatePresence(localPresenceUpdates);
    }
    // Send presence update requests if any occurred
    presenceRequests.forEach(req => {
        roomInstance.requestPresenceUpdate(req.targetId, req.update);
    });

    // --- Render Scene ---
    renderLevel(ctx); // Render static level geometry first

    updateAndRenderEffects(ctx, deltaTime, now); // Render effects (often background elements)

    const dropletsToRender = roomInstance.roomState.droplets || {};
    renderDroplets(ctx, dropletsToRender, now);

    const availableCansToRender = roomInstance.roomState.availablePaintCans || {};
    Object.values(availableCansToRender).forEach(canState => {
        if (canState) renderPaintCan(ctx, canState);
    });

    // Render Active Power-ups
    const powerUpsToRender = roomInstance.roomState.powerUps || {};
    Object.values(powerUpsToRender).forEach(powerUpState => {
        if (powerUpState) renderPowerUp(ctx, powerUpState, now);
    });

    const ownedCansToRender = roomInstance.roomState.paintCans || {}; // Needed for rendering held cans
    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        if (presence) { // Ensure presence exists before rendering
            renderPlayer(ctx, clientId, localClientId, presence, peer, ownedCansToRender);
        }
    });

    // --- Render Notifications (On top of everything else) ---
    renderNotifications(ctx, now);

    // --- Update UI ---
    updatePaintLevelIndicator(localClientId, roomInstance.presence[localClientId], ownedCansToRender);

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
    lastTimestamp = 0;
    // Initialize previousPeerData with a copy of current peers
    previousPeerData = { ...(room.peers || {}) };
    clearEffects(); // Clear any lingering effects from previous runs
    requestAnimationFrame(gameLoop);
}