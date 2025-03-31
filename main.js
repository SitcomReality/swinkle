import { loadDevNotes } from './dev-notes.js';
import { startGameLoop } from './game-loop.js';
import config from 'config';
// Import player functions to ensure physics state is managed
import { removePlayerPhysicsState } from './player.js';

const room = new WebsimSocket();

// Initialize multiplayer connection and game state
async function initGame() {
    await room.initialize();

    // Ensure initial room state exists if not already present
    // Use a single updateRoomState call for efficiency
    const initialRoomStateUpdates = {};
    if (room.roomState.droplets === undefined) { // Check for undefined specifically
        initialRoomStateUpdates.droplets = {};
    }
    if (room.roomState.paintCans === undefined) {
        initialRoomStateUpdates.paintCans = {};
        // TEMPORARY: Add a test can for initial development
        const testCanId = `test-can-${Math.random().toString(36).substring(2, 9)}`;
        initialRoomStateUpdates.paintCans[testCanId] = {
            id: testCanId,
            ownerId: null, // Initially unowned
            paintColor: config.paintCanColors[0] || '#FF00FF',
            paintAmount: config.paintCanInitialAmount,
            x: window.innerWidth / 2 + 50, y: window.innerHeight / 2 + 50, // Start somewhere visible
            vx: 0, vy: 0,
            isCharging: false,
            accumulatedDroplets: 0
        };
    }
    if (room.roomState.availablePaintCans === undefined) {
        initialRoomStateUpdates.availablePaintCans = {};
        // TEMPORARY: Move the test can here if needed for testing pickup later
        // For now, leave it in paintCans to test rendering/physics immediately if picked up manually
    }
    if (Object.keys(initialRoomStateUpdates).length > 0) {
        console.log("Initializing room state:", initialRoomStateUpdates);
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
        // Step 3: Droplet Generation from Can will replace this.
        // Temporarily disable default droplet creation on click
        console.log("Canvas click - Droplet creation temporarily disabled.");
    });

    // Handle mouse down/up for paint charging (Step 3)
    canvas.addEventListener('mousedown', (e) => {
        // TODO: Implement Step 3: Start charging if holding a can
        console.log("Mouse down - Charging logic needed");
    });
    canvas.addEventListener('mouseup', (e) => {
        // TODO: Implement Step 3: Stop charging and release burst if holding a can
        console.log("Mouse up - Burst logic needed");
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
        // Example: Detect when a peer disconnects to handle can ownership transfer
        const currentPeers = new Set(Object.keys(room.peers));
        const localClientId = room.clientId;

        // Check for players who left
        Object.keys(room.presence).forEach(clientId => {
            if (!currentPeers.has(clientId)) {
                // Peer disconnected
                removePlayerPhysicsState(clientId); // Clean up player physics

                // Check if the disconnected player owned any cans
                const paintCans = room.roomState.paintCans || {};
                const cansToUpdate = {};
                for (const [canId, canState] of Object.entries(paintCans)) {
                    if (canState && canState.ownerId === clientId) {
                        console.log(`Player ${clientId} disconnected, releasing can ${canId}`);
                        // Option 1: Make can available again (simple)
                        // We need to move it from paintCans to availablePaintCans
                        // Setting ownerId to null and adding to availablePaintCans
                        // Requires careful state management, maybe a dedicated function later.
                        // For now, just mark as unowned. Pickup logic (Step 5) will handle finding it.
                        cansToUpdate[canId] = { ...canState, ownerId: null };

                        // If this client was the owner, they should update the state
                        // However, any client can detect the disconnect. Let's make the "first" client do it?
                        // Simplification: Assume the client running this code can update the state.
                        // This might lead to race conditions, needs refinement later.
                        room.updateRoomState({
                            paintCans: { [canId]: { ownerId: null } } // Just remove owner for now
                            // TODO Step 5: Move to availablePaintCans properly
                        });
                    }
                }
            }
        });
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