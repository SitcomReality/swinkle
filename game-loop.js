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
import { initializeUI, updatePaintLevelIndicator, updateScoreboardStyle } from './ui-manager.js';
import { cleanupAndNotifyPeers } from './peer-manager.js';
import { addNotification, updateNotifications } from './notification-manager.js';
import { checkPowerUpCollisions, processActivePowerUps, checkExpiredPowerUpItems } from './power-ups/power-up-manager.js';
import { handleHostTasks } from './host-logic.js';
import { addEffect, clearEffects } from './effectsRenderer.js';
import { updateLevelTransition } from './level-transition.js';
import { getLastSignificantMoveTime } from './local-state.js';
import { enterSpectateMode } from './spectate-mode.js';
import { cleanupStaleCollisionStates } from './player-collision-state.js';

let roomInstance = null;
let lastTimestamp = 0; 
let previousPeerData = {}; 

function handleTimingAndSetup(timestamp, canvas, ctx) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.1); 
    lastTimestamp = timestamp;
    if (canvas.width !== config.gameAreaWidth || canvas.height !== config.gameAreaHeight) {
        canvas.width = config.gameAreaWidth;
        canvas.height = config.gameAreaHeight;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    return deltaTime;
}

function handleLocalPlayerChecks(now, localClientId) {
    let localPresenceUpdates = {};
    const localPresenceBeforeUpdate = { ...(roomInstance.presence[localClientId] || {}) };

    const respawnUpdates = checkPlayerRespawn(
        localClientId,
        localPresenceBeforeUpdate,
        now,
        config.gameAreaWidth,
        config.gameAreaHeight
    );
    localPresenceUpdates = { ...localPresenceUpdates, ...respawnUpdates };
    let presenceAfterRespawn = localPresenceBeforeUpdate;
    if (Object.keys(respawnUpdates).length > 0) {
        presenceAfterRespawn = { ...presenceAfterRespawn, ...respawnUpdates };
    }

    if (presenceAfterRespawn && !presenceAfterRespawn.isSpectating && !presenceAfterRespawn.lost) {
        const lastMoveTime = getLastSignificantMoveTime();
        if (now - lastMoveTime > config.idleThreshold) {
            console.log(`Player ${localClientId} detected as idle, entering spectate mode.`);
            enterSpectateMode(localClientId, roomInstance); 
            presenceAfterRespawn = { ...(roomInstance.presence[localClientId] || presenceAfterRespawn) };
        }
    }

    const expiredPowerUpUpdates = processActivePowerUps(localClientId, presenceAfterRespawn, now);
    localPresenceUpdates = { ...localPresenceUpdates, ...expiredPowerUpUpdates };
    let presenceAfterPowerups = presenceAfterRespawn;
    if (Object.keys(expiredPowerUpUpdates).length > 0) {
        presenceAfterPowerups = { ...presenceAfterPowerups, ...expiredPowerUpUpdates };
    }

    if (presenceAfterPowerups.respawnAnimEndTime && now >= presenceAfterPowerups.respawnAnimEndTime) {
        localPresenceUpdates.respawnAnimEndTime = null; 
        console.log(`Respawn animation finished for ${localClientId}`);
        presenceAfterPowerups = { ...presenceAfterPowerups, respawnAnimEndTime: null };
    }

    if (Object.keys(localPresenceUpdates).length > 0 && roomInstance.presence[localClientId]) {
        Object.assign(roomInstance.presence[localClientId], localPresenceUpdates);
    }

    return localPresenceUpdates;
}

