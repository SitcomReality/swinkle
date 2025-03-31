/**
 * game-loop.js
 * Manages the main rendering cycle of the game. Coordinates updates and rendering.
 */
import config from 'config';
// Import player functions directly for clarity (facade pattern might obscure origins)
import { renderPlayer } from './playerRenderer.js';
import { updatePlayerPhysics, getPlayerPhysicsState, removePlayerPhysicsState } from './playerState.js'; // Get state/physics functions directly
import { renderPaintCan, updatePaintCanPhysics } from './paintCan.js';
import { handleCanInteractions, handlePaintCanPickup, handleEmptyPaintCan } from './playerInteractions.js';
import { renderDroplets } from './dropletRenderer.js';
import { checkCollisionsWithPlayer } from './collisionHandler.js';
import { updateAndRenderEffects, addEffect, clearEffects } from './effectsRenderer.js'; // Import effects system

let roomInstance = null;
let lastTimestamp = 0; // For calculating delta time
let previousPeers = new Set(); // To track disconnected peers

// UI Element References
let paintIndicatorElement;
let paintIndicatorFillElement;
let paintIndicatorTextElement;

/**
 * Updates the paint level indicator UI element.
 */
function updatePaintLevelIndicator() {
    if (!paintIndicatorElement) return; // Elements not ready

    const localClientId = roomInstance.clientId;
    const presence = roomInstance.presence[localClientId];
    const paintCans = roomInstance.roomState.paintCans || {};

    if (presence && !presence.lost && presence.currentCanId && paintCans[presence.currentCanId]) {
        const canState = paintCans[presence.currentCanId];
        const maxAmount = config.paintCanInitialAmount;
        const currentAmount = canState.paintAmount || 0;
        const fillRatio = Math.max(0, Math.min(1, currentAmount / maxAmount));
        const percentage = (fillRatio * 100).toFixed(0);

        paintIndicatorFillElement.style.width = `${fillRatio * 100}%`;
        paintIndicatorFillElement.style.backgroundColor = canState.paintColor || config.dropletColor; // Match can color
        paintIndicatorTextElement.textContent = `${percentage}%`;
        paintIndicatorElement.style.display = 'block'; // Show the indicator
    } else {
        paintIndicatorElement.style.display = 'none'; // Hide if no can or lost
    }
}

/**
 * Simple Axis-Aligned Bounding Box collision check.
 * @param {object} rectA - { left, right, top, bottom }
 * @param {object} rectB - { left, right, top, bottom }
 * @returns {boolean} True if colliding, false otherwise.
 */
function checkRectCollision(rectA, rectB) {
    if (!rectA || !rectB) return false;
    return (
        rectA.left < rectB.right &&
        rectA.right > rectB.left &&
        rectA.top < rectB.bottom &&
        rectA.bottom > rectB.top
    );
}

/**
 * Creates a bounding box for a player based on their physics state.
 * @param {object} physicsState - The player's physics state.
 * @returns {object|null} Bounding box { left, right, top, bottom } or null.
 */
