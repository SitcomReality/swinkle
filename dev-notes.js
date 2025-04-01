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

**Implementing Power-Ups - Current Phase: 'Big Burst' & 'Short Rope'**
*Goal: Finish implementing the 'Big Burst' & 'Short Rope' power-ups.*

**Completed Steps:**

1.  **Refactor Burst Logic:**
    1.1. Moved burst-on-empty logic from \`playerInteractions.js\` to \`burst-handler.js\`. *(DONE)*
    1.2. Moved manual burst logic (on mouseup) from \`main.js\` to \`burst-handler.js\`. *(DONE)*

2.  **Implement Big Burst Trigger Logic:**
    2.1. Check \`bigBurstActive\` flag in \`burst-handler.js\` (in both burst-on-empty and manual burst). *(DONE)*
    2.2. Apply multipliers (\`config.bigBurstDropletMultiplier\`, \`config.bigBurstRangeMultiplier\`) when calling \`createBurstDroplets\` if flag is active. *(DONE)*
    2.3. Consume the \`bigBurstActive\` flag (update presence) after a big burst occurs (in both scenarios). *(DONE)*

**Remaining Steps:**

3.  **Add Power-Up Icons:**
    *   Create rendering functions for new icons ('rope', 'burst') in \`power-ups/power-up-renderer.js\`.
    *   Update the \`switch\` statement in \`renderPowerUp\` to call the new functions.

4.  **Add Player Visual Effects (Optional/Stretch):**
    *   Consider refactoring power-up effect rendering from \`playerRenderer.js\`.
    *   Add visual cues in the player renderer for active 'shortRope' and 'bigBurst'.

**Next Steps:**

Step 3: Implement **Power-Up Icons** in \`power-ups/power-up-renderer.js\`.

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