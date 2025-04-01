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

**Spectate Mode Implementation (Incremental):**
We want players to enter a spectate mode on join/loss/idle/ESC. Spectators hang from the ceiling, are semi-transparent, have no collision, and can click to respawn/rejoin.

  - **1. [DONE] Add State Flag & Initial Activation:**
  - **2. [DONE] Create Spectate Module & Anchor Logic:**
  - **3. [DONE] ESC Key Toggle:**
  - **4. [DONE] Idle Timer Activation:**
  - **5. [DONE] Click to Rejoin/Respawn:**
  - **6. [DONE] Visual Transparency:**
  - **7. [DONE] UI Reminder Text:**
  - **8. [DONE] Disable Collisions for Spectators:**
  - **9. [DONE] Disable Interactions for Spectators:**
  - **10. [DONE] Fix Anchor Point Rendering:** Ensure the anchor point (cursor circle) moves to the top edge for spectators and renders correctly.


**Other Planned Features:**

2. **[DONE] Better Score Tracking:** Reward players for painting other players.
   - 2.1: **[DONE]** Add score tracking to player presence data structure and update scoreboard to show scores.
   - 2.2: **[DONE]** Modify collisionHandler.js to track who painted whom by storing ownerId with droplet hits.
   - 2.3: **[DONE]** Update score increment logic in collisionHandler.js when droplet hits a player.
   - 2.4: **[DONE]** Add visual feedback (notification) when a player scores points.

3. **Sound effects.** (Requires audio capabilities)

4. **More visual effects:**
   - **[DONE] Add player respawn animation.**
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