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
- **Theme:** \'xtreme 90s cyberpunk grungewave...\' (Dark background, neon highlights).
- **Character Design:** Physics-based capsule with limbs, dangling can.
- **Modularity:** Separate physics, rendering, game loop, networking, interactions, UI.
- **Performance & Networking:** Prioritize smoothness, client-side prediction where feasible. Use roomState for shared objects, presence for player-specific state.
- **Developer Notes:** Update this file outlining planned steps. Remember to escape all backticks with a slash!

**Implementing Power-Ups - Phase: 'Big Burst' & 'Short Rope' (Complete)**
*Goal: Implement the \'Big Burst\' & \'Short Rope\' power-ups and associated visuals.*

**Completed Steps (Summary):**

1.  **Refactored Burst Logic:** Moved burst logic to \`burst-handler.js\` and updated callers.
2.  **Implemented Power-Up Core Logic:** Integrated checks for \`bigBurstActive\` and \`shortRopeActive\` into \`burst-handler.js\` and \`playerPhysics.js\`. Applied multipliers/effects. Handled power-up consumption via presence updates.
3.  **Added Power-Up Icons:** Created rendering functions for new world item icons ('rope', 'burst') in \`power-ups/power-up-renderer.js\`.
4.  **Added Player Visual Effects:**
    *   Refactored power-up effect rendering from \`playerRenderer.js\` into \`player-effects-renderer.js\` due to file length constraints.
    *   Added visual cues in \`player-effects-renderer.js\` for active 'shortRope' and 'bigBurst' effects on the player character.
    *   Updated \`playerRenderer.js\` to call the new effects renderer.

**Current Status:** Base implementation for 'Big Burst' and 'Short Rope' power-ups, including world icons and player visual cues, is complete.

**Next Steps / Potential Focus Areas:**

*   **Sound Effects:** Add basic sound effects for key actions (swing, splat, pickup, loss, power-up collect/activate).
*   **Refinement & Bug Fixes:**
    *   Address known issues (e.g., 'paint cans are removed on level change').
    *   Tune physics parameters (bungee, player rotation, can physics).
    *   Optimize rendering/physics performance if needed.
*   **More Content:**
    *   Additional power-ups or variations.
    *   More complex level layouts or environmental hazards.
    *   Whimsical tip messages during gameplay.
*   **UI/UX Improvements:** Enhance scoreboard, add lobby features, potential chat.

`;

export function loadDevNotes() {
    const container = document.getElementById('dev-notes-container');
    if (container) {
        // Use textContent to avoid HTML injection issues
        // Replace escaped backticks with actual backticks for display
        container.textContent = notes.replace(/\\`/g, "`");
        console.log("Dev notes loaded.");
    } else {
        console.error("Dev notes container not found!");
    }
}

// Ensure notes are loaded on initial script execution
loadDevNotes();