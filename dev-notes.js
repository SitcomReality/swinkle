export const notes = `
## Developer Notes - Multiplayer Painter

**Design Goals & Considerations:**
- **Core Gameplay:** Players swing around on bungee cords attached to their cursor. They acquire and carry a separate 'paint can' object, also attached via bungee to their player capsule. This can is used to automatically drop paint droplets or release bursts of paint. Players try to paint each other by maneuvering so their opponents collide with their paint droplets. Collision with another player's droplet adds that color to the victim's capsule outline. Reaching 100% painted is a loss condition. Players respawn after a delay. Players must manage the paint in their can and find ways to replenish it by acquiring new cans. Players without a can can steal one by colliding with a player holding one. Level geometry provides obstacles.
- **Theme:** 'xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism' (Dark background, neon highlights). Apply this to characters, paint cans, paint droplets, UI elements.
- **Character Design:** Player capsule with big expressive eyes, dangling from a bungee cord attached to the cursor. Physics-based limbs enhance the dangle effect. A paint can dangles from the player capsule via another bungee cord.
- **Modularity:** Keep logic separated (physics, rendering, game loop, networking, interactions, UI).
- **Performance & Networking:** Prioritize perceived smoothness. Trust clients for collision detection and state reporting. Use client-side prediction/rendering where possible (droplet expiration, maybe can physics). Rely on 'roomState' for authoritative positions of cans and droplets, and 'presence' for player anchor/painted state.
- **Developer Notes:** Update this file outlining planned steps and key questions. Focus on small, testable increments. Remember to escape all backticks in these notes.

**Completed Steps:**
- Basic player movement and physics system
- Paint can interaction and physics system
- Droplet management and collision detection
- Visual effects for collisions and interactions
- Scoring system with persistent loss tracking
- UI distinction between paint levels and painted status
- Code refactoring: Split game-loop.js into specialized modules
- Code refactoring: Further distillation of game-loop.js logic into subsystems
- Aesthetic/Theme Implementation: Styled UI and added neon glow effects to canvas elements based on the theme.
- 1.1: Create a basic file structure for map data (e.g., 'levels/level-data.js').
- 1.2: Define a simple data structure for level geometry (e.g., an array of rectangle objects with position and dimensions).
- 1.3: Create an initial default level with a few static rectangular platforms/obstacles in 'levels/level-data.js'.
- 1.4: Implement level loading in a new 'level-manager.js'. Load the 'defaultLevel' data in 'main.js'.
- 1.5: Implement rendering of the level geometry in a new 'level-renderer.js'. Use data from 'level-manager.js' and call from 'game-loop.js'.
- **(Just Completed) 1.6: Implement basic collision detection and response between players/cans and the level geometry (e.g., in 'playerPhysics.js', 'paintCan.js', or a dedicated 'level-collision.js'). Start simply (stop movement on collision).**

**Next Steps:**

- **1. Environment/Level Generation:**
    *1.1-1.6: Done.*
    - 1.7: Refine collision response (e.g., add slight bounce/restitution based on obstacle properties, apply friction).
    - 1.8: Consider adding limb collision with level geometry (might be complex/visually noisy).
    - 1.9: Design more complex level structures (multiple levels?).

- **2. Advanced Gameplay Mechanics:**
    - 2.1: Power-ups? (Speed boost, temporary shield, different paint types).
    - 2.2: Environmental hazards? (Moving platforms, laser grids?).
    - 2.3: Team-based modes?

- **3. Polish & Refinement:**
    - 3.1: Sound effects.
    - 3.2: More visual effects (e.g., player respawn animation).
    - 3.3: Optimize rendering and physics.
    - 3.4: Improve collision accuracy (e.g., Capsule vs Rect, SAT).
    - 3.5: Add player avatars to scoreboard/game.
`;

export function loadDevNotes() {
    const container = document.getElementById('dev-notes-container');
    if (container) {
        // Use textContent to avoid HTML injection issues
        // Replace backticks with a similar character or remove them for display
        container.textContent = notes.replace(/`/g, "'"); // Replace backticks with single quotes for display
        console.log("Dev notes loaded.");
    } else {
        console.error("Dev notes container not found!");
    }
}