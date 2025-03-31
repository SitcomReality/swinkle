import { loadDevNotes } from './dev-notes.js';
import { startGameLoop } from './game-loop.js';
import config from 'config';

const room = new WebsimSocket();

// Initialize multiplayer connection and game state
async function initGame() {
    await room.initialize();

    // Ensure initial room state exists if not already present
    // Use a single updateRoomState call for efficiency
    const initialRoomStateUpdates = {};
    if (!room.roomState.droplets) {
        initialRoomStateUpdates.droplets = {};
    }
    if (!room.roomState.paintCans) {
        initialRoomStateUpdates.paintCans = {};
    }
    if (!room.roomState.availablePaintCans) {
        initialRoomStateUpdates.availablePaintCans = {};
    }
    if (Object.keys(initialRoomStateUpdates).length > 0) {
        room.updateRoomState(initialRoomStateUpdates);
    }


    // Track mouse movement for player presence (anchor point)
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    canvas.addEventListener('mousemove', (e) => {
        // Send anchor position and let the rendering decide the color/character state
        // Painted data and can ID are updated separately based on game events
        room.updatePresence({
            x: e.clientX,
            y: e.clientY,
        });
    });

    // Handle clicks for squirting (now droplets)
    canvas.addEventListener('click', (e) => {
        // TODO: This click logic needs to be updated based on the new design (paint can interaction, charging)
        // For now, keep basic droplet creation on click, using default droplet color
        // This will be refactored in Step 3 (Droplet Generation from Can)

        const clientId = room.clientId;
        const uniqueDropletId = `droplet-${clientId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        // Use droplet config values
        const newDroplet = {
            [uniqueDropletId]: {
                id: uniqueDropletId,
                x: e.clientX, // Should ideally come from paint can position later
                y: e.clientY, // Should ideally come from paint can position later
                createdAt: Date.now(),
                ownerId: clientId,
                color: config.dropletColor || '#00FFFF' // Use default droplet color for now
            }
        };

        // Update room state with the new droplet
        // Make sure roomState.droplets exists before spreading
        const currentDroplets = room.roomState.droplets || {};
        room.updateRoomState({ droplets: { ...currentDroplets, ...newDroplet } });
    });

    // Initial presence update with a default color and new state fields
    // This ensures the player appears immediately with all required presence data
    room.updatePresence({
       x: window.innerWidth / 2,
       y: window.innerHeight / 2,
       color: config.defaultPlayerColor || '#FFFFFF', // Base player color
       paintedData: {}, // Initialize empty painted data
       currentCanId: null // Initialize with no paint can
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