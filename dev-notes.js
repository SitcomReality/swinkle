export const notes = `
## Developer Notes - Planning Bungee Player

**Design Goals & Considerations:**
- **Theme:** "xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism" (Dark background, neon highlights).
- **Character Design:** Big expressive eyes. Characters dangle from a bungee cord attached to the player's cursor point.
- **Modularity:** Keep breaking down logic into smaller files.
- **Performance:** Keep rendering efficient.
- **Developer Notes:** Update this file including future steps and key questions after every update. Use your intuition or imagination when making updates that involve unanswered questions. Remember to escape all backticks in these notes.

**Current State & Overview:**
- Multiplayer connection via WebsimSocket is functional.
- Players control a cursor point, positions are shared.
- Clicking creates temporary "squirt" particles visible to all.
- Basic rendering handled in \`game-loop.js\` using Canvas 2D.
- Configuration managed in \`config.js\`.

**Proposed Player Redesign: Bungee Character**
- The current cursor circle will become the anchor point for a bungee cord.
- A character graphic (likely SVG) will dangle from the cord.
- The character should have simple physics (spring motion for bungee, dangling limbs).
- Expressive eyes on the character are a key feature.

**Immediate Next Steps & Modules:**
1.  **Create \`player.js\` Module:**
    *   Define player character structure (SVG?).
    *   Include logic for rendering the player character (body, limbs, eyes).
    *   Handle eye tracking (following cursor or direction of movement).
2.  **Implement Basic Bungee Physics:**
    *   Could be in \`player.js\` initially or a separate \`physics.js\`.
    *   Simulate a simple spring connecting the anchor point (cursor) and the character's attachment point.
    *   Add basic gravity/damping.
3.  **Update \`game-loop.js\`:**
    *   Import player rendering logic from \`player.js\`.
    *   Replace the simple cursor circle rendering with the new bungee character rendering.
    *   Integrate physics updates into the game loop.
4.  **Refine Visual Style:**
    *   Apply neon/cyberpunk styling to the player character and bungee cord.
    *   Enhance the squirt visual (e.g., fading out, simple animation?).

**Future Considerations:**
- Squirt cooldown/rate limiting.
- Player color assignment.
- Squirt interactions (if any).

**Key Questions:**
- How complex should the initial bungee physics be? (Start simple: spring + damping?).
- How should the character's SVG be structured for easy animation/manipulation (limbs, eyes)?
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