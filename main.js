import { loadDevNotes } from './dev-notes.js';
import { startGameLoop } from './game-loop.js';
import config from 'config'; 

const room = new WebsimSocket();

// Initialize multiplayer connection and game state
async function initGame() {
    await room.initialize();

    // Track mouse movement for player presence
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    canvas.addEventListener('mousemove', (e) => {
        // Send position and let the rendering decide the color
        room.updatePresence({
            x: e.clientX,
            y: e.clientY,
        });
    });

    // Initial presence update with a default color (or potentially assigned color later)
    // This ensures the player appears immediately
    room.updatePresence({
       x: window.innerWidth / 2, // Start position
       y: window.innerHeight / 2,
       color: config.defaultPlayerColor || '#FFFFFF' // Use default from config
    });

    // Setup presence subscription for other players
    room.subscribePresence((presence) => {
        // Presence updates are now primarily handled within the game loop's rendering logic
        // This subscription remains useful for triggering specific events on presence change if needed later.
        // For example, we could play a sound when a player joins/leaves.
    });

    // Start rendering loop, passing the room instance
    startGameLoop(room);
}

// Initialize the app
loadDevNotes();
initGame().catch(console.error); // Start the game initialization and catch potential errors