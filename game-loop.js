/**
 * game-loop.js
 * Manages the main rendering cycle of the game.
 */
import config from 'config';
// Import player functions, including the new updatePlayerPhysics
import { renderPlayer, updatePlayerPhysics, removePlayerPhysicsState } from './player.js';

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
            removePlayerPhysicsState(clientId);
            // TODO: Handle can ownership transfer/cleanup if a player disconnects while holding one
        }
    });
    previousPeers = currentPeerIds; // Update for next frame check


    // --- Update Player Physics ---
    // Iterate through all connected peers and update their physics simulation
    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        if (presence) { // Only update if presence data exists
            updatePlayerPhysics(clientId, presence, deltaTime);
            // TODO: If this client owns the can (presence.currentCanId && room.roomState.paintCans[presence.currentCanId].ownerId === clientId),
            // call updatePaintCanPhysics here and send roomState update.
        }
    });

    // --- Render Droplets ---
    const droplets = roomInstance.roomState.droplets || {};
    const dropletsToRemove = {}; // Track droplets to remove

    Object.entries(droplets).forEach(([id, droplet]) => {
        if (!droplet) return; // Skip if droplet data is null (already removed or invalid)

        const age = now - droplet.createdAt;

        // Use droplet config values
        if (age > (config.dropletDuration || 1000)) { // Use dropletDuration, default 1s
            // Mark for removal if expired
            dropletsToRemove[id] = null;
        } else {
            // Draw the droplet particle (simple circle for now)
            ctx.beginPath();
            ctx.arc(droplet.x, droplet.y, config.dropletSize || 3, 0, Math.PI * 2); // Use dropletSize, default 3
            ctx.fillStyle = droplet.color || config.dropletColor || '#0FF'; // Use dropletColor from state or config default
            ctx.fill();
        }
    });

    // Request removal of expired droplets from roomState
    // TODO: This removal logic might need refinement based on dev-notes (who removes: owner on timeout or hitter on collision?)
    if (Object.keys(dropletsToRemove).length > 0) {
        roomInstance.updateRoomState({ droplets: dropletsToRemove });
    }

    // --- Render Paint Cans (Held and Available) ---
    // TODO: Loop through room.roomState.paintCans and call renderPaintCan for held cans.
    // TODO: Loop through room.roomState.availablePaintCans and call renderPaintCan for available cans.

    // --- Render Players ---
    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        // Call the dedicated player rendering function, passing clientId AND localClientId
        renderPlayer(ctx, clientId, localClientId, presence, peer);
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
    requestAnimationFrame(gameLoop); // Kick off the first frame
}