function handlePlayerUpdates(deltaTime, now, localClientId, accumulatedLocalPresenceUpdates) {
    let allPaintCanUpdates = {};
    let allDropletsToAdd = {};
    let allAvailablePaintCanUpdates = {};
    let finalLocalPresenceUpdates = { ...accumulatedLocalPresenceUpdates }; 

    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        if (presence) {
            updatePlayerPhysics(clientId, presence, deltaTime);
            const playerPhysicsState = getPlayerPhysicsState(clientId); 

            if (presence.lost || presence.isSpectating || !playerPhysicsState) return;

            const playerBodyPos = playerPhysicsState.position;
            let currentPresence = { ...presence }; 

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

                if (Object.keys(interactionResults.presenceUpdates).length > 0) {
                    currentPresence = { ...currentPresence, ...interactionResults.presenceUpdates };
                    Object.assign(roomInstance.presence[clientId], interactionResults.presenceUpdates);
                }
            }

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
                    allPaintCanUpdates[currentCanId] = null; 
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

function handleGlobalUpdates(deltaTime, now, localClientId) {
    const hostTaskResults = handleHostTasks(
        roomInstance, deltaTime, now,
        config.gameAreaWidth, config.gameAreaHeight
    );

    let stealCollisionResults = { paintCanUpdates: {}, localPresenceUpdates: {}, presenceRequests: [] };
    const currentLocalPresenceForSteal = roomInstance.presence[localClientId];
    if (currentLocalPresenceForSteal && !currentLocalPresenceForSteal.isSpectating && !currentLocalPresenceForSteal.lost) {
        stealCollisionResults = handlePlayerCollisions(localClientId, roomInstance);
        if (stealCollisionResults.localPresenceUpdates.currentCanId !== undefined && roomInstance.presence[localClientId]) {
            Object.assign(roomInstance.presence[localClientId], stealCollisionResults.localPresenceUpdates);
        }
    }

    return { hostTasks: hostTaskResults, stealCollisions: stealCollisionResults };
}

function handleLocalCollisionsAndCleanup(now, localClientId) {
    let powerUpCollisionResults = { powerUpsToRemove: {}, presenceUpdates: {} };
    let dropletCollisionResults = { dropletsToRemove: {}, collisionPoints: [], newDroplets: {} }; 
    let expiredDroplets = {};
    let expiredPowerUpItems = {}; 

    const finalLocalPresence = roomInstance.presence[localClientId];
    const finalLocalPlayerPhysics = getPlayerPhysicsState(localClientId);
    if (finalLocalPlayerPhysics && finalLocalPresence && !finalLocalPresence.lost && !finalLocalPresence.isSpectating) {
        powerUpCollisionResults = checkPowerUpCollisions(
            finalLocalPlayerPhysics.position,
            localClientId,
            roomInstance.roomState.powerUps || {},
            finalLocalPresence
        );
        if (Object.keys(powerUpCollisionResults.presenceUpdates).length > 0) {
            Object.assign(roomInstance.presence[localClientId], powerUpCollisionResults.presenceUpdates);
        }
    }

    const presenceForDropletCheck = roomInstance.presence[localClientId];
    const physicsForDropletCheck = getPlayerPhysicsState(localClientId);
    if (physicsForDropletCheck && presenceForDropletCheck && !presenceForDropletCheck.isSpectating) { 
        const { dropletsToRemove: collidedDroplets, collisionPoints, newDroplets: burstDroplets } = checkCollisionsWithPlayer(
            physicsForDropletCheck.position,
            roomInstance.roomState.droplets || {},
            localClientId,
            presenceForDropletCheck, 
            now
        );
        dropletCollisionResults.dropletsToRemove = collidedDroplets;
        dropletCollisionResults.newDroplets = burstDroplets; 
        collisionPoints.forEach(point => addEffect('splat', { x: point.x, y: point.y, color: point.color }));
    }

    expiredDroplets = checkExpiredDroplets(roomInstance.roomState.droplets || {}, now);

    expiredPowerUpItems = checkExpiredPowerUpItems(roomInstance.roomState.powerUps || {}, now);

    return {
        powerUpCollisions: powerUpCollisionResults,
        dropletCollisions: dropletCollisionResults,
        expiredDroplets: expiredDroplets,
        expiredPowerUpItems: expiredPowerUpItems 
    };
}

function sendBatchedUpdates(updates) {
    const {
        paintCanUpdates, availablePaintCanUpdates, dropletsToAdd,
        localPresenceUpdates, presenceRequests, dropletRemovals,
        powerUpUpdates, powerUpsToRemoveFromState, levelUpdates,
        burstDropletsToAdd 
    } = updates;

    const roomStateUpdates = {};
    if (Object.keys(paintCanUpdates).length > 0) roomStateUpdates.paintCans = paintCanUpdates;
    if (Object.keys(availablePaintCanUpdates).length > 0) roomStateUpdates.availablePaintCans = availablePaintCanUpdates;
    const allDropletUpdates = { ...dropletsToAdd, ...burstDropletsToAdd, ...dropletRemovals };
    if (Object.keys(allDropletUpdates).length > 0) {
        roomStateUpdates.droplets = allDropletUpdates;
    }
    const finalPowerUpUpdates = { ...powerUpUpdates, ...powerUpsToRemoveFromState };
    if (Object.keys(finalPowerUpUpdates).length > 0) {
        const validUpdates = Object.entries(finalPowerUpUpdates).reduce((acc, [key, value]) => {
            if (value !== undefined) { 
                acc[key] = value;
            }
            return acc;
        }, {});
        if (Object.keys(validUpdates).length > 0) {
             roomStateUpdates.powerUps = validUpdates;
        }
    }
    if (Object.keys(levelUpdates).length > 0) {
        Object.assign(roomStateUpdates, levelUpdates);
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
}

function gameLoop(timestamp) {
    if (!roomInstance) return; 
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const now = Date.now();
    const localClientId = roomInstance.clientId;

    const deltaTime = handleTimingAndSetup(timestamp, canvas, ctx);

    updateLevelTransition(deltaTime, now);

    updateNotifications(now); 
    previousPeerData = cleanupAndNotifyPeers(previousPeerData, roomInstance.peers, addNotification);

    const initialLocalPresenceUpdates = handleLocalPlayerChecks(now, localClientId);

    const playerUpdateResults = handlePlayerUpdates(deltaTime, now, localClientId, initialLocalPresenceUpdates);

    const globalUpdateResults = handleGlobalUpdates(deltaTime, now, localClientId);

    const collisionCleanupResults = handleLocalCollisionsAndCleanup(now, localClientId);

    cleanupStaleCollisionStates(now); 

    const batchedUpdates = {
        paintCanUpdates: { ...playerUpdateResults.paintCanUpdates, ...globalUpdateResults.stealCollisions.paintCanUpdates },
        availablePaintCanUpdates: { ...playerUpdateResults.availablePaintCanUpdates, ...globalUpdateResults.hostTasks.availablePaintCanUpdates },
        dropletsToAdd: { ...playerUpdateResults.dropletsToAdd },
        dropletRemovals: { ...collisionCleanupResults.dropletCollisions.dropletsToRemove, ...collisionCleanupResults.expiredDroplets },
        localPresenceUpdates: { ...playerUpdateResults.localPresenceUpdates, ...globalUpdateResults.stealCollisions.localPresenceUpdates, ...collisionCleanupResults.powerUpCollisions.presenceUpdates },
        presenceRequests: [...globalUpdateResults.stealCollisions.presenceRequests],
        powerUpUpdates: { ...globalUpdateResults.hostTasks.powerUpUpdates },
        powerUpsToRemoveFromState: {
            ...collisionCleanupResults.powerUpCollisions.powerUpsToRemove,
            ...collisionCleanupResults.expiredPowerUpItems 
        },
        levelUpdates: { ...globalUpdateResults.hostTasks.levelUpdates },
        burstDropletsToAdd: { ...collisionCleanupResults.dropletCollisions.newDroplets } 
    };

    sendBatchedUpdates(batchedUpdates);

    renderScene(ctx, roomInstance, localClientId, now, deltaTime); 

    const finalLocalPresenceForUI = roomInstance.presence[localClientId];
    const ownedCansForUI = roomInstance.roomState.paintCans || {};
    updatePaintLevelIndicator(localClientId, finalLocalPresenceForUI, ownedCansForUI);
    updateScoreboardStyle(finalLocalPresenceForUI?.isSpectating ?? false);

    requestAnimationFrame(gameLoop);
}

export function startGameLoop(room) {
    if (!room) throw new Error("startGameLoop requires a valid room instance.");
    roomInstance = room;
    console.log("Starting game loop...");

    initializeUI(); 
    initializeRenderer(); 
    lastTimestamp = 0;
    previousPeerData = { ...(room.peers || {}) }; 
    clearEffects(); 
    requestAnimationFrame(gameLoop);
}