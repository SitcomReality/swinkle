/**
 * dev-notes.js
 * Contains developer notes and plans for the project.
 * Loads notes into the UI.
 * Remember to escape backticks!
 */
export const notes = `
## Developer Notes - Multiplayer Painter

**Design Goals & Considerations:**
- **Core Gameplay:** Players swing around on bungee cords attached to their cursor. They acquire and carry a separate 'paint can' object, also attached via bungee to their player capsule. This can is used to automatically drop paint droplets or release bursts of paint. Players try to paint each other by maneuvering so their opponents collide with their droplets. Collision with another player's droplet adds that color to the victim's capsule outline. Reaching 100% painted is a loss condition. Players respawn after a delay. Players without a can can steal one by colliding with a player holding one. Level geometry provides obstacles.
- **Theme:** 'xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism' (Dark background, neon highlights). Apply this to characters, paint cans, paint droplets, UI elements.
- **Character Design:** Player capsule with big expressive eyes, dangling from a bungee cord attached to the cursor. Physics-based limbs enhance the dangle effect. A paint can dangles from the player capsule via another bungee cord. The capsule rotates in response to forces, trying to stay upright.
- **Modularity:** Keep logic separated (physics, rendering, game loop, networking, interactions, UI).
- **Performance & Networking:** Prioritize perceived smoothness. Trust clients for collision detection and state reporting. Use client-side prediction/rendering where possible (droplet expiration, maybe can physics). Rely on 'roomState' for authoritative positions of cans, droplets, and power-ups, and 'presence' for player anchor/painted state/active power-ups.
- **Developer Notes:** Update this file outlining planned steps and key questions. Remember to escape all backticks in these notes.

**Next Steps:**

**Enhanced Respawn Animation (Incremental Plan):**
Goal: Create a more visually appealing respawn sequence beyond the current basic sparkle. We'll implement this in stages to minimize errors. *Note: This should NOT involve `level-transition.js`.*

  - **1. Refine Existing Effect:**
    - Enhance the current 'respawnSparkle' effect in `effectsRenderer.js`. Make it a brighter, quicker burst of particles using the player's base color.
    - Update `respawn-manager.js` to pass the player's color when calling `addEffect`.
    - *Files Modified: `effectsRenderer.js`, `respawn-manager.js`*

  - **2. Player Fade-In:**
    - Add a temporary state to player presence indicating they are in the 'respawning animation' phase (e.g., \`respawnAnimProgress: 1\` initially, counting down).
    - Update `respawn-manager.js` (`triggerManualRespawn`) to set this state (e.g., for 0.5 seconds).
    - Update `game-loop.js` to decrement this timer each frame for relevant players and remove the state when done. Update presence if the timer state changes.
    - Modify `playerRenderer.js` to check for this state. If present, render the player capsule with opacity and/or scale based on the animation progress (e.g., scaling from 0 to 1 and fading from 0 to 1 as the timer goes from 0.5s down to 0s).
    - *Files Modified: `respawn-manager.js`, `game-loop.js`, `playerRenderer.js`, potentially `main.js` (for initial presence structure if field added)*

  - **3. Hide Player During Initial Burst:**
    - Modify `playerRenderer.js` again. During the first part of the 'respawnSparkle' effect (e.g., first 150-200ms, coordinated with Step 1 effect timing), *do not* render the player capsule at all. The fade-in from Step 2 should only start *after* the initial particle burst.
    - *Files Modified: `playerRenderer.js`*

  - **4. (Optional) Sound Effect:**
    - Once audio is available, trigger a respawn sound effect in `respawn-manager.js` when the respawn occurs.

**Other Planned Features:**

- **[DONE] Spectate Mode Implementation:** (Details omitted for brevity)
- **[DONE] Better Score Tracking:** (Details omitted for brevity)

- **Sound effects.** (Requires audio capabilities)

- **More visual effects:**
   - **[DONE] Add player respawn animation.** (Now being replaced by the enhanced plan above)
   - Player loss/paint-out effect.
   - Can pickup/steal effect improvement.

- **Future Ideas/Stretch Goals:**
    - Environmental hazards? (Moving platforms, laser grids?). Support for polygon obstacles.
    - Optimize rendering and physics. Continue tuning player rotation physics (inertia, damping, uprighting strength, bungee torque factor) for desired feel. Collision-based torque could also be added.
    - Add logic for occasional whimsical/tip messages (maybe triggered randomly in the game loop or based on simple conditions like low paint)
    - More social features, like chat messages?

`;

export function loadDevNotes() {
    const container = document.getElementById('dev-notes-container');
    if (container) {
        // Use textContent to avoid HTML injection issues
        // Replace escaped backticks with single quotes for display
        container.textContent = notes.replace(/\\\`/g, "'");
        console.log("Dev notes loaded.");
    } else {
        console.error("Dev notes container not found!");
    }
}