import { loadDevNotes } from './dev-notes.js';
import { startGameLoop } from './game-loop.js';
import config from 'config';

const room = new WebsimSocket();

// Initialize multiplayer connection and game state
async function initGame() {
    await room.initialize();

    // Ensure initial room state for squirts exists if not already present
    if (!room.roomState.squirts) {
        room.updateRoomState({ squirts: {} });
    }

    // Track mouse movement for player presence (anchor point)
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    canvas.addEventListener('mousemove', (e) => {
        // Send anchor position and let the rendering decide the color/character state
        room.updatePresence({
            x: e.clientX,
            y: e.clientY,
            // Color is set initially and might be updated based on game events later
        });
    });

    // Handle clicks for squirting
    canvas.addEventListener('click', (e) => {
        const clientId = room.clientId;
        const uniqueSquirtId = `squirt-${clientId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        const newSquirt = {
            [uniqueSquirtId]: { 
                id: uniqueSquirtId,
                x: e.clientX,
                y: e.clientY,
                createdAt: Date.now(),
                ownerId: clientId,
                color: config.squirtColor || '#00FFFF' 
            }
        };

        // Update room state with the new squirt
        room.updateRoomState({ squirts: { ...room.roomState.squirts, ...newSquirt } });
    });

    // Initial presence update with a default color (or potentially assigned color later)
    // This ensures the player appears immediately
    room.updatePresence({
       x: window.innerWidth / 2, 
       y: window.innerHeight / 2,
       color: config.defaultPlayerColor || '#FFFFFF' 
       // Character-specific state (like physics) will be managed client-side initially
    });

    // Setup presence subscription for other players
    room.subscribePresence((presence) => {
        // Presence updates are now primarily handled within the game loop's rendering logic
        // This subscription remains useful for triggering specific events on presence change if needed later.
        // For example, we could play a sound when a player joins/leaves.
    });

    // Subscribe to room state changes (optional, for debugging or complex logic)
    room.subscribeRoomState((currentRoomState) => {
        // console.log("Room state updated:", currentRoomState);
    });

    // Start rendering loop, passing the room instance
    startGameLoop(room);
}

// Initialize the app
loadDevNotes();
initGame().catch(console.error); 