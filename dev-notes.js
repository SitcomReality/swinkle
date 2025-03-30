export const notes = `
## Developer Notes - Basic Squirt Implemented

**Current Implementation:**
- Basic WebsimSocket integration complete
- Shared cursor positions between players
- Simple canvas rendering of player positions (circles) and usernames
- Game loop logic in \`game-loop.js\`
- Basic styling with a dark theme initiated.
- Configurable colors and sizes in \`config.js\`
- Dev notes as hoverable overlay
- **Clicking now creates a short-lived "squirt" particle at the cursor location.**
- **Squirts are stored in \`roomState\` and visible to all players.**
- **Squirts automatically despawn after a configurable duration.**

**Recent Changes:**
✓ Core multiplayer connection established
✓ Basic presence tracking implemented
✓ Canvas rendering system initialized
✓ Game loop refactored into \`game-loop.js\`
✓ Player usernames are now displayed below their cursors
✓ Basic dark theme applied via \`style.css\`
✓ Added basic configuration options in \`config.js\`
✓ **Implemented basic click-to-squirt mechanic using \`roomState\`**
✓ **Added squirt rendering and auto-despawn logic in \`game-loop.js\`**
✓ **Added squirt configuration (color, size, duration) to \`config.js\`**

**Immediate Next Steps:**
1. Refine visual style:
    - Start incorporating neon colors more strongly (maybe player cursors too?).
    - Consider initial steps for "expressive eyes" on cursors (simple dots that follow mouse direction relative to the center?).
    - Enhance the squirt visual (e.g., fading out, simple animation?).
2. Improve Squirt Feel:
    - Add a small cooldown or rate limit to squirting? (Probably needed).
    - Should squirts have velocity/direction, or just appear instantly? (Let's keep instant for now).

**Design Goals & Considerations:**
- **Theme:** "xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism" (Dark background, neon highlights).
- **Core Mechanic:** Spraying/squirting.
- **Character Design:** Big expressive eyes (pupils track cursor/target?).
- **Modularity:** Keep breaking down logic into smaller files. Consider a \`squirt.js\` if logic expands.
- **Performance:** Keep rendering efficient. Squirt cleanup is handled in the game loop.

**Key Questions:**
- How should player colors be assigned? Randomly on join? User selectable? (Sticking with default white from config for now).
- Should squirts interact with anything yet (players, other squirts)? (No interaction/collision planned yet).
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

