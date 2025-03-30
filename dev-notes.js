export const notes = `
## Developer Notes - Bungee Player Implementation

**Design Goals & Considerations:**
- **Theme:** "xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism" (Dark background, neon highlights).
- **Character Design:** Big expressive eyes. Characters dangle from a bungee cord attached to the player's cursor point (anchor).
- **Modularity:** Keep breaking down logic into smaller files.
- **Performance:** Keep rendering efficient. Clamped deltaTime.
- **Developer Notes:** Update this file including future steps and key questions after every update. Use your intuition or imagination when making updates that involve unanswered questions. Remember to escape all backticks in these notes.

**Current State & Overview:**
- Multiplayer connection via WebsimSocket is functional.
- Players control an anchor point (cursor), positions are shared via presence.
- Clicking creates temporary "squirt" particles visible to all (room state).
- Basic rendering handled in \`game-loop.js\` using Canvas 2D.
- Configuration managed in \`config.js\`.
- Player rendering logic isolated in \`player.js\`.
- **NEW:** Basic bungee physics (spring, gravity, damping) implemented in \`player.js\` for the placeholder body.
- **NEW:** Physics state (position, velocity) is managed per-client locally in a map within \`player.js\`.
- **NEW:** \`game-loop.js\` now calls \`updatePlayerPhysics\` for each player every frame and passes \`deltaTime\`.
- **NEW:** \`game-loop.js\` now cleans up physics state for disconnected players.
- **NEW:** Bungee cord is drawn between the anchor and the body.

**Bungee Character Plan:**
1.  ~~Create \`player.js\` Module:~~ (Done)
2.  **~~Implement Basic Bungee Physics:~~** (Done)
    *   ~~Implement in \`player.js\`.~~
    *   ~~Simulate spring, gravity, damping.~~
    *   ~~Update character position based on physics.~~
3.  **~~Update \`game-loop.js\`:~~** (Done)
    *   ~~Ensure \`updatePlayerPhysics\` is called each frame with \`deltaTime\`. ~~
    *   ~~Refine rendering based on physics output (drawing cord, body at physics pos).~~
    *   ~~Handle disconnected player state cleanup.~~
4.  **Define Character Structure (SVG/Canvas Primitives):** (**Next Step**)
    *   Replace the placeholder circle body with a more character-like shape using Canvas drawing commands (e.g., simple head, torso).
    *   Add basic, static eyes for now (expressive eyes later).
    *   *Decision:* Stick with Canvas primitives for now for simplicity before potentially moving to SVG.
5.  **Implement Basic Eye Tracking:**
    *   Make eyes follow the player's *own* cursor (anchor point).
6.  **Refine Visual Style:**
    *   Apply neon/cyberpunk styling to the player character and bungee cord.
    *   Enhance the squirt visual.
7.  **Add Simple Limb Physics:**
    *   Make small limb shapes dangle/react loosely to body movement.

**Future Considerations:**
- Squirt cooldown/rate limiting.
- Player color assignment influencing body/cord color.
- Squirt interactions (if any).
- SVG character integration (if Canvas primitives become limiting).

**Key Questions:**
- How does the current bungee feel? Is it too stiff, too bouncy, too slow? (Physics constants in \`config.js\` can be tweaked).
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

