/**
 * game-loop.js
 * Manages the main rendering cycle of the game. Coordinates updates and rendering.
 */
import config from 'config';
import { renderPlayer, updatePlayerPhysics, getPlayerPhysicsState, removePlayerPhysicsState } from './player.js';
import { renderPaintCan, updatePaintCanPhysics } from './paintCan.js';
import { handleCanInteractions, handlePaintCanPickup, handleEmptyPaintCan } from './playerInteractions.js';
import { renderDroplets } from './dropletRenderer.js';
import { checkCollisionsWithPlayer } from './collisionHandler.js';
import { updateAndRenderEffects, addEffect, clearEffects } from './effectsRenderer.js'; // Import effects system

let roomInstance = null;
let lastTimestamp = 0; // For calculating delta time
let previousPeers = new Set(); // To track disconnected peers

// Basic rendering using canvas
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
            // Can ownership handled via presence subscription in main.js for simplicity now
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
    }

    // --- Update Physics & Interactions ---
    let allPaintCanUpdates = {}; // Collect updates for ALL owned cans this frame
    let allDropletsToAdd = {};   // Collect ALL new droplets this frame
    let allAvailablePaintCanUpdates = {}; // For can pickups
    let allDropletRemovals = {}; // Collect ALL droplets to remove (collisions + timeouts)

    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        if (presence) { // Only update if presence data exists
            // Update player physics
            updatePlayerPhysics(clientId, presence, deltaTime);

            // Don't process interactions/pickups/etc. if player is lost
            if (presence.lost) return;

            // Get updated player position for can physics/interactions
            const playerPhysicsState = getPlayerPhysicsState(clientId);
            if (!playerPhysicsState) return; // Skip if player physics state isn't ready
            const playerBodyPos = playerPhysicsState.position;

            // IMPORTANT: Check for empty cans (only owner checks)
            if (clientId === localClientId && presence.currentCanId) {
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
                }
            }

            // Check if this player owns a paint can
            const currentCanId = presence.currentCanId;
            if (currentCanId && roomInstance.roomState.paintCans && roomInstance.roomState.paintCans[currentCanId]) {
                const canState = roomInstance.roomState.paintCans[currentCanId];

                // Only the owner client calculates and sends updates for their can's physics and interactions
                if (clientId === localClientId) {
                    // 1. Update Paint Can Physics
                    updatePaintCanPhysics(canState, playerBodyPos, deltaTime);

                    // Add physics updates to the batch
                    allPaintCanUpdates[currentCanId] = {
                        ...(allPaintCanUpdates[currentCanId] || {}), // Keep potential interaction updates
                        x: canState.x,
                        y: canState.y,
                        vx: canState.vx,
                        vy: canState.vy
                    };

                    // 2. Handle Can Interactions (Charging, Auto-Drop)
                    const { paintCanUpdates, newDroplets } = handleCanInteractions(
                        localClientId,
                        canState, // Pass the potentially physics-updated state
                        deltaTime,
                        now
                    );

                    // Merge interaction updates and new droplets into the frame's batches
                    if (paintCanUpdates && Object.keys(paintCanUpdates).length > 0) {
                        // Merge updates for this specific can
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

            // NEW: Check for paint can pickup (only for local player without a can)
            if (clientId === localClientId && !presence.currentCanId) {
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
            }
        }
    });

    // --- Spawn new paint cans randomly (simple approach) ---
    if (Math.random() < (0.005 * deltaTime * 60)) { // ~0.5% chance per second (adjust rate based on frame time)
        const availableCans = roomInstance.roomState.availablePaintCans || {};
        // Only spawn if there are fewer than 3 available cans
        if (Object.keys(availableCans).filter(id => availableCans[id] !== null).length < 3) { // Check non-null cans
            const canId = `can-${Math.random().toString(36).substring(2, 9)}-${now}`; // Add timestamp for uniqueness
            const colorIndex = Math.floor(Math.random() * config.paintCanColors.length);

            // Position the can somewhere in the visible canvas area
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
            console.log(`Attempting to spawn can ${canId}`);
        }
    }

    // --- Check for Droplet Collisions with Local Player ---
    const localPlayerBodyPos = getPlayerPhysicsState(localClientId)?.position;
    if (localPlayerBodyPos && localPresence && !localPresence.lost) { // Don't check collisions if lost
        const { dropletsToRemove: collidedDroplets, collisionPoints } = checkCollisionsWithPlayer(
            localPlayerBodyPos,
            roomInstance.roomState.droplets || {},
            localClientId,
            localPresence, // Pass current presence
            now // Pass current time for loss/respawn calculation
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

    // --- Check for Expired Droplets (Authoritative Removal) ---
    const currentDroplets = roomInstance.roomState.droplets || {};
    const dropletDuration = config.dropletDuration || 2000;
    Object.entries(currentDroplets).forEach(([id, droplet]) => {
        // Skip if droplet is null or already marked for removal by collision
        if (!droplet || allDropletRemovals[id] === null) return;

        const age = now - droplet.createdAt;
        if (age > dropletDuration) {
            // Mark this droplet for removal due to timeout
            allDropletRemovals[id] = null;
        }
    });

    // --- Send Batched Updates ---
    if (Object.keys(allPaintCanUpdates).length > 0) {
        roomInstance.updateRoomState({ paintCans: allPaintCanUpdates });
    }
    if (Object.keys(allAvailablePaintCanUpdates).length > 0) {
        roomInstance.updateRoomState({ availablePaintCans: allAvailablePaintCanUpdates });
    }
    if (Object.keys(allDropletsToAdd).length > 0) {
        roomInstance.updateRoomState({ droplets: allDropletsToAdd });
    }
    if (Object.keys(allDropletRemovals).length > 0) {
        roomInstance.updateRoomState({ droplets: allDropletRemovals });
    }
    if (Object.keys(localPresenceUpdates).length > 0) {
        roomInstance.updatePresence(localPresenceUpdates);
    }

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
        renderPlayer(ctx, clientId, localClientId, presence, peer, paintCans);
    });

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
    lastTimestamp = 0; 
    previousPeers = new Set(Object.keys(room.peers)); 
    clearEffects(); 
    requestAnimationFrame(gameLoop); 
}