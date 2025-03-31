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
import { room } from './main.js';

let lastTimestamp = 0; // For calculating delta time
let previousPeers = new Set(); // To track disconnected peers

// Basic rendering using canvas
function gameLoop(timestamp) {
    if (!room) {
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
    const localClientId = room.clientId; // Get the local client's ID

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

    // --- Identify Disconnected Peers ---
    const currentPeerIds = new Set(Object.keys(room.peers));
    previousPeers.forEach(clientId => {
        if (!currentPeerIds.has(clientId)) {
            // Peer disconnected, remove their physics state
            removePlayerPhysicsState(clientId); // Calls the facade function
            // Can ownership handled via presence subscription in main.js for simplicity now
            console.log(`Peer ${clientId} disconnected, player physics removed.`);
        }
    });
    previousPeers = currentPeerIds; // Update for next frame check

    // --- Update Physics & Interactions ---
    let allPaintCanUpdates = {}; // Collect updates for ALL owned cans this frame
    let allDropletsToAdd = {};   // Collect ALL new droplets this frame
    let allAvailablePaintCanUpdates = {}; // For can pickups
    let localPresenceUpdates = {}; // For currentCanId changes
    let allDropletRemovals = {}; // Collect ALL droplets to remove (collisions + timeouts)


    Object.entries(room.peers).forEach(([clientId, peer]) => {
        const presence = room.presence[clientId];
        if (presence) { // Only update if presence data exists
            // Update player physics
            updatePlayerPhysics(clientId, presence, deltaTime);

            // Get updated player position for can physics/interactions
            const playerPhysicsState = getPlayerPhysicsState(clientId);
            if (!playerPhysicsState) return; // Skip if player physics state isn't ready
            const playerBodyPos = playerPhysicsState.position;

            // IMPORTANT: Check for empty cans (only owner checks)
            if (clientId === localClientId && presence.currentCanId) {
                const canState = room.roomState.paintCans?.[presence.currentCanId];
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
            if (currentCanId && room.roomState.paintCans && room.roomState.paintCans[currentCanId]) {
                const canState = room.roomState.paintCans[currentCanId];

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
                const availableCans = room.roomState.availablePaintCans || {};
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

    // NEW: Spawn new paint cans randomly (simple approach)
    if (localClientId && Math.random() < 0.005) { // ~0.5% chance per frame to spawn a can
        const availableCans = room.roomState.availablePaintCans || {};
        // Only spawn if there are fewer than 3 available cans
        if (Object.keys(availableCans).length < 3) {
            const canId = `can-${Math.random().toString(36).substring(2, 9)}`;
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
        }
    }

    // --- Check for Droplet Collisions with Local Player ---
    const localPlayerBodyPos = getPlayerPhysicsState(localClientId)?.position;
    if (localPlayerBodyPos) {
        const collidedDroplets = checkCollisionsWithPlayer(
            localPlayerBodyPos,
            room.roomState.droplets || {},
            localClientId,
            room.presence[localClientId]?.paintedData || {}
        );
        // Merge collision removals into the main removal batch
        if (Object.keys(collidedDroplets).length > 0) {
             allDropletRemovals = { ...allDropletRemovals, ...collidedDroplets };
        }
    }

    // --- Check for Expired Droplets (Authoritative Removal) ---
    const currentDroplets = room.roomState.droplets || {};
    const dropletDuration = config.dropletDuration || 2000;
    Object.entries(currentDroplets).forEach(([id, droplet]) => {
        // Skip if droplet is null or already marked for removal by collision
        if (!droplet || allDropletRemovals[id] === null) return;

        const age = now - droplet.createdAt;
        if (age > dropletDuration) {
            // Mark this droplet for removal due to timeout
            allDropletRemovals[id] = null;
            // console.log(`Droplet ${id} expired, marking for removal.`);
        }
    });

    // --- Send Batched Updates ---
    // Send batched updates for cans owned by this client
    if (Object.keys(allPaintCanUpdates).length > 0) {
        room.updateRoomState({ paintCans: allPaintCanUpdates });
    }
    // Send batched updates for available paint cans
    if (Object.keys(allAvailablePaintCanUpdates).length > 0) {
        room.updateRoomState({ availablePaintCans: allAvailablePaintCanUpdates });
    }
    // Send batched updates for new droplets created by this client
    if (Object.keys(allDropletsToAdd).length > 0) {
        room.updateRoomState({ droplets: allDropletsToAdd });
    }
    // Send batched updates for removed droplets (collisions + timeouts)
    if (Object.keys(allDropletRemovals).length > 0) {
        room.updateRoomState({ droplets: allDropletRemovals });
    }
    // Send any presence updates for the local client
    if (Object.keys(localPresenceUpdates).length > 0) {
        room.updatePresence(localPresenceUpdates);
    }

    // --- Render Scene ---
    // Render Droplets (using dedicated renderer)
    // Note: The renderer already visually fades/hides expired droplets client-side
    const dropletsToRender = room.roomState.droplets || {};
    renderDroplets(ctx, dropletsToRender, now);

    // Render Available Paint Cans
    const availablePaintCans = room.roomState.availablePaintCans || {};
    Object.values(availablePaintCans).forEach(canState => {
        if (canState) {
            renderPaintCan(ctx, canState);
        }
    });

    // Render Players (and their held cans + bungees via playerRenderer)
    const paintCans = room.roomState.paintCans || {}; // Needed by playerRenderer
    Object.entries(room.peers).forEach(([clientId, peer]) => {
        const presence = room.presence[clientId];
        // Pass paintCans state to renderPlayer so it can handle held can rendering
        renderPlayer(ctx, clientId, localClientId, presence, peer, paintCans);
    });

    // Request the next frame to continue the loop
    requestAnimationFrame(gameLoop);
}

/**
 * Initializes and starts the game loop.
 */
export function startGameLoop() {
    console.log("Starting game loop...");
    lastTimestamp = 0; // Reset timestamp when starting
    previousPeers = new Set(Object.keys(room.peers)); // Initialize peer tracking
    // timeSinceLastAutoDrop is now managed within playerInteractions.js
    requestAnimationFrame(gameLoop); // Kick off the first frame
}