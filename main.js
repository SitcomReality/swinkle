import { loadDevNotes } from './dev-notes.js';
const room = new WebsimSocket();

// Initialize multiplayer connection and game state
async function initGame() {
    await room.initialize();
    
    // Track mouse movement for player presence
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('mousemove', (e) => {
        room.updatePresence({
            x: e.clientX,
            y: e.clientY,
            color: `hsl(${Math.random() * 360}, 70%, 50%)`
        });
    });

    // Setup presence subscription for other players
    room.subscribePresence((presence) => {
        // Presence updates handled in game loop
    });

    // Start rendering loop
    gameLoop();
}

// Basic rendering using canvas
function gameLoop() {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all player cursors
    Object.entries(room.presence).forEach(([clientId, presence]) => {
        if (!presence.x || !presence.y) return;
        ctx.beginPath();
        ctx.arc(presence.x, presence.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = presence.color || '#000';
        ctx.fill();
    });

    requestAnimationFrame(gameLoop);
}

// Initialize the app
loadDevNotes();
initGame().catch(console.error);