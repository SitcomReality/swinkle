/**
 * dev-notes.js
 * Contains developer notes and plans for the project.
 * Loads notes into the UI.
 * Remember to escape backticks!
 */
export const notes = `
## Developer Notes - SWINKLE: Swing! Ink! Sprinkle!

**Design Goals & Considerations:**
- **Core Gameplay:** Players swing on bungee cords, carry paint cans, drop/burst paint to cover opponents. 100% painted = loss.
- **Theme:** 'xtreme 90s cyberpunk grungewave...' (Dark background, neon highlights).
- **Character Design:** Physics-based capsule with limbs, dangling can.
- **Modularity:** Separate physics, rendering, game loop, networking, interactions, UI.
- **Performance & Networking:** Prioritize smoothness, client-side prediction where feasible. Use roomState for shared objects, presence for player-specific state.
- **Developer Notes:** Update this file outlining planned steps. Remember to escape all backticks!

**Implementing Power-Ups - Current Phase: 'Big Burst'**
*Goal: Finish implementing the 'Big Burst' power-up.*

**Remaining Steps:**

1.  **Update Burst Function Signature & Calls:**
    1.1. Modify \`createBurstDroplets\` in \`paint-burst.js\` to accept a \`spreadRadius\` argument alongside \`numDroplets\`. *(DONE)*
    1.2. Update the call site in \`collisionHandler.js\` (\`createPaintBurst\`) to pass the default \`config.paintOutBurstRadius\`. (Note: Paint-out burst has separate config).
    1.3. Update the call site(s) within \`playerInteractions.js\` (for manual burst release on mouse up AND burst-on-empty while charging) to pass the default \`config.burstSpreadRadius\` for now.

2.  **Implement Big Burst Trigger Logic:**
    2.1. **Refactor Burst Release:** Extract the logic for releasing a burst (both on mouse up and when a can empties while charging) from \`playerInteractions.js\` into a new, dedicated function or module (e.g., \`burstHandler.js\`). This is necessary because \`playerInteractions.js\` is at its maximum length. Update \`playerInteractions.js\` to call this new function.
    2.2. **Check Power-Up:** In the *new* burst release logic, check the player's presence for the \`bigBurstActive\` flag.
    2.3. **Apply Multipliers:** If \`bigBurstActive\` is true, calculate the number of droplets and spread radius using \`config.bigBurstDropletMultiplier\` and \`config.bigBurstRangeMultiplier\`. Otherwise, use the default values (\`canState.accumulatedDroplets\` and \`config.burstSpreadRadius\`).
    2.4. **Call Creation:** Pass the calculated (or default) \`numDroplets\` and \`spreadRadius\` to the updated \`createBurstDroplets\` function.

3.  **Add Power-Up Icons:**
    *   Create rendering functions for new icons ('rope', 'burst') in \`power-ups/power-up-renderer.js\`.
    *   Update the \`switch\` statement in \`renderPowerUp\` to call the new functions.

4.  **Add Player Visual Effects (Optional/Stretch):**
    *   Consider refactoring power-up effect rendering from \`playerRenderer.js\`.
    *   Add visual cues in the player renderer for active 'shortRope' and 'bigBurst'.

**Next Steps:**

1.2 Implement **Collision Handler Call Update**: Update the call in \`collisionHandler.js\` (\`createPaintBurst\`).
1.3 Implement **Player Interactions Call Updates**: Update the calls in \`playerInteractions.js\` (mouse up burst, burst-on-empty).


**Future Ideas/Stretch Goals:**
*   Sound effects.
*   More visual effects.
*   Environmental hazards? Polygon obstacles?
*   Optimize rendering/physics.
*   Whimsical/tip messages.
*   More social features (chat?).
*   Fix: 'paint cans are removed on level change'.

`;

export function loadDevNotes() {
    const container = document.getElementById('dev-notes-container');
    if (container) {
        // Use textContent to avoid HTML injection issues
        // Replace escaped backticks with single quotes for display
        container.textContent = notes.replace(/\\`/g, "'"); 
        console.log("Dev notes loaded.");
    } else {
        console.error("Dev notes container not found!");
    }
}

// Ensure notes are loaded on initial script execution
loadDevNotes();