/**
 * game-loop.js
 * This file orchestrates the game's update and render cycle.
 * It calls functions from various specialized modules to handle specific tasks.
 */
import config from 'config';
import { renderScene, initializeRenderer } from './renderer.js';
import { updatePlayerPhysics } from './playerPhysics.js';
import { updatePaintCanPhysics } from './paintCan.js';
import { getPlayerPhysicsState } from './playerState.js';
import { handleLocalPlayerInteractions } from './playerInteractions.js';
import { checkCollisionsWithPlayer } from './collisionHandler.js';
import { handlePlayerCollisions } from './collision-system.js';
import { checkExpiredDroplets } from './droplet-manager.js';
import { checkPlayerRespawn } from './respawn-manager.js';
import { initializeUI, updatePaintLevelIndicator } from './ui-manager.js';
import { cleanupAndNotifyPeers } from './peer-manager.js';
import { addNotification, updateNotifications } from './notification-manager.js';
import { checkPowerUpCollisions, processActivePowerUps } from './power-ups/power-up-manager.js';
import { handleHostTasks } from './host-logic.js';
import { addEffect, clearEffects } from './effectsRenderer.js';
import { updateLevelTransition } from './level-transition.js';
import { getLastSignificantMoveTime } from './main.js';
import { enterSpectateMode } from './spectate-mode.js';

let roomInstance = null;
let lastTimestamp = 0; // For calculating delta time
let previousPeerData = {}; // Use object to store peer data { id: { username, ... } }

// --- Helper Functions ---

/**
 * Handles timing calculations and initial canvas setup.
 * @param {number} timestamp - Current high-resolution timestamp.
 * @param {HTMLCanvasElement} canvas - The game canvas element.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @returns {number} deltaTime in seconds.
 */
function handleTimingAndSetup(timestamp, canvas, ctx) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.1); // Limit max delta time
    lastTimestamp = timestamp;
    if (canvas.width !== config.gameAreaWidth || canvas.height !== config.gameAreaHeight) {
        canvas.width = config.gameAreaWidth;
        canvas.height = config.gameAreaHeight;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear before rendering
    return deltaTime;
}

/**
 * Updates local player state checks like respawn, idle timer, and expired power-ups.
 * @param {number} now - Current timestamp (Date.now()).
 * @param {string} localClientId - The ID of the local client.
 * @returns {object} Accumulated presence updates for the local player.
 */
function handleLocalPlayerChecks(now, localClientId) {
    let localPresenceUpdates = {};
    const localPresenceBeforeUpdate = { ...(roomInstance.presence[localClientId] || {}) };

    // --- Respawn Check ---
    const respawnUpdates = checkPlayerRespawn(
        localClientId,
        localPresenceBeforeUpdate,
        now,
        config.gameAreaWidth,
        config.gameAreaHeight
    );
    localPresenceUpdates = { ...localPresenceUpdates, ...respawnUpdates };
    // Apply respawn updates immediately to local cache
    if (Object.keys(respawnUpdates).length > 0 && roomInstance.presence[localClientId]) {
        Object.assign(roomInstance.presence[localClientId], respawnUpdates);
    }

    // --- Idle Timer Check ---
    const localPresenceForIdleCheck = roomInstance.presence[localClientId] || localPresenceBeforeUpdate;
    if (localPresenceForIdleCheck && !localPresenceForIdleCheck.isSpectating && !localPresenceForIdleCheck.lost) {
        const lastMoveTime = getLastSignificantMoveTime();
        if (now - lastMoveTime > config.idleThreshold) {
            console.log(`Player ${localClientId} detected as idle, entering spectate mode.`);
            enterSpectateMode(localClientId, roomInstance); // Handles its own presence update
        }
    }

    // --- Process Expired Power-ups ---
    const presenceAfterIdleCheck = roomInstance.presence[localClientId] || localPresenceBeforeUpdate;
    const expiredPowerUpUpdates = processActivePowerUps(localClientId, presenceAfterIdleCheck, now);
    localPresenceUpdates = { ...localPresenceUpdates, ...expiredPowerUpUpdates };
    // Update local presence cache immediately
    if (Object.keys(expiredPowerUpUpdates).length > 0 && roomInstance.presence[localClientId]) {
        Object.assign(roomInstance.presence[localClientId], expiredPowerUpUpdates);
    }

    return localPresenceUpdates;
}

