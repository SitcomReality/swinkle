export const notes = `
## Developer Notes - Multiplayer Painter

**Design Goals & Considerations:**
- **Core Gameplay:** Players swing around on bungee cords attached to their cursor. They acquire and carry a separate 'paint can' object, also attached via bungee to their player capsule. This can is used to automatically drop paint droplets or release bursts of paint. Players try to paint each other by maneuvering so their opponents collide with their paint droplets. Collision with another player's droplet adds that color to the victim's capsule outline. Reaching 100% painted is a loss condition. Players must manage the paint in their can and find ways to replenish it by acquiring new cans.
- **Theme:** 'xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism' (Dark background, neon highlights). Apply this to characters, paint cans, paint droplets, UI elements.
- **Character Design:** Player capsule with big expressive eyes, dangling from a bungee cord attached to the cursor. Physics-based limbs enhance the dangle effect. A paint can dangles from the player capsule via another bungee cord.
- **Modularity:** Keep logic separated (physics, rendering, game loop, networking, interactions).
- **Performance & Networking:** Prioritize perceived smoothness. Trust clients for collision detection and state reporting. Use client-side prediction/rendering where possible (droplet expiration, maybe can physics). Rely on 'roomState' for authoritative positions of cans and droplets, and 'presence' for player anchor/painted state.
- **Developer Notes:** Update this file outlining planned steps and key questions. Focus on small, testable increments. Remember to escape all backticks in these notes.

**Refactoring Note (Post Step 4):**
*   Refactored 'game-loop.js' to delegate more responsibilities.
*   Created 'playerInteractions.js' to handle paint can charging/auto-dropping logic initiated by the local player.
*   Created 'dropletRenderer.js' to handle rendering of all droplets.
*   Moved held paint can rendering and its bungee cord logic into 'playerRenderer.js'.
*   'game-loop.js' now focuses on the core loop timing, canvas setup, peer disconnect checks, calling physics updates, calling interaction handling, batching state updates, and calling render functions for different scene elements.
*   Further refactoring split player.js into playerState.js, playerPhysics.js, and playerRenderer.js with player.js now acting as a facade.

**Painting Gameplay Plan (Incremental Steps - COMPLETED):**

**1. State Management Setup:** (DONE)
    *   **Player Presence (updatePresence):** 'x', 'y', 'color', 'paintedData', 'currentCanId', 'lost'.
    *   **Room State (updateRoomState):** 'droplets', 'paintCans', 'availablePaintCans'.
    *   **Config (config.js):** Added relevant constants.

**2. Paint Can Physics & Rendering:** (DONE)
    *   Created 'paintCan.js' ('updatePaintCanPhysics', 'renderPaintCan').
    *   'game-loop.js' calls physics update for local player's can.
    *   'playerRenderer.js' calls 'renderPaintCan' for held cans.
    *   'game-loop.js' calls 'renderPaintCan' for available cans.

**3. Droplet Generation from Can:** (DONE)
    *   'playerInteractions.js/handleCanInteractions': Handles auto-drop and charging accumulation logic.
    *   'main.js' (mousedown/mouseup): Triggers charging state and burst release.

**4. Visual Feedback Updates:** (DONE)
    *   'playerRenderer.js': Blended capsule stroke based on 'paintedData'.
    *   'paintCan.js/renderPaintCan': Visual paint level.
    *   'dropletRenderer.js': Droplet rendering and fading.

**5. Paint Can Replenishment:** (DONE)
    *   'game-loop.js': Random spawning of available cans.
    *   'playerInteractions.js': 'handlePaintCanPickup' logic.
    *   'playerInteractions.js': 'handleEmptyPaintCan' logic.
    *   'game-loop.js': Calls pickup/empty handling, batches updates.

**6. Droplet Collision & Painting:** (DONE)
    *   'collisionHandler.js': 'checkCollisionsWithPlayer' detects hits, updates local presence ('paintedData', 'lost'), marks droplets for removal.
    *   'game-loop.js': Calls collision handler for local player, sends droplet removal updates.
    *   'playerRenderer.js': Displays loss message.

**7. Droplet Cleanup:** (DONE)
    *   Client-side visual fade ('dropletRenderer.js').
    *   Authoritative removal on collision ('collisionHandler.js' -> 'game-loop.js').
    *   Authoritative removal on timeout ('game-loop.js').

**8. Visual Polish:**
    *   Add visual charge indicator to paint can while charging. (DONE)
    *   Paint can appearance variations.
    *   Droplet splat effects on collision.
    *   Zone visuals (if implementing zones).

**9. Sound Effects:**
    *   Dripping, bursting, hitting, pickup, empty can drop. (Requires audio asset handling)

**10. UI:**
    *   Scoreboard / Player list.
    *   Paint level indicator UI element (alternative to in-can).
    *   Zone notifications (if implementing zones).

**11. Gameplay Enhancements:**
    *   Stealing cans from other players?
    *   Throwing cans?
    *   Different weapon types / paint effects?

**12. Networking Robustness:**
    *   Improve handling of state update races (e.g., simultaneous pickup attempts, disconnect handling, droplet timeout removal responsibility).

`;

export function loadDevNotes() {
    const container = document.getElementById('dev-notes-container');
    if (container) {
        // Use textContent to avoid HTML injection issues
        // Replace backticks with a similar character or remove them for display
        container.textContent = notes.replace(/`/g, "'"); // Replace backticks with single quotes for display
        console.log("Dev notes loaded.");
    } else {
        console.error("Dev notes container not found!");
    }
}