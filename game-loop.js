/**
 * game-loop.js
 * Manages the main rendering cycle of the game. Coordinates updates and rendering.
 */
import config from 'config';
import { renderPlayer, updatePlayerPhysics, getPlayerPhysicsState, removePlayerPhysicsState } from './player.js';
import { renderPaintCan, updatePaintCanPhysics } from './paintCan.js';
import { handleCanInteractions } from './playerInteractions.js'; // New import
import { renderDroplets } from './dropletRenderer.js'; // New import

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

    // --- Update Physics & Interactions ---
    let allPaintCanUpdates = {}; // Collect updates for ALL owned cans this frame
    let allDropletsToAdd = {};   // Collect ALL new droplets this frame

    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        if (presence) { // Only update if presence data exists
            // Update player physics
            updatePlayerPhysics(clientId, presence, deltaTime);

            // Get updated player position for can physics/interactions
            const playerPhysicsState = getPlayerPhysicsState(clientId);
            if (!playerPhysicsState) return; // Skip if player physics state isn't ready
            const playerBodyPos = playerPhysicsState.position;

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
            // TODO Step 5: Add collision check here between local player capsule and availablePaintCans
        }
    });

    // Send batched updates for cans owned by this client
    if (Object.keys(allPaintCanUpdates).length > 0) {
        // console.log("Sending can updates:", allPaintCanUpdates);
        roomInstance.updateRoomState({ paintCans: allPaintCanUpdates });
    }
    // Send batched updates for new droplets created by this client
    if (Object.keys(allDropletsToAdd).length > 0) {
        // console.log("Sending new droplets:", allDropletsToAdd);
        roomInstance.updateRoomState({ droplets: allDropletsToAdd });
    }

    // --- Render Scene ---

    // Render Droplets (using dedicated renderer)
    const droplets = roomInstance.roomState.droplets || {};
    renderDroplets(ctx, droplets, now); // Call the dedicated droplet renderer

    // Render Available Paint Cans
    const availablePaintCans = roomInstance.roomState.availablePaintCans || {};
    Object.values(availablePaintCans).forEach(canState => {
        if (canState) {
            renderPaintCan(ctx, canState);
        }
    });

    // Render Players (and their held cans + bungees via playerRenderer)
    const paintCans = roomInstance.roomState.paintCans || {}; // Needed by playerRenderer
    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        // Pass paintCans state to renderPlayer so it can handle held can rendering
        renderPlayer(ctx, clientId, localClientId, presence, peer, paintCans);
    });

    // Request the next frame to continue the loop
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
    roomInstance = room; // Store the room instance for use in the loop
    console.log("Starting game loop...");
    lastTimestamp = 0; // Reset timestamp when starting
    previousPeers = new Set(Object.keys(room.peers)); // Initialize peer tracking
    // timeSinceLastAutoDrop is now managed within playerInteractions.js
    requestAnimationFrame(gameLoop); // Kick off the first frame
}