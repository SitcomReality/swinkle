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
    const now = Date.now(); // Keep using Date.now() for squirt age calculation
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
        }
    });
    previousPeers = currentPeerIds; // Update for next frame check


    // --- Update Player Physics ---
    // Iterate through all connected peers and update their physics simulation
    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        if (presence) { // Only update if presence data exists
            updatePlayerPhysics(clientId, presence, deltaTime);
        }
    });

    // --- Render Squirts ---
    const squirts = roomInstance.roomState.squirts || {};
    const squirtsToRemove = {}; // Track squirts to remove

    Object.entries(squirts).forEach(([id, squirt]) => {
        if (!squirt) return; // Skip if squirt data is null (already removed or invalid)

        const age = now - squirt.createdAt;

        if (age > (config.squirtDuration || 500)) {
            // Mark for removal if expired
            squirtsToRemove[id] = null;
        } else {
            // Draw the squirt particle (simple circle for now)
            ctx.beginPath();
            ctx.arc(squirt.x, squirt.y, config.squirtSize || 4, 0, Math.PI * 2);
            ctx.fillStyle = squirt.color || config.squirtColor || '#0FF';
            ctx.fill();
        }
    });

    // Request removal of expired squirts from roomState
    if (Object.keys(squirtsToRemove).length > 0) {
        roomInstance.updateRoomState({ squirts: squirtsToRemove });
    }

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