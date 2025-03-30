export const notes = `
## Developer Notes - Player Names Displayed

**Current Implementation:**
- Basic WebsimSocket integration complete
- Shared cursor positions between players
- Simple canvas rendering of all player positions (circles) and usernames
- Game loop logic in \`game-loop.js\`
- Basic styling with a dark theme initiated.
- Configurable colors and sizes in \`config.js\`
- Dev notes as hoverable overlay

**Recent Changes:**
✓ Core multiplayer connection established
✓ Basic presence tracking implemented
✓ Canvas rendering system initialized
✓ Game loop refactored into \`game-loop.js\`
✓ Player usernames are now displayed below their cursors
✓ Basic dark theme applied via \`style.css\`
✓ Added basic configuration options in \`config.js\`

**Immediate Next Steps:**
1. Implement basic "squirt" mechanic:
    - On click, create a short-lived "squirt" object/particle effect originating from the player's cursor.
    - This object should probably be part of the \`roomState\` so everyone sees it.
    - Define particle appearance (color, shape, duration).
2. Refine visual style:
    - Start incorporating neon colors for cursors/names against the dark background.
    - Consider initial steps for "expressive eyes" on cursors (maybe simple dots that follow mouse?).

**Design Goals & Considerations:**
- **Theme:** "xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism" (Dark background, neon highlights).
- **Core Mechanic:** Spraying/squirting.
- **Character Design:** Big expressive eyes (pupils track cursor/target?).
- **Modularity:** Keep breaking down logic into smaller files as features are added (e.g., separate file for squirt logic).
- **Performance:** Keep rendering efficient, especially with potentially many particles.

**Key Questions:**
- For the squirt mechanic, should it have collision detection with other players immediately, or just be visual first? (Let's start visual only).
- How should player colors be assigned? Randomly on join? User selectable? (Let's stick with default white from config for now).
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

