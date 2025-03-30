/**
 * game-loop.js
 * Manages the main rendering cycle of the game.
 */

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

    // Draw all player cursors based on the latest presence data
    Object.entries(roomInstance.presence).forEach(([clientId, presence]) => {
        // Only draw if position data exists
        if (presence && typeof presence.x === 'number' && typeof presence.y === 'number') {
            ctx.beginPath();
            // Draw a simple circle for each player cursor
            ctx.arc(presence.x, presence.y, 10, 0, Math.PI * 2);
            // Use the color from presence, default to black if not set
            ctx.fillStyle = presence.color || '#000';
            ctx.fill();
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