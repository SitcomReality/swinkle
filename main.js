import { loadDevNotes } from './dev-notes.js';
import { startGameLoop } from './game-loop.js';

const room = new WebsimSocket();

// Initialize multiplayer connection and game state
async function initGame() {
    await room.initialize();

    // Track mouse movement for player presence
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('mousemove', (e) => {
        // Simple presence update: position and a random color
        room.updatePresence({
            x: e.clientX,
            y: e.clientY,
            // Generate a random HSL color for each movement for visual flair
            color: `hsl(${Math.random() * 360}, 70%, 60%)`
        });
    });

    // Setup presence subscription for other players
    room.subscribePresence((presence) => {
        // Presence updates are now primarily handled within the game loop's rendering logic
        // This subscription remains useful for triggering specific events on presence change if needed later.
    });

    // Start rendering loop, passing the room instance
    startGameLoop(room);
}

// Initialize the app
loadDevNotes();
initGame().catch(console.error); // Start the game initialization and catch potential errors