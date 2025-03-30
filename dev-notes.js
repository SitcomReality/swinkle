export const notes = `
## Developer Notes - Game Loop Refactored

**Current Implementation:**
- Basic WebsimSocket integration complete
- Shared cursor positions between players
- Simple canvas rendering of all player positions (colored circles)
- Game loop logic moved to \`game-loop.js\`
- Dev notes as hoverable overlay

**Recent Changes:**
✓ Core multiplayer connection established
✓ Basic presence tracking implemented
✓ Canvas rendering system initialized
✓ Game loop refactored into \`game-loop.js\` for modularity

**Immediate Next Steps:**
1. Implement player names/avatars display near cursors or in a list.
2. Add basic collision detection framework (e.g., detecting if cursors overlap).
3. Create shared game object interaction system (e.g., clicking on a shared object).
4. Develop initial game mechanic prototype (e.g., tag, simple resource gathering).

**Key Questions:**
- What should be our first core game mechanic? Tag seems simple to implement initially.
- Should we implement object pickup or area control first? Let's start with simpler interactions first.
- Any specific visual style goals for player avatars/cursors beyond colored circles?

**Code Structure Notes:**
- \`main.js\`: Handles initialization, event listeners (like mouse movement), and setting up subscriptions. Connects modules.
- \`game-loop.js\`: Manages the rendering cycle (\`requestAnimationFrame\`), drawing game state to the canvas.
- \`config.js\`: Stores configuration values.
- \`style.css\`: Basic styling.
- \`dev-notes.js\`: Tracks progress and planning.
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