export const notes = `
## Developer Notes - Bungee Player Implementation

**Design Goals & Considerations:**
- **Theme:** "xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism" (Dark background, neon highlights).
- **Character Design:** Big expressive eyes. Characters dangle from a bungee cord attached to the player's cursor point (anchor). Little arms/legs dangle.
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
- Bungee physics (spring, gravity, damping) implemented in \`player.js\`.
- Character body is a capsule shape drawn using Canvas primitives.
- Physics state (position, velocity) is managed per-client locally in a map within \`player.js\`.
- \`game-loop.js\` calls \`updatePlayerPhysics\` for each player every frame and passes \`deltaTime\`.
- \`game-loop.js\` cleans up physics state for disconnected players.
- Bungee cord is drawn between the anchor and the body.
- Basic eye tracking implemented: Pupils follow the *local player's own* cursor (anchor point).
- Bungee cord physics refined: Max length enforced, constants tuned for stretch/bounce.
- Simple physics-based limbs added, dangling from attachment points on the body. Limb physics (\`updateLimbPhysics\`) and rendering integrated into \`player.js\`. Limb appearance and physics constants configurable in \`config.js\`.

**Bungee Character Plan:**
1.  ~~Create \`player.js\` Module:~~ (Done)
2.  ~~Implement Basic Bungee Physics:~~ (Done)
3.  ~~Update \`game-loop.js\`:~~ (Done)
4.  ~~Define Character Structure (SVG/Canvas Primitives):~~ (Done)
5.  ~~Implement Basic Eye Tracking:~~ (Done)
6.  ~~Add Simple Limb Physics:~~ (Done)
    *   ~~Create data structure for limb state (position, velocity).~~
    *   ~~Implement limb physics simulation (spring, gravity, damping relative to body attachment points).~~
    *   ~~Render limbs (simple lines for now).~~
    *   ~~Add limb config options.~~
7.  **Refine Visual Style:** (**Next Step**)
    *   Apply neon/cyberpunk styling to the player character and bungee cord.
    *   Enhance the squirt visual.
    *   Consider limb shapes other than lines?

**Future Considerations:**
- Squirt cooldown/rate limiting.
- Player color assignment influencing body/cord/limb color.
- Squirt interactions (if any).
- SVG character integration (if Canvas primitives become limiting).
- More expressive eyes (shape changes, etc.).
- Rotating the player capsule based on movement/velocity.

**Key Questions:**
- How do the limbs feel? Are they too floppy, too stiff, or just right?
- Is the number/length/attachment of limbs appropriate?
- Should limbs be simple lines, or have more shape (e.g., small capsules)?
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

