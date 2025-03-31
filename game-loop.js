/**
 * game-loop.js
 * Manages the main rendering cycle of the game.
 */
import config from 'config';
// Import player functions, including physics update and state retrieval
import { renderPlayer, updatePlayerPhysics, getPlayerPhysicsState, removePlayerPhysicsState } from './player.js';
// Import paint can functions
import { renderPaintCan, updatePaintCanPhysics } from './paintCan.js';

let roomInstance = null;
let lastTimestamp = 0; // For calculating delta time
let previousPeers = new Set(); // To track disconnected peers
const physicsUpdateBuffer = {}; // Buffer physics updates for cans

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
            // Can ownership handled via presence subscription in main.js for simplicity now
            console.log(`Peer ${clientId} disconnected, player physics removed.`);
        }
    });
    previousPeers = currentPeerIds; // Update for next frame check


    // --- Update Player and Paint Can Physics ---
    const paintCanUpdatesToSend = {}; // Collect can state updates owned by this client

    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        if (presence) { // Only update if presence data exists
            // Update player physics first
            updatePlayerPhysics(clientId, presence, deltaTime);

            // Get the updated player body position (needed for can physics)
            const playerPhysicsState = getPlayerPhysicsState(clientId);
            if (!playerPhysicsState) return; // Skip if player physics state isn't ready
            const playerBodyPos = playerPhysicsState.position;

            // Check if this player owns a paint can
            const currentCanId = presence.currentCanId;
            if (currentCanId && roomInstance.roomState.paintCans && roomInstance.roomState.paintCans[currentCanId]) {
                const canState = roomInstance.roomState.paintCans[currentCanId];

                // Only the owner client calculates and sends updates for their can's physics
                if (clientId === localClientId) {
                    // Update paint can physics based on player body position
                    updatePaintCanPhysics(canState, playerBodyPos, deltaTime);

                    // Store the physics updates to send
                    paintCanUpdatesToSend[currentCanId] = {
                        x: canState.x,
                        y: canState.y,
                        vx: canState.vx,
                        vy: canState.vy
                    };
                    // TODO Step 3: Add logic here to check for auto-dropping or charging based on canState.isCharging
                }
            }
            // TODO Step 5: Add collision check here between local player capsule and availablePaintCans
        }
    });

    // Send batched updates for cans owned by this client
    if (Object.keys(paintCanUpdatesToSend).length > 0) {
        roomInstance.updateRoomState({ paintCans: paintCanUpdatesToSend });
    }


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
    const paintCans = roomInstance.roomState.paintCans || {};
    const availablePaintCans = roomInstance.roomState.availablePaintCans || {};

    // Render available cans first (usually behind players)
    Object.values(availablePaintCans).forEach(canState => {
        if (canState) { // Check if can data exists
            renderPaintCan(ctx, canState);
        }
    });

    // Render players (limbs, body, name)
    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        renderPlayer(ctx, clientId, localClientId, presence, peer); // Renders player capsule & bungee

        // Render the HELD paint can AFTER the player, but potentially before other players
        // Also render the bungee connecting player to can
        const currentCanId = presence?.currentCanId;
        if (currentCanId && paintCans[currentCanId]) {
            const canState = paintCans[currentCanId];
            const playerState = getPlayerPhysicsState(clientId); // Get player body pos again

            if (playerState) {
                // Render can bungee cord
                ctx.beginPath();
                ctx.moveTo(playerState.position.x, playerState.position.y);
                ctx.lineTo(canState.x, canState.y);
                ctx.strokeStyle = config.paintCanBungeeColor || 'rgba(180, 180, 180, 0.6)';
                ctx.lineWidth = config.paintCanBungeeWidth || 1.5;
                ctx.stroke();

                // Render the can itself
                renderPaintCan(ctx, canState);
            }
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
    lastTimestamp = 0; // Reset timestamp when starting
    previousPeers = new Set(Object.keys(room.peers)); // Initialize peer tracking
    requestAnimationFrame(gameLoop); // Kick off the first frame
}