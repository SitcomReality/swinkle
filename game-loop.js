/**
 * game-loop.js
 * Manages the main rendering cycle of the game.
 */
import config from 'config';
import { renderPlayer, updatePlayerPhysics } from './player.js'; // Import player functions

let roomInstance = null;
let lastTimestamp = 0; // For calculating delta time

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

    // Calculate delta time for physics updates
    if (!lastTimestamp) lastTimestamp = timestamp;
    const deltaTime = (timestamp - lastTimestamp) / 1000; // Delta time in seconds
    lastTimestamp = timestamp;

    // Ensure canvas size matches display size for crisp rendering
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }

    // Clear the canvas for the new frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Update Physics (Placeholder) ---
    // Eventually, this might loop through physics objects, including players
    // updatePlayerPhysics(deltaTime); // Call physics update (currently empty)

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
        // Call the dedicated player rendering function
        renderPlayer(ctx, presence, peer);
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
    requestAnimationFrame(gameLoop); // Kick off the first frame
}