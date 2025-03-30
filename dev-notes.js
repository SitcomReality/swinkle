export const notes = `
## Developer Notes - Bungee Player Implementation

**Design Goals & Considerations:**
- **Theme:** "xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism" (Dark background, neon highlights).
- **Character Design:** Big expressive eyes. Characters dangle from a bungee cord attached to the player's cursor point (anchor).
- **Modularity:** Keep breaking down logic into smaller files.
- **Performance:** Keep rendering efficient.
- **Developer Notes:** Update this file including future steps and key questions after every update. Use your intuition or imagination when making updates that involve unanswered questions. Remember to escape all backticks in these notes.

**Current State & Overview:**
- Multiplayer connection via WebsimSocket is functional.
- Players control an anchor point, positions are shared.
- Clicking creates temporary "squirt" particles visible to all.
- Basic rendering handled in \`game-loop.js\` using Canvas 2D.
- Configuration managed in \`config.js\`.
- **NEW:** \`player.js\` module created. It handles rendering the player anchor point and a *placeholder* character body below it. Player rendering logic is now separate from the main game loop.

**Bungee Character Plan:**
1.  **~~Create \`player.js\` Module:~~** (Done)
    *   ~~Define player character structure (placeholder).~~
    *   ~~Include logic for rendering the player anchor and placeholder body.~~
    *   ~~Eye tracking deferred.~~
2.  **Implement Basic Bungee Physics:** (**Next Step**)
    *   Implement in \`player.js\`.
    *   Simulate a simple spring connecting the anchor point (cursor) and the character's attachment point (center of placeholder body for now). Use Hooke's Law (F = -kx).
    *   Add basic gravity pulling the character down.
    *   Add damping to prevent infinite oscillation.
    *   Update the character's position based on physics calculations in \`updatePlayerPhysics\` (called from \`game-loop.js\`).
3.  **Update \`game-loop.js\`:**
    *   Ensure \`updatePlayerPhysics\` is called each frame with \`deltaTime\`. (Need to add this call).
    *   Refine rendering based on physics output.
4.  **Define Character Structure (SVG):**
    *   Design the actual character SVG (body, limbs, eyes).
    *   Plan how to integrate and manipulate the SVG in \`player.js\`.
5.  **Refine Visual Style:**
    *   Apply neon/cyberpunk styling to the player character and bungee cord.
    *   Enhance the squirt visual.

**Future Considerations:**
- Squirt cooldown/rate limiting.
- Player color assignment.
- Squirt interactions (if any).
- Eye tracking implementation.
- Character limb physics (simple dangling).

**Key Questions:**
- How should the SVG be structured for easy animation (e.g., separate elements for body, head, eyes, limbs)? Is drawing primitives directly in Canvas more performant/easier for simple physics initially? (Let's stick with Canvas primitives for physics first, then consider SVG for appearance).
`;

export function loadDevNotes() {
    const container = document.getElementById('dev-notes-container');
    if (container) {
        container.textContent = notes;
        console.log("Dev notes loaded.");
    } else {
        console.error("Dev notes container not found!");
    }
}