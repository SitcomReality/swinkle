export const notes = `
## Developer Notes - Multiplayer Core Established

**Current Implementation:**
- Basic WebsimSocket integration complete
- Shared cursor positions between players
- Simple canvas rendering of all player positions
- Presence system shows colored circles for each player
- Dev notes as hoverable overlay

**Recent Changes:**
✓ Core multiplayer connection established
✓ Basic presence tracking implemented
✓ Canvas rendering system initialized

**Immediate Next Steps:**
1. Implement player names/avatars display
2. Add basic collision detection framework
3. Create shared game object interaction system
4. Develop initial game mechanic prototype

**Revised File Structure:**
- main.js now handles core game loop
- style.css updated for game canvas layout
- config.js: Add game configuration values

**Key Questions:**
- What should be our first core game mechanic? 
- Should we implement object pickup or area control first?
- Any specific visual style goals for player avatars?
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