/**
 * dev-notes.js
 * Contains developer notes, TODOs, and plan for the project.
 */
export const notes = `
## Developer Notes - Multiplayer Painter

**Design Goals & Considerations:**
- **Core Gameplay:** Players swing around on bungee cords attached to their cursor. They acquire and carry a separate 'paint can' object, also attached via bungee to their player capsule. This can is used to automatically drop paint droplets or release bursts of paint. Players try to paint each other by maneuvering so their opponents collide with their paint droplets. Collision with another player's droplet adds that color to the victim's capsule outline. Reaching 100% painted is a loss condition. Players respawn after a delay. Players must manage the paint in their can and find ways to replenish it by acquiring new cans. Players without a can can steal one by colliding with a player holding one. Cans can be thrown.
- **Theme:** 'xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism' (Dark background, neon highlights). Apply this to characters, paint cans, paint droplets, UI elements.
- **Character Design:** Player capsule with big expressive eyes, dangling from a bungee cord attached to the cursor. Physics-based limbs enhance the dangle effect. A paint can dangles from the player capsule via another bungee cord.
- **Modularity:** Keep logic separated (physics, rendering, game loop, networking, interactions, UI). (IMPROVED: Refactored game-loop into updater/renderer).
- **Performance & Networking:** Prioritize perceived smoothness. Trust clients for collision detection and state reporting. Use client-side prediction/rendering where possible (droplet expiration, maybe can physics). Rely on 'roomState' for authoritative positions of cans and droplets, and 'presence' for player anchor/painted state. (IMPROVED: Refined pickup/steal confirmation logic).
- **Developer Notes:** Update this file outlining planned steps and key questions. Remember to escape all backticks in these notes.

**Gameplay Plan (Incremental Steps):**

**1. State Management Setup:** (DONE)
**2. Paint Can Physics & Rendering:** (DONE)
**3. Droplet Generation from Can:** (DONE)
**4. Visual Feedback Updates:** (DONE)
**5. Paint Can Replenishment:** (DONE)
**6. Droplet Collision & Painting:** (DONE)
**7. Droplet Cleanup:** (DONE)
**8. Visual Polish:**
    *   Add visual charge indicator to paint can while charging. (DONE)
    *   Paint can appearance variations. (DONE - Basic color band/pattern added)
    *   Droplet splat effects on collision. (DONE)
    *   Zone visuals (if implementing zones).

**9. Sound Effects:** (SKIPPED - Requires audio assets)
    *   Dripping, bursting, hitting, pickup, empty can drop, steal.

**10. UI:**
    *   Scoreboard / Player list displaying paint % and persistent loss count. (DONE)
    *   Paint level indicator UI element (alternative to in-can). (DONE)
    *   Zone notifications (if implementing zones).

**11. Gameplay Enhancements:**
    *   Player respawn mechanism after loss. (DONE)
    *   Stealing cans from other players? (DONE - Implemented via body collision)
    *   Throwing cans? (DONE)
    *   Different weapon types / paint effects? (NEXT)

**12. Networking Robustness:** (PARTIALLY DONE)
    *   Improve handling of state update races:
        *   Simultaneous pickup/steal attempts (DONE - Client proposes via roomState, confirms via received roomState before updating presence).
        *   Disconnect handling refinement - making can available (DONE - Handled via presence subscription).
        *   Droplet timeout removal responsibility (DONE - Client checks and proposes removal in roomState update).
        *   Steal race conditions (Addressed by confirmation logic, but edge cases might remain).

**Current Focus: Gameplay Enhancements**
*   **Different weapon types / paint effects:** Consider adding different types of cans (e.g., wider spray, sticky paint, shield paint) or power-ups. This is a larger feature.

**Refactoring:**
*   Refactored \`game-loop.js\` into \`gameUpdater.js\` (logic) and \`gameRenderer.js\` (drawing) to improve organization and manage file length.

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