/**
 * Updates physics and interactions for all players and their held cans.
 * @param {number} deltaTime - Time elapsed since the last frame in seconds.
 * @param {number} now - Current timestamp.
 * @param {string} localClientId - The ID of the local client.
 * @param {object} accumulatedLocalPresenceUpdates - Presence updates from local checks (respawn, idle, etc.).
 * @returns {object} Aggregated updates: { paintCanUpdates, dropletsToAdd, localPresenceUpdates, availablePaintCanUpdates }
 */
function handlePlayerUpdates(deltaTime, now, localClientId, accumulatedLocalPresenceUpdates) {
    let allPaintCanUpdates = {};
    let allDropletsToAdd = {};
    let allAvailablePaintCanUpdates = {};
    let finalLocalPresenceUpdates = { ...accumulatedLocalPresenceUpdates }; // Start with updates from local checks

    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        if (presence) {
            // Updates player physics (body, limbs)
            updatePlayerPhysics(clientId, presence, deltaTime);
            const playerPhysicsState = getPlayerPhysicsState(clientId); // Get state *after* update

            // Skip interactions/can physics if lost or spectating
            if (presence.lost || presence.isSpectating || !playerPhysicsState) return;

            const playerBodyPos = playerPhysicsState.position;
            let currentPresence = { ...presence }; // Use a copy for this iteration

            // --- Local Player Interactions ---
            if (clientId === localClientId) {
                const interactionResults = handleLocalPlayerInteractions(
                    clientId,
                    currentPresence,
                    playerBodyPos,
                    roomInstance.roomState.paintCans || {},
                    roomInstance.roomState.availablePaintCans || {},
                    deltaTime,
                    now
                );
                allPaintCanUpdates = { ...allPaintCanUpdates, ...interactionResults.paintCanUpdates };
                allDropletsToAdd = { ...allDropletsToAdd, ...interactionResults.newDroplets };
                finalLocalPresenceUpdates = { ...finalLocalPresenceUpdates, ...interactionResults.presenceUpdates };
                allAvailablePaintCanUpdates = { ...allAvailablePaintCanUpdates, ...interactionResults.availablePaintCanUpdates };

                // Update local presence cache immediately for consistency
                if (Object.keys(interactionResults.presenceUpdates).length > 0) {
                    currentPresence = { ...currentPresence, ...interactionResults.presenceUpdates };
                    Object.assign(roomInstance.presence[clientId], interactionResults.presenceUpdates);
                }
            }

            // --- Update Held Paint Can Physics (Owner Only) ---
            const currentCanId = currentPresence.currentCanId;
            if (clientId === localClientId && currentCanId) {
                const baseCanState = roomInstance.roomState.paintCans?.[currentCanId];
                const interactionCanUpdate = allPaintCanUpdates[currentCanId];
                let canStateForPhysics = baseCanState ? { ...baseCanState, ...interactionCanUpdate } : null;

                if (canStateForPhysics && canStateForPhysics.ownerId === clientId) {
                    updatePaintCanPhysics(canStateForPhysics, playerBodyPos, deltaTime);
                    allPaintCanUpdates[currentCanId] = {
                        ...(allPaintCanUpdates[currentCanId] || {}),
                        x: canStateForPhysics.x, y: canStateForPhysics.y,
                        vx: canStateForPhysics.vx, vy: canStateForPhysics.vy
                    };
                } else if (baseCanState === null || interactionCanUpdate === null) {
                    allPaintCanUpdates[currentCanId] = null; // Ensure null update is sent
                }
            }
        }
    });

    return {
        paintCanUpdates: allPaintCanUpdates,
        dropletsToAdd: allDropletsToAdd,
        localPresenceUpdates: finalLocalPresenceUpdates,
        availablePaintCanUpdates: allAvailablePaintCanUpdates,
    };
}

/**
 * Handles global updates like host tasks and player-player collisions.
 * @param {number} deltaTime - Time elapsed since the last frame in seconds.
 * @param {number} now - Current timestamp.
 * @param {string} localClientId - The ID of the local client.
 * @returns {object} Aggregated updates: { hostTasks, stealCollisions }
 */
