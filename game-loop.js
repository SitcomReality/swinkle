/**
 * game-loop.js
 * Manages the main rendering cycle of the game.
 */
import config from 'config';

let roomInstance = null;

// Basic rendering using canvas
function gameLoop() {
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

    // Ensure canvas size matches display size for crisp rendering
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }

    // Clear the canvas for the new frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all players (cursors and names)
    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];

        // Only draw if position data exists
        if (presence && typeof presence.x === 'number' && typeof presence.y === 'number') {
            const x = presence.x;
            const y = presence.y;
            const color = presence.color || config.defaultPlayerColor || '#FFF'; // Use config or default white

            // Draw the player cursor (circle)
            ctx.beginPath();
            ctx.arc(x, y, config.cursorSize || 10, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            // Draw the player name
            ctx.fillStyle = config.nameColor || '#FFF'; // White text for names
            ctx.font = config.nameFont || '12px sans-serif';
            ctx.textAlign = 'center';
            // Position the name slightly below the cursor
            ctx.fillText(peer.username, x, y + (config.cursorSize || 10) + 14);
        }
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
    requestAnimationFrame(gameLoop); // Kick off the first frame
}