function getPlayerBoundingBox(physicsState) {
    if (!physicsState) return null;
    const bodyWidth = config.playerBodyWidth;
    const bodyHeight = config.playerBodyHeight;
    return {
        left: physicsState.position.x - bodyWidth / 2,
        right: physicsState.position.x + bodyWidth / 2,
        top: physicsState.position.y - bodyHeight / 2,
        bottom: physicsState.position.y + bodyHeight / 2
    };
}

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
        // Optionally clear effects if canvas resizes drastically
        // clearEffects();
    }

    // Clear the canvas for the new frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Identify Disconnected Peers ---
    const currentPeerIds = new Set(Object.keys(roomInstance.peers));
    previousPeers.forEach(clientId => {
        if (!currentPeerIds.has(clientId)) {
            // Peer disconnected, remove their physics state
            removePlayerPhysicsState(clientId); // Calls the facade function
            // Can ownership handled via presence subscription in main.js
            console.log(`Peer ${clientId} disconnected, player physics removed.`);
        }
    });
    previousPeers = currentPeerIds; // Update for next frame check

    // --- Check Local Player Respawn ---
    const localPresence = roomInstance.presence[localClientId];
    let localPresenceUpdates = {}; // Collect presence updates for local player this frame
    if (localPresence?.lost && localPresence.respawnTime && now >= localPresence.respawnTime) {
        console.log(`Respawning player ${localClientId}`);
        const spawnX = canvas.width / 2;
        const spawnY = canvas.height / 2;
        localPresenceUpdates = {
            lost: false,
            paintedData: {},
            respawnTime: null,
            currentCanId: null, // Ensure no can on respawn
            x: spawnX, // Reset anchor position
            y: spawnY
        };
        // Note: Physics state will naturally adjust due to anchor change
        // Apply respawn updates immediately to avoid checking collisions etc. while still 'lost' this frame
        if (roomInstance.presence[localClientId]) {
             // Merge updates into the actual presence object for checks later in the frame
             Object.assign(roomInstance.presence[localClientId], localPresenceUpdates);
        }
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
    const localPlayerPhysics = getPlayerPhysicsState(localClientId);
    const localPlayerBox = getPlayerBoundingBox(localPlayerPhysics);
    const localPresenceForCollision = roomInstance.presence[localClientId]; // Use potentially updated presence

    // Only check if local player exists, has a hitbox, is not lost, and doesn't currently have a can
    if (localPlayerBox && localPresenceForCollision && !localPresenceForCollision.lost && !localPresenceForCollision.currentCanId) {
        Object.entries(roomInstance.peers).forEach(([otherClientId, otherPeer]) => {
            // Skip self, skip if other player doesn't exist or is lost
            if (otherClientId === localClientId) return;
            const otherPresence = roomInstance.presence[otherClientId];
            if (!otherPresence || otherPresence.lost) return;

            // Check if the other player HAS a can
            const canIdToSteal = otherPresence.currentCanId;
            if (canIdToSteal && roomInstance.roomState.paintCans?.[canIdToSteal]) {
                const otherPlayerPhysics = getPlayerPhysicsState(otherClientId);
                const otherPlayerBox = getPlayerBoundingBox(otherPlayerPhysics);

                // Check collision between local player body and other player body
                if (checkRectCollision(localPlayerBox, otherPlayerBox)) {
                    console.log(`Player ${localClientId} collided with ${otherClientId} who has can ${canIdToSteal}. Attempting steal!`);

                    // Prevent stealing the same can multiple times in quick succession if updates lag
                    // Check if we already updated presence this frame to take this can
                    if (localPresenceUpdates.currentCanId === canIdToSteal) return;

                    // 1. Update local presence to hold the can
                    localPresenceUpdates.currentCanId = canIdToSteal;
                    // Update local presence cache immediately for subsequent checks this frame
                     if (roomInstance.presence[localClientId]) roomInstance.presence[localClientId].currentCanId = canIdToSteal;


                    // 2. Request the other player drops the can
                    presenceRequests.push({ targetId: otherClientId, update: { type: 'dropCan' } });

                    // 3. Update the can's ownership in roomState
                    allPaintCanUpdates[canIdToSteal] = {
                         ...(allPaintCanUpdates[canIdToSteal] || {}), // Keep potential physics updates if any
                         ownerId: localClientId,
                         // Reset physics/charge state upon steal? Optional, but might prevent weirdness.
                         vx: 0,
                         vy: 0,
                         isCharging: false,
                         accumulatedDroplets: 0
                    };

                    // Optional: Add a visual/audio cue for the steal
                    addEffect('stealSpark', { x: localPlayerPhysics.position.x, y: localPlayerPhysics.position.y });

                    // Stop checking other players once a steal is successful this frame
                    // (though the logic prevents stealing multiple anyway)
                    return; // Exit inner loop early might be slightly cleaner
                }
            }
        });
    }

    // --- Spawn new paint cans randomly ---
    if (Math.random() < (0.005 * deltaTime * 60)) { // ~0.5% chance per second
        const availableCans = roomInstance.roomState.availablePaintCans || {};
        if (Object.keys(availableCans).filter(id => availableCans[id] !== null).length < config.maxAvailableCans) { // Use config
            const canId = `can-${Math.random().toString(36).substring(2, 9)}-${now}`;
            const colorIndex = Math.floor(Math.random() * config.paintCanColors.length);
            const margin = 100;
            const x = margin + Math.random() * (canvas.width - margin * 2);
            const y = margin + Math.random() * (canvas.height - margin * 2);

            allAvailablePaintCanUpdates[canId] = {
                id: canId,
                ownerId: null,
                paintColor: config.paintCanColors[colorIndex],
                paintAmount: config.paintCanInitialAmount,
                x: x,
                y: y
            };
            // console.log(`Attempting to spawn can ${canId}`);
        }
    }

    // --- Check for Droplet Collisions with Local Player ---
    // Use the physics state directly, presence already checked for 'lost' status earlier
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

    // --- Check for Expired Droplets (Authoritative Removal by any client) ---
    // TODO: Refine this - potentially only one client (e.g., host/leader) should do this.
    // For now, any client can trigger removal, which might cause redundant updates but is okay.
    const currentDroplets = roomInstance.roomState.droplets || {};
    const dropletDuration = config.dropletDuration || 2000;
    Object.entries(currentDroplets).forEach(([id, droplet]) => {
        // Skip if droplet is null or already marked for removal
        if (!droplet || allDropletRemovals[id] === null) return;

        const age = now - droplet.createdAt;
        if (age > dropletDuration) {
            allDropletRemovals[id] = null;
        }
    });

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
    updatePaintLevelIndicator(); // Call the UI update function

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
    // Initialize previousPeers with current peers when loop starts
    previousPeers = new Set(Object.keys(room.peers || {}));
    clearEffects();
    requestAnimationFrame(gameLoop);
}