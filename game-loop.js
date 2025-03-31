/**
 * game-loop.js
 * Coordinates the main rendering cycle of the game, delegating to specialized subsystems.
 */
import config from 'config';
import { renderPlayer } from './playerRenderer.js';
import { updatePlayerPhysics } from './playerPhysics.js'; 
import { getPlayerPhysicsState } from './playerState.js';
import { renderPaintCan, updatePaintCanPhysics } from './paintCan.js';
import { handleCanInteractions, handlePaintCanPickup, handleEmptyPaintCan } from './playerInteractions.js';
import { renderDroplets } from './dropletRenderer.js';
import { checkCollisionsWithPlayer } from './collisionHandler.js';
import { updateAndRenderEffects, clearEffects, addEffect } from './effectsRenderer.js';
// Import from new modular systems
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
 * Basic rendering using canvas
 */
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
    const now = Date.now(); // Keep using Date.now() for droplet age calculation
    const localClientId = roomInstance.clientId; // Get the local client's ID

    // Calculate delta time for physics updates
    if (!lastTimestamp) lastTimestamp = timestamp;
    // Clamp deltaTime to avoid large jumps if the tab was inactive
    const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.1); // Delta time in seconds, max 100ms
    lastTimestamp = timestamp;

    // Ensure canvas size matches display size for crisp rendering
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }

    // Clear the canvas for the new frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Cleanup disconnected peers ---
    previousPeers = cleanupDisconnectedPeers(previousPeers, roomInstance.peers);

    // --- Check Local Player Respawn ---
    const localPresence = roomInstance.presence[localClientId];
    let localPresenceUpdates = checkPlayerRespawn(
        localClientId, 
        localPresence, 
        now, 
        canvas.width, 
        canvas.height
    );
    
    // Apply respawn updates immediately to avoid checking collisions etc. while still 'lost' this frame
    if (Object.keys(localPresenceUpdates).length > 0 && roomInstance.presence[localClientId]) {
        Object.assign(roomInstance.presence[localClientId], localPresenceUpdates);
    }

    // --- Update Physics & Interactions ---
    let allPaintCanUpdates = {}; // Collect updates for ALL owned cans this frame
    let allDropletsToAdd = {};   // Collect ALL new droplets this frame
    let allAvailablePaintCanUpdates = {}; // For can pickups
    let allDropletRemovals = {}; // Collect ALL droplets to remove (collisions + timeouts)
    let presenceRequests = []; // Store requests { targetId, update }

    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        if (presence) { // Only update if presence data exists
            // Update player physics BEFORE checking for interactions/collisions
            updatePlayerPhysics(clientId, presence, deltaTime);

            // Don't process interactions/pickups/stealing etc. if player is lost
            if (presence.lost) return;

            // Get updated player position for can physics/interactions
            const playerPhysicsState = getPlayerPhysicsState(clientId);
            if (!playerPhysicsState) return; // Skip if player physics state isn't ready
            const playerBodyPos = playerPhysicsState.position;

            // --- Handle Local Client Interactions ---
            if (clientId === localClientId) {
                // 1. Check for empty cans
                if (presence.currentCanId) {
                    const canState = roomInstance.roomState.paintCans?.[presence.currentCanId];
                    if (canState) {
                        const { paintCanUpdates, presenceUpdates } = handleEmptyPaintCan(
                            localClientId,
                            canState,
                            presence
                        );
                        // Merge updates
                        if (Object.keys(paintCanUpdates).length > 0) {
                            allPaintCanUpdates = { ...allPaintCanUpdates, ...paintCanUpdates };
                        }
                        if (Object.keys(presenceUpdates).length > 0) {
                            localPresenceUpdates = { ...localPresenceUpdates, ...presenceUpdates };
                        }
                        // If can was dropped due to being empty, update local presence cache for this frame
                        if (presenceUpdates.currentCanId === null) {
                            if (roomInstance.presence[localClientId]) roomInstance.presence[localClientId].currentCanId = null;
                        }
                    }
                }

                // 2. Check for paint can pickup (if not holding one)
                if (!presence.currentCanId) {
                    const availableCans = roomInstance.roomState.availablePaintCans || {};
                    const { paintCanUpdates, availablePaintCanUpdates, presenceUpdates } = handlePaintCanPickup(
                        playerBodyPos,
                        localClientId,
                        presence,
                        availableCans
                    );
                    // Merge updates
                    if (Object.keys(paintCanUpdates).length > 0) {
                        allPaintCanUpdates = { ...allPaintCanUpdates, ...paintCanUpdates };
                    }
                    if (Object.keys(availablePaintCanUpdates).length > 0) {
                        allAvailablePaintCanUpdates = { ...allAvailablePaintCanUpdates, ...availablePaintCanUpdates };
                    }
                    if (Object.keys(presenceUpdates).length > 0) {
                        localPresenceUpdates = { ...localPresenceUpdates, ...presenceUpdates };
                    }
                    // If can was picked up, update local presence cache for this frame
                    if (presenceUpdates.currentCanId) {
                        if (roomInstance.presence[localClientId]) roomInstance.presence[localClientId].currentCanId = presenceUpdates.currentCanId;
                    }
                }
            }

            // --- Update Held Paint Can Physics & Interactions (Owned Cans) ---
            const currentCanId = presence.currentCanId;
            if (currentCanId && roomInstance.roomState.paintCans && roomInstance.roomState.paintCans[currentCanId]) {
                const canState = roomInstance.roomState.paintCans[currentCanId];

                // Only the owner client calculates and sends updates for their can's physics and interactions
                if (clientId === localClientId) {
                    // Update Paint Can Physics
                    updatePaintCanPhysics(canState, playerBodyPos, deltaTime);

                    // Add physics updates to the batch
                    allPaintCanUpdates[currentCanId] = {
                        ...(allPaintCanUpdates[currentCanId] || {}), // Keep potential interaction updates
                        x: canState.x,
                        y: canState.y,
                        vx: canState.vx,
                        vy: canState.vy
                    };

                    // Handle Can Interactions (Charging, Auto-Drop)
                    const { paintCanUpdates, newDroplets } = handleCanInteractions(
                        localClientId,
                        canState, // Pass the potentially physics-updated state
                        deltaTime,
                        now
                    );

                    // Merge interaction updates and new droplets into the frame's batches
                    if (paintCanUpdates && Object.keys(paintCanUpdates).length > 0) {
                        allPaintCanUpdates[currentCanId] = {
                            ...allPaintCanUpdates[currentCanId], // Keep physics updates
                            ...paintCanUpdates // Add interaction updates (paintAmount, accumulated, etc.)
                        };
                    }
                    if (newDroplets && Object.keys(newDroplets).length > 0) {
                        allDropletsToAdd = { ...allDropletsToAdd, ...newDroplets };
                    }
                }
            }
        }
    });

    // --- Handle Player-Player Collisions (for Stealing) - Local Client Only ---
    const collisionResults = handlePlayerCollisions(localClientId, roomInstance);
    
    // Merge collision results
    Object.entries(collisionResults.paintCanUpdates).forEach(([canId, updates]) => {
        allPaintCanUpdates[canId] = {
            ...(allPaintCanUpdates[canId] || {}),
            ...updates
        };
    });
    
    localPresenceUpdates = {
        ...localPresenceUpdates,
        ...collisionResults.localPresenceUpdates
    };
    
    // Update local presence cache for collision effects
    if (collisionResults.localPresenceUpdates.currentCanId && roomInstance.presence[localClientId]) {
        roomInstance.presence[localClientId].currentCanId = collisionResults.localPresenceUpdates.currentCanId;
    }
    
    presenceRequests = [...presenceRequests, ...collisionResults.presenceRequests];

    // --- Spawn new paint cans randomly ---
    const newCanUpdates = spawnPaintCans(
        deltaTime, 
        now, 
        roomInstance.roomState.availablePaintCans || {}, 
        canvas.width, 
        canvas.height
    );
    
    if (Object.keys(newCanUpdates).length > 0) {
        allAvailablePaintCanUpdates = {
            ...allAvailablePaintCanUpdates,
            ...newCanUpdates
        };
    }

    // --- Check for Droplet Collisions with Local Player ---
    const localPlayerPhysics = getPlayerPhysicsState(localClientId);
    const localPresenceForCollision = roomInstance.presence[localClientId]; // Use potentially updated presence
    
    if (localPlayerPhysics && localPresenceForCollision && !localPresenceForCollision.lost) {
        const { dropletsToRemove: collidedDroplets, collisionPoints } = checkCollisionsWithPlayer(
            localPlayerPhysics.position, // Use position from physics state
            roomInstance.roomState.droplets || {},
            localClientId,
            localPresenceForCollision, // Pass current presence state for this frame
            now
        );
        // Merge collision removals into the main removal batch
        if (Object.keys(collidedDroplets).length > 0) {
            allDropletRemovals = { ...allDropletRemovals, ...collidedDroplets };
        }
        // Add splat effects for each collision point
        collisionPoints.forEach(point => {
            addEffect('splat', { x: point.x, y: point.y, color: point.color });
        });
    }

    // --- Check for Expired Droplets ---
    const expiredDroplets = checkExpiredDroplets(roomInstance.roomState.droplets || {}, now);
    if (Object.keys(expiredDroplets).length > 0) {
        allDropletRemovals = { ...allDropletRemovals, ...expiredDroplets };
    }

    // --- Send Batched Updates ---
    // Room State Updates
    const roomStateUpdates = {};
    if (Object.keys(allPaintCanUpdates).length > 0) roomStateUpdates.paintCans = allPaintCanUpdates;
    if (Object.keys(allAvailablePaintCanUpdates).length > 0) roomStateUpdates.availablePaintCans = allAvailablePaintCanUpdates;
    if (Object.keys(allDropletsToAdd).length > 0) roomStateUpdates.droplets = allDropletsToAdd;
    if (Object.keys(allDropletRemovals).length > 0) {
        // Merge droplet removals with additions if both exist
        roomStateUpdates.droplets = { ...(roomStateUpdates.droplets || {}), ...allDropletRemovals };
    }
    if (Object.keys(roomStateUpdates).length > 0) {
        roomInstance.updateRoomState(roomStateUpdates);
    }

    // Local Presence Updates (includes respawn, pickup, empty can drop, steal success)
    if (Object.keys(localPresenceUpdates).length > 0) {
        roomInstance.updatePresence(localPresenceUpdates);
    }

    // Presence Update Requests (steal requests)
    presenceRequests.forEach(req => {
        roomInstance.requestPresenceUpdate(req.targetId, req.update);
    });

    // --- Render Scene ---
    updateAndRenderEffects(ctx, deltaTime, now);

    const dropletsToRender = roomInstance.roomState.droplets || {};
    renderDroplets(ctx, dropletsToRender, now);

    const availablePaintCans = roomInstance.roomState.availablePaintCans || {};
    Object.values(availablePaintCans).forEach(canState => {
        if (canState) {
            renderPaintCan(ctx, canState);
        }
    });

    const paintCans = roomInstance.roomState.paintCans || {};
    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        // Pass the paintCans state directly, renderPlayer will find the specific can if needed
        renderPlayer(ctx, clientId, localClientId, presence, peer, paintCans);
    });

    // --- Update UI Elements ---
    updatePaintLevelIndicator(localClientId, roomInstance.presence[localClientId], roomInstance.roomState.paintCans || {});

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

    // Initialize UI elements
    initializeUI();

    lastTimestamp = 0;
    // Initialize previousPeers with current peers when loop starts
    previousPeers = new Set(Object.keys(room.peers || {}));
    clearEffects();
    requestAnimationFrame(gameLoop);
}