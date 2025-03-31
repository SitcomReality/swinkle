export const notes = `
## Developer Notes - Multiplayer Painter

**Design Goals & Considerations:**
- **Core Gameplay:** Players swing around on bungee cords attached to their cursor. They acquire and carry a separate 'paint can' object, also attached via bungee to their player capsule. This can is used to automatically drop paint droplets or release bursts of paint. Players try to paint each other by maneuvering so their opponents collide with their paint droplets. Collision with another player's droplet adds that color to the victim's capsule outline. Reaching 100% painted is a loss condition. Players respawn after a delay. Players must manage the paint in their can and find ways to replenish it by acquiring new cans. Players without a can can steal one by colliding with a player holding one.
- **Theme:** 'xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism' (Dark background, neon highlights). Apply this to characters, paint cans, paint droplets, UI elements.
- **Character Design:** Player capsule with big expressive eyes, dangling from a bungee cord attached to the cursor. Physics-based limbs enhance the dangle effect. A paint can dangles from the player capsule via another bungee cord.
- **Modularity:** Keep logic separated (physics, rendering, game loop, networking, interactions, UI).
- **Performance & Networking:** Prioritize perceived smoothness. Trust clients for collision detection and state reporting. Use client-side prediction/rendering where possible (droplet expiration, maybe can physics). Rely on 'roomState' for authoritative positions of cans and droplets, and 'presence' for player anchor/painted state.
- **Developer Notes:** Update this file outlining planned steps and key questions. Focus on small, testable increments. Remember to escape all backticks in these notes.

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

**9. Sound Effects:**
    *   Dripping, bursting, hitting, pickup, empty can drop, steal. (Requires audio asset handling)

**10. UI:**
    *   Scoreboard / Player list displaying paint % and persistent loss count. (DONE)
    *   Paint level indicator UI element (alternative to in-can). (DONE)
    *   Zone notifications (if implementing zones).

**11. Gameplay Enhancements:**
    *   Player respawn mechanism after loss. (DONE)
    *   Stealing cans from other players? (DONE - Implemented via body collision)
    *   Throwing cans?
    *   Different weapon types / paint effects?

**12. Networking Robustness:**
    *   Improve handling of state update races (e.g., simultaneous pickup attempts, disconnect handling refinement - making can available, droplet timeout removal responsibility, steal race conditions).

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