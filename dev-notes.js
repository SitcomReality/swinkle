/**
 * dev-notes.js
 * Contains developer notes and plans for the project.
 * Loads notes into the UI.
 * Remember to escape backticks!
 */
export const notes = `
## Developer Notes - Multiplayer Painter

**Design Goals & Considerations:**
- **Core Gameplay:** Players swing around on bungee cords attached to their cursor. They acquire and carry a separate 'paint can' object, also attached via bungee to their player capsule. This can is used to automatically drop paint droplets or release bursts of paint. Players try to paint each other by maneuvering so their opponents collide with their droplets. Collision with another player\'s droplet adds that color to the victim\'s capsule outline. Reaching 100% painted is a loss condition. Players respawn after a delay. Level geometry provides obstacles.
- **Theme:** 'xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism' (Dark background, neon highlights). Apply this to characters, paint cans, paint droplets, UI elements.
- **Character Design:** Player capsule with big expressive eyes, dangling from a bungee cord attached to the cursor. Physics-based limbs enhance the dangle effect. A paint can dangles from the player capsule via another bungee cord. The capsule rotates in response to forces, trying to stay upright.
- **Modularity:** Keep logic separated (physics, rendering, game loop, networking, interactions, UI).
- **Performance & Networking:** Prioritize perceived smoothness. Trust clients for collision detection and state reporting. Use client-side prediction/rendering where possible (droplet expiration, maybe can physics). Rely on 'roomState' for authoritative positions of cans, droplets, and power-ups, and 'presence' for player anchor/painted state/active power-ups.
- **Developer Notes:** Update this file outlining planned steps and key questions. Remember to escape all backticks in these notes!


**Implementing New Power-Ups (Incremental Plan)**
*Goal: Add 'Short Rope' and 'Big Burst' power-ups incrementally.*

0.   ~~**(Done)** Defined 'shortRope' and 'bigBurst' power-up data structures and placeholder effects in `power-ups/power-up-data.js`. ~~
1.   ~~**(Done)** **Defined Power-Up Data:** Added 'shortRope' and 'bigBurst' definitions to `power-ups/power-up-data.js`. Include ID, name, description, duration, visual properties (color, icon ID), rarity, and *placeholder* `effect` functions.~~
2.1  ~~**(Done)** **Implement Short Rope Physics:** Added config values, modified `playerPhysics.js` to check presence flag and apply multipliers.~~
2.2 ~~**(Done)** **Handle Short Rope Activation/Expiration:** Updated 'shortRope' effect to set flag, updated `processActivePowerUps` to unset flag.~~
3.   ~~**(Done)** **Refactor Burst Logic:**~~
    *   ~~**(Done)** Moved the `createBurstDroplets` function from `playerInteractions.js` into `paint-burst.js`. ~~
    *   ~~**(Done)** Updated imports and function calls in `playerInteractions.js` to use the new file. (`collisionHandler.js` was not affected).~~

**Next Steps:**

4.  **(This Step)** **Implement Big Burst Logic:**
    4.1 * Add new config values to `config.js` for `bigBurstDropletMultiplier` (e.g., 1.5), `bigBurstRangeMultiplier` (e.g., 1.5), and `bigBurstDuration`.
    4.2 * Modify the `createBurstDroplets` function (in `paint-burst.js`) to accept droplet count and spread radius arguments.
    4.3 * Modify the relevant function in `playerInteractions.js` (likely `handleCanChargingAndDropping` or its caller) to check for a new presence flag (e.g., `bigBurstActive`) and pass the appropriate multipliers (or 1.0) to the burst creation function.
    4.4 * Update the 'bigBurst' `effect` function in `power-ups/power-up-data.js` to set `bigBurstActive: true` in presence (in addition to adding to `activePowerUps`).
    4.5 * Update `power-ups/power-up-manager.js` (`processActivePowerUps`) to handle the expiration of 'bigBurst', setting `bigBurstActive: false`.
5.  **Add Power-Up Icons:**
    *   Create new icon rendering functions (e.g., `drawRopeIcon`, `drawBurstIcon`) in `power-ups/power-up-renderer.js`.
    *   Update the `switch` statement in `renderPowerUp` to call the new functions based on the icon IDs defined in step 1.
6.  **Add Player Visual Effects (Optional/Stretch):**
    *   Consider refactoring power-up effect rendering from `playerRenderer.js` into a separate module/function.
    *   Add visual cues in the player renderer for active 'shortRope' (visually shorter bungee?) and 'bigBurst' (sparkling can? glowing effect?).

**Future Ideas/Stretch Goals:**
*   Sound effects.
*   More visual effects (improved pickup, etc.).
*   Environmental hazards? Polygon obstacles?
*   Optimize rendering and physics. Continue tuning player rotation. Collision-based torque?
*   Occasional whimsical/tip messages.
*   More social features (chat?).
*   Get 'paint cans are removed on level change' working

`;

export function loadDevNotes() {
    const container = document.getElementById('dev-notes-container');
    if (container) {
        // Use textContent to avoid HTML injection issues
        // Replace escaped backticks with single quotes for display
        container.textContent = notes.replace(/\\\\\`/g, "'");
        console.log("Dev notes loaded.");
    } else {
        console.error("Dev notes container not found!");
    }
}

// Ensure notes are loaded on initial script execution
loadDevNotes();