function handleGlobalUpdates(deltaTime, now, localClientId) {
    const hostTaskResults = handleHostTasks(
        roomInstance, deltaTime, now,
        config.gameAreaWidth, config.gameAreaHeight
    );

    let stealCollisionResults = { paintCanUpdates: {}, localPresenceUpdates: {}, presenceRequests: [] };
    const currentLocalPresenceForSteal = roomInstance.presence[localClientId];
    if (currentLocalPresenceForSteal && !currentLocalPresenceForSteal.isSpectating && !currentLocalPresenceForSteal.lost) {
        stealCollisionResults = handlePlayerCollisions(localClientId, roomInstance);
        // Update local presence cache immediately for steal results
        if (stealCollisionResults.localPresenceUpdates.currentCanId !== undefined && roomInstance.presence[localClientId]) {
            Object.assign(roomInstance.presence[localClientId], stealCollisionResults.localPresenceUpdates);
        }
    }

    return { hostTasks: hostTaskResults, stealCollisions: stealCollisionResults };
}


/**
 * Handles local player collisions (with power-ups, droplets) and droplet cleanup.
 * @param {number} now - Current timestamp.
 * @param {string} localClientId - The ID of the local client.
 * @returns {object} Aggregated updates: { powerUpCollisions, dropletCollisions, expiredDroplets }
 */
function handleLocalCollisionsAndCleanup(now, localClientId) {
    let powerUpCollisionResults = { powerUpsToRemove: {}, presenceUpdates: {} };
    let dropletCollisionResults = { dropletsToRemove: {}, collisionPoints: [] };
    let expiredDroplets = {};

    // --- Power-up Collision Check ---
    const finalLocalPresence = roomInstance.presence[localClientId];
    const finalLocalPlayerPhysics = getPlayerPhysicsState(localClientId);
    if (finalLocalPlayerPhysics && finalLocalPresence && !finalLocalPresence.lost && !finalLocalPresence.isSpectating) {
        powerUpCollisionResults = checkPowerUpCollisions(
            finalLocalPlayerPhysics.position,
            localClientId,
            roomInstance.roomState.powerUps || {},
            finalLocalPresence
        );
        // Update local presence cache immediately
        if (Object.keys(powerUpCollisionResults.presenceUpdates).length > 0) {
            Object.assign(roomInstance.presence[localClientId], powerUpCollisionResults.presenceUpdates);
        }
    }

    // --- Droplet Collision with Local Player ---
    // Re-fetch state in case it changed due to power-up collection
    const presenceForDropletCheck = roomInstance.presence[localClientId];
    const physicsForDropletCheck = getPlayerPhysicsState(localClientId);
    if (physicsForDropletCheck && presenceForDropletCheck && !presenceForDropletCheck.lost && !presenceForDropletCheck.isSpectating) {
        const { dropletsToRemove: collidedDroplets, collisionPoints } = checkCollisionsWithPlayer(
            physicsForDropletCheck.position,
            roomInstance.roomState.droplets || {},
            localClientId,
            presenceForDropletCheck, // checkCollisionsWithPlayer updates presence directly via room.updatePresence
            now
        );
        dropletCollisionResults.dropletsToRemove = collidedDroplets;
        collisionPoints.forEach(point => addEffect('splat', { x: point.x, y: point.y, color: point.color }));
    }

    // --- Expired Droplets Check ---
    expiredDroplets = checkExpiredDroplets(roomInstance.roomState.droplets || {}, now);

    return {
        powerUpCollisions: powerUpCollisionResults,
        dropletCollisions: dropletCollisionResults,
        expiredDroplets: expiredDroplets
    };
}

/**
 * Sends batched updates to the room state and presence.
 * @param {object} updates - An object containing all aggregated updates from the frame.
 */
