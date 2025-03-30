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
- Basic bungee physics (spring, gravity, damping) implemented in \`player.js\`.
- **NEW:** Physics parameters (\`config.js\`) have been significantly tuned to provide a more elastic, less "taffy-like" feel. The bungee should now visibly stretch and retract more appropriately.
- **NEW:** Placeholder circle body replaced with a simple capsule shape drawn using Canvas primitives in \`player.js\`.
- **NEW:** Basic static eyes (white circles with black pupils) added to the capsule body.
- Physics state (position, velocity) is managed per-client locally in a map within \`player.js\`.
- \`game-loop.js\` calls \`updatePlayerPhysics\` for each player every frame and passes \`deltaTime\`.
- \`game-loop.js\` cleans up physics state for disconnected players.
- Bungee cord is drawn between the anchor and the body.

**Bungee Character Plan:**
1.  ~~Create \`player.js\` Module:~~ (Done)
2.  ~~Implement Basic Bungee Physics:~~ (Done)
    *   ~~Implement in \`player.js\`.~~
    *   ~~Simulate spring, gravity, damping.~~
    *   ~~Update character position based on physics.~~
    *   ~~**Tune physics constants for better feel.**~~ (Done)
3.  ~~Update \`game-loop.js\`:~~ (Done)
    *   ~~Ensure \`updatePlayerPhysics\` is called each frame with \`deltaTime\`. ~~
    *   ~~Refine rendering based on physics output (drawing cord, body at physics pos).~~
    *   ~~Handle disconnected player state cleanup.~~
4.  ~~Define Character Structure (SVG/Canvas Primitives):~~ (**Done**)
    *   ~~Replace the placeholder circle body with a character shape (capsule).~~
    *   ~~Add basic, static eyes.~~
    *   *Decision:* Sticking with Canvas primitives for now.
5.  **Implement Basic Eye Tracking:** (**Next Step**)
    *   Make eyes (pupils) follow the player's *own* cursor (anchor point).
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
- More expressive eyes (shape changes, etc.).

**Key Questions:**
- How does the *tuned* bungee feel now? Is it better? Still need adjustment? (Physics constants in \`config.js\` can be tweaked further).
- Is the capsule shape acceptable as a base body?
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

