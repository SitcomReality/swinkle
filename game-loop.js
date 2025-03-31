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
import { cleanupDisconnectedPeers } from './peer-manager.js';

let roomInstance = null;
let lastTimestamp = 0; // For calculating delta time
let previousPeers = new Set(); // To track disconnected peers

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
        if (canState.ownerId === clientId && isLocalPlayer) {
            updatePaintCanPhysics(canState, playerBodyPos, deltaTime);
            // Add physics updates to the batch, merging with potential interaction updates
            updates.paintCanUpdates[currentCanId] = {
                ...(updates.paintCanUpdates[currentCanId] || {}),
                x: canState.x,
                y: canState.y,
                vx: canState.vx,
                vy: canState.vy
            };
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
    const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- State Updates & Cleanup ---
    previousPeers = cleanupDisconnectedPeers(previousPeers, roomInstance.peers);
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

    // Player-Player Collisions (Stealing)
    const collisionResults = handlePlayerCollisions(localClientId, roomInstance);
    allPaintCanUpdates = { ...allPaintCanUpdates, ...collisionResults.paintCanUpdates };
    localPresenceUpdates = { ...localPresenceUpdates, ...collisionResults.localPresenceUpdates };
    presenceRequests = [...presenceRequests, ...collisionResults.presenceRequests];
     // Update local presence cache immediately for steal results
    if (collisionResults.localPresenceUpdates.currentCanId && roomInstance.presence[localClientId]) {
        Object.assign(roomInstance.presence[localClientId], collisionResults.localPresenceUpdates);
    }

    // Spawn New Cans
    const newCanUpdates = spawnPaintCans(deltaTime, now, roomInstance.roomState.availablePaintCans || {}, canvas.width, canvas.height);
    allAvailablePaintCanUpdates = { ...allAvailablePaintCanUpdates, ...newCanUpdates };

    // Droplet Collision with Local Player
    const localPlayerPhysics = getPlayerPhysicsState(localClientId);
    const currentLocalPresence = roomInstance.presence[localClientId]; // Use potentially updated presence
    if (localPlayerPhysics && currentLocalPresence && !currentLocalPresence.lost) {
        const { dropletsToRemove: collidedDroplets, collisionPoints } = checkCollisionsWithPlayer(
            localPlayerPhysics.position,
            roomInstance.roomState.droplets || {},
            localClientId,
            currentLocalPresence,
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
    if (Object.keys(roomStateUpdates).length > 0) {
        roomInstance.updateRoomState(roomStateUpdates);
    }

    if (Object.keys(localPresenceUpdates).length > 0) {
        roomInstance.updatePresence(localPresenceUpdates);
    }

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

    const ownedCansToRender = roomInstance.roomState.paintCans || {}; // Needed for rendering held cans
    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        if (presence) { // Ensure presence exists before rendering
             renderPlayer(ctx, clientId, localClientId, presence, peer, ownedCansToRender);
        }
    });

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
    previousPeers = new Set(Object.keys(room.peers || {}));
    clearEffects(); // Clear any lingering effects from previous runs
    requestAnimationFrame(gameLoop);
}