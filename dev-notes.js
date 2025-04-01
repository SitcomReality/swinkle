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
      - Add an \`isSpectating\` boolean flag to the player presence data structure.
      - Modify \`main.js\` so that when a player initially joins (\`room.updatePresence\` call in \`initGame\`), they start with \`isSpectating: true\`.
      - Modify \`respawn-manager.js\` so that when a player respawns (after loss or manual rejoin), \`isSpectating\` is set to \`false\`.

  - **2. [DONE] Create Spectate Module & Anchor Logic:**
      - Create a new file \`spectate-mode.js\`.
      - Inside \`spectate-mode.js\`, create a function \`getSpectatorAnchorPosition(clientId, deltaTime)\` that:
          - Takes the client ID and delta time.
          - Stores a simple state for each spectator's current horizontal position and velocity along the ceiling.
          - Calculates a new anchor position:
              - Y coordinate fixed at the top boundary (e.g., \`y = 0\` or a small margin).
              - X coordinate moves randomly side-to-side within the game boundaries (e.g., apply small random force, update velocity, update position, clamp to edges).
          - Returns the calculated \`{ x, y }\` anchor position.
      - Modify \`playerPhysics.js\` (\`updatePlayerPhysics\` function):
          - Check the player's \`presence.isSpectating\` flag.
          - If \`true\`, call \`getSpectatorAnchorPosition\` from \`spectate-mode.js\` to get the anchor position *instead* of using \`presence.x\` and \`presence.y\`.
          - If \`false\`, use the existing logic (\`presence.x\`, \`presence.y\`).
      - Add cleanup for spectator state in \`peer-manager.js\` and \`respawn-manager.js\`.

  - **3. [DONE] ESC Key Toggle:**
      - In \`main.js\`, add a global keydown listener for the 'Escape' key.
      - When ESC is pressed, check the current \`isSpectating\` state of the local player.
      - If currently spectating, call the "rejoin/respawn" logic using a helper function in \`respawn-manager.js\`.
      - If *not* currently spectating, update the local player's presence to set \`isSpectating: true\` and drop their current can (if any). **(Uses helper \`enterSpectateMode\` in \`spectate-mode.js\`)**

  - **4. [DONE] Idle Timer Activation:**
      - In \`main.js\` or \`game-loop.js\`, track the last time the local player's cursor position (\`presence.x\`, \`presence.y\`) changed *significantly* (add a small threshold to ignore minor jitter).
      - In the game loop, check if the time since the last significant change exceeds the idle threshold (e.g., 20 seconds).
      - If the player is idle and *not* already spectating, update their presence to set \`isSpectating: true\` **(Uses helper \`enterSpectateMode\` in \`spectate-mode.js\`)**.

  - **5. [DONE] Click to Rejoin/Respawn:**
      - In \`main.js\`, modify the existing canvas click listener (\`mousedown\` might be better).
      - Inside the listener, first check if the local player's \`presence.isSpectating\` is \`true\`.
      - If it is, trigger the respawn logic:
          - Update local presence using the helper from Step 3 (\`triggerManualRespawn\`).
          - Let the normal mousemove listener take over updating the anchor point from the next frame.
      - If \`isSpectating\` is \`false\`, perform the normal click actions (charging etc.).

  - **6. [DONE] Visual Transparency:**
      - Modify \`playerRenderer.js\` (\`renderPlayer\` function):
          - Check the player's \`presence.isSpectating\` flag.
          - If \`true\`, set \`ctx.globalAlpha = 0.5;\` before drawing the player body/limbs/eyes/name.
          - Make sure to restore alpha with \`ctx.restore()\` or set it back to 1.0 afterwards so other elements aren't affected.

  - **7. [DONE] UI Reminder Text:**
      - Modify \`ui-manager.js\` or create a function in \`spectate-mode.js\`.
      - Add a function \`renderSpectateUI(ctx, isSpectating)\` or similar.
      - If \`isSpectating\` is true:
          - Render text like "Spectating - Click to Respawn" on the canvas.
          - Apply a simple pulsating effect (e.g., changing alpha or size slightly over time using \`Math.sin(Date.now() * speed)\`).
      - Call this function from the main \`renderScene\` in \`renderer.js\`.

  - **8. --> Disable Collisions for Spectators:**
      - Modify \`collisionHandler.js\` (\`checkCollisionsWithPlayer\`): Add a check at the start to return immediately if \`currentPresence.isSpectating\` is true.
      - Modify \`collision-system.js\` (\`handlePlayerCollisions\`): Add checks to ensure neither the local player nor the other player is spectating before attempting a steal collision.
      - Modify \`power-ups/power-up-manager.js\` (\`checkPowerUpCollisions\`): Add a check at the start to return immediately if \`currentPresence.isSpectating\` is true.
      - Modify \`level-collision.js\` (\`handlePlayerLevelCollision\`): Add a check to return immediately if \`playerState.isSpectating\` is true (we might need to pass presence or add the flag to the physics state temporarily - **Pass presence**).

  - **9. Disable Interactions for Spectators:**
      - Modify \`playerInteractions.js\` (\`handleLocalPlayerInteractions\`): Add a check at the beginning. If \`presence.isSpectating\` is true, return empty update objects immediately, preventing pickup/charging/dropping actions.


**Other Planned Features:**

2. **Better Score Tracking:** Reward players for painting other players.
   - 2.1: Add score tracking to player presence data structure and update scoreboard to show scores.
   - 2.2: Modify collisionHandler.js to track who painted whom by storing ownerId with droplet hits.
   - 2.3: Update score increment logic in collisionHandler.js when droplet hits a player.
   - 2.4: Add visual feedback (notification and effects) when a player scores points.

3. **Sound effects.**
4. **More visual effects** (e.g., player respawn animation).

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