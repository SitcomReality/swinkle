/**
 * dev-notes.js
 * Contains developer notes and plans for the project.
 * Loads notes into the UI.
 * Remember to escape backticks!
 */
export const notes = `
## Developer Notes - Multiplayer Painter

**Design Goals & Considerations:**
- **Core Gameplay:** Players swing around on bungee cords attached to their cursor. They acquire and carry a separate 'paint can' object, also attached via bungee to their player capsule. This can is used to automatically drop paint droplets or release bursts of paint. Players try to paint each other by maneuvering so their opponents collide with their droplets. Collision with another player\'s droplet adds that color to the victim\'s capsule outline. Reaching 100% painted is a loss condition. Players respawn after a delay. Players without a can can steal one by colliding with a player holding one. Level geometry provides obstacles.
- **Theme:** 'xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism' (Dark background, neon highlights). Apply this to characters, paint cans, paint droplets, UI elements.
- **Character Design:** Player capsule with big expressive eyes, dangling from a bungee cord attached to the cursor. Physics-based limbs enhance the dangle effect. A paint can dangles from the player capsule via another bungee cord. The capsule rotates in response to forces, trying to stay upright.
- **Modularity:** Keep logic separated (physics, rendering, game loop, networking, interactions, UI).
- **Performance & Networking:** Prioritize perceived smoothness. Trust clients for collision detection and state reporting. Use client-side prediction/rendering where possible (droplet expiration, maybe can physics). Rely on 'roomState' for authoritative positions of cans, droplets, and power-ups, and 'presence' for player anchor/painted state/active power-ups.
- **Developer Notes:** Update this file outlining planned steps and key questions. Remember to escape all backticks in these notes.

**Next Steps: Dynamic Level Color Palettes**

Goal: Implement a system where each level uses a distinct color palette consisting of two paint colors (that mix well) and a background/geometry base color.

**Implementation Plan:**

1.  **[DONE] Palette Definition:**
    *   Created \`paletteData.js\` and defined several pre-approved palettes (arrays of objects) with \`paint1\`, \`paint2\`, \`backgroundBase\` hex codes. Ensured paint colors mix reasonably well. Exported these palettes.
    *   Added \`paletteData.js\` to the import map in \`index.html\`.
    *   *Files Modified: \`paletteData.js\` (new), \`index.html\`, \`dev-notes.js\`*

2.  **Palette Selection Logic:**
    *   In \`level-manager.js\`, import palettes from \`paletteData.js\`.
    *   Add state within \`level-manager.js\` to store the \`currentPalette\` object.
    *   Modify the level loading/transition logic (likely in \`initializeLevelManager\` and the \`subscribeRoomState\` callback) to select a palette (e.g., based on level ID or randomly) when a level *starts* loading or finishes transitioning. Store the selected palette in \`currentPalette\`.
    *   Add a getter function \`getCurrentPalette()\` to \`level-manager.js\`.
    *   *(Files To Modify: \`level-manager.js\`)*

3.  **Apply Background/Geometry Colors:**
    *   Modify \`level-renderer.js\`: Import \`getCurrentPalette\` from \`level-manager.js\`. In \`renderStableObstacles\`, get the current palette. Use \`palette.backgroundBase\` to generate obstacle colors (e.g., directly, or create a slightly darker tint). Remove the static \`obstacle.color\` usage.
    *   Modify \`level-transition.js\`: Import \`getCurrentPalette\`. During transitions, get the palettes associated with the *old* and *new* levels (this might require passing the selected palettes into the transition function or having the transition function look them up based on level ID/palette selection logic). Blend the \`backgroundBase\` colors instead of the static \`backgroundColor\` from level data.
    *   Modify \`levels/level-data.js\`: Remove the static \`backgroundColor\` and \`obstacle.color\` properties from the level definitions.
    *   *(Files To Modify: \`level-renderer.js\`, \`level-transition.js\`, \`levels/level-data.js\`, \`level-manager.js\` (potentially))*

4.  **Apply Paint Colors:**
    *   Modify \`can-manager.js\` (\`spawnPaintCans\`): Import \`getCurrentPalette\` from \`level-manager.js\`. Get the current palette. Instead of picking from the removed \`config.paintCanColors\`, randomly choose between \`currentPalette.paint1\` and \`currentPalette.paint2\` for the \`paintColor\` property of the new can.
    *   Modify \`config.js\`: Remove the \`paintCanColors\` array.
    *   *(Files To Modify: \`can-manager.js\`, \`config.js\`)*

5.  **Testing & Refinement:**
    *   Test thoroughly to ensure colors change correctly with levels, transitions are smooth, cans spawn with the right colors, and paint blending looks good. Refine palettes or generation logic if needed.


**Previous Completed Tasks:**

*   Enhanced Respawn Animation & Player Fade-in
*   Spectate Mode Implementation
*   Score Tracking Improvements
*   Notification Broadcasting
*   Paint-Out Burst Effect + Player Invisibility + Spectate Transition
*   Scoreboard Distinction for Spectators
*   Notification Combination Effect

**Future Ideas/Stretch Goals:**
*   Sound effects. (Requires audio capabilities)
*   More visual effects (improved pickup/steal, etc.).
*   Environmental hazards? Polygon obstacles?
*   Optimize rendering and physics. Continue tuning player rotation. Collision-based torque?
*   Occasional whimsical/tip messages.
*   More social features (chat?).

`;

export function loadDevNotes() {
    const container = document.getElementById('dev-notes-container');
    if (container) {
        // Use textContent to avoid HTML injection issues
        // Replace escaped backticks with single quotes for display
        container.textContent = notes.replace(/\\\`/g, "'");
        console.log("Dev notes loaded.");
    } else {
        console.error("Dev notes container not found!");
    }
}

// Ensure notes are loaded on initial script execution
loadDevNotes();