function sendBatchedUpdates(updates) {
    const {
        paintCanUpdates, availablePaintCanUpdates, dropletsToAdd,
        localPresenceUpdates, presenceRequests, dropletRemovals,
        powerUpUpdates, powerUpsToRemoveFromState, levelUpdates
    } = updates;

    const roomStateUpdates = {};
    if (Object.keys(paintCanUpdates).length > 0) roomStateUpdates.paintCans = paintCanUpdates;
    if (Object.keys(availablePaintCanUpdates).length > 0) roomStateUpdates.availablePaintCans = availablePaintCanUpdates;
    if (Object.keys(dropletsToAdd).length > 0) roomStateUpdates.droplets = dropletsToAdd;
    if (Object.keys(dropletRemovals).length > 0) {
        roomStateUpdates.droplets = { ...(roomStateUpdates.droplets || {}), ...dropletRemovals };
    }
    const finalPowerUpUpdates = { ...powerUpUpdates, ...powerUpsToRemoveFromState };
    if (Object.keys(finalPowerUpUpdates).length > 0) {
        roomStateUpdates.powerUps = finalPowerUpUpdates;
    }
    if (Object.keys(levelUpdates).length > 0) {
        Object.assign(roomStateUpdates, levelUpdates);
    }

    // Send room state updates
    if (Object.keys(roomStateUpdates).length > 0) {
        roomInstance.updateRoomState(roomStateUpdates);
    }
    // Send local presence updates
    if (Object.keys(localPresenceUpdates).length > 0) {
        roomInstance.updatePresence(localPresenceUpdates);
    }
    // Send presence update requests
    presenceRequests.forEach(req => {
        roomInstance.requestPresenceUpdate(req.targetId, req.update);
    });
}


// --- Main Game Loop ---

/**
 * Main game loop function. Orchestrates updates and rendering.
 */
function gameLoop(timestamp) {
    if (!roomInstance) return; // Stop the loop if room is not set
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const now = Date.now();
    const localClientId = roomInstance.clientId;

    // 1. Timing and Setup
    const deltaTime = handleTimingAndSetup(timestamp, canvas, ctx);

    // 2. Update Level Transition (Handles background color, etc.)
    updateLevelTransition(deltaTime, now);

    // 3. Update Notifications & Peer Management
    updateNotifications(now);
    previousPeerData = cleanupAndNotifyPeers(previousPeerData, roomInstance.peers, addNotification);

    // 4. Local Player State Checks (Respawn, Idle, Expired Power-ups)
    const initialLocalPresenceUpdates = handleLocalPlayerChecks(now, localClientId);

    // 5. Per-Player Updates (Physics, Interactions, Can Physics)
    const playerUpdateResults = handlePlayerUpdates(deltaTime, now, localClientId, initialLocalPresenceUpdates);

    // 6. Global Updates (Host Tasks, Player-Player Collisions)
    const globalUpdateResults = handleGlobalUpdates(deltaTime, now, localClientId);

    // 7. Local Player Collisions & Cleanup (Power-ups, Droplets)
    const collisionCleanupResults = handleLocalCollisionsAndCleanup(now, localClientId);

    // 8. Aggregate all updates for batch sending
    const batchedUpdates = {
        paintCanUpdates: { ...playerUpdateResults.paintCanUpdates, ...globalUpdateResults.stealCollisions.paintCanUpdates },
        availablePaintCanUpdates: { ...playerUpdateResults.availablePaintCanUpdates, ...globalUpdateResults.hostTasks.availablePaintCanUpdates },
        dropletsToAdd: { ...playerUpdateResults.dropletsToAdd },
        dropletRemovals: { ...collisionCleanupResults.dropletCollisions.dropletsToRemove, ...collisionCleanupResults.expiredDroplets },
        localPresenceUpdates: { ...playerUpdateResults.localPresenceUpdates, ...globalUpdateResults.stealCollisions.localPresenceUpdates, ...collisionCleanupResults.powerUpCollisions.presenceUpdates },
        presenceRequests: [...globalUpdateResults.stealCollisions.presenceRequests],
        powerUpUpdates: { ...globalUpdateResults.hostTasks.powerUpUpdates },
        powerUpsToRemoveFromState: { ...collisionCleanupResults.powerUpCollisions.powerUpsToRemove },
        levelUpdates: { ...globalUpdateResults.hostTasks.levelUpdates }
    };

    // 9. Send Batched Updates
    sendBatchedUpdates(batchedUpdates);

    // 10. Render Scene
    renderScene(ctx, roomInstance, localClientId, now, deltaTime);

    // 11. Update UI
    const finalLocalPresenceForUI = roomInstance.presence[localClientId];
    const ownedCansForUI = roomInstance.roomState.paintCans || {};
    updatePaintLevelIndicator(localClientId, finalLocalPresenceForUI, ownedCansForUI);

    // 12. Request Next Frame
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
    previousPeerData = { ...(room.peers || {}) }; // Initialize with current peers
    clearEffects(); // Clear any lingering effects
    requestAnimationFrame(gameLoop);
}