export const notes = `
## Developer Notes - Multiplayer Painter

**Design Goals & Considerations:**
- **Core Gameplay:** Players swing around on bungee cords attached to their cursor. They acquire and carry a separate 'paint can' object, also attached via bungee to their player capsule. This can is used to automatically drop paint droplets or release bursts of paint. Players try to paint each other by maneuvering so their opponents collide with their paint droplets. Collision with another player's droplet adds that color to the victim's capsule outline. Reaching 100% painted is a loss condition. Players respawn after a delay. Players must manage the paint in their can and find ways to replenish it by acquiring new cans. Players without a can can steal one by colliding with a player holding one. Level geometry provides obstacles.
- **Theme:** 'xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism' (Dark background, neon highlights). Apply this to characters, paint cans, paint droplets, UI elements.
- **Character Design:** Player capsule with big expressive eyes, dangling from a bungee cord attached to the cursor. Physics-based limbs enhance the dangle effect. A paint can dangles from the player capsule via another bungee cord. The capsule rotates in response to forces, trying to stay upright. **(Rotation implemented, parameters tuned for stability)**.
- **Modularity:** Keep logic separated (physics, rendering, game loop, networking, interactions, UI).
- **Performance & Networking:** Prioritize perceived smoothness. Trust clients for collision detection and state reporting. Use client-side prediction/rendering where possible (droplet expiration, maybe can physics). Rely on 'roomState' for authoritative positions of cans and droplets, and 'presence' for player anchor/painted state.
- **Developer Notes:** Update this file outlining planned steps and key questions. Focus on small, testable increments. Remember to escape all backticks in these notes.

**Next Steps:**

- **1. Environment/Level Generation:**
    *1.1-1.8: Done.*
    - 1.9: Power-ups. Eg. Shorter, stiffer or springier bungee between cursor and capsule; temporary shield; acetone (a 'health pickup' that reduces how painted the player is); paint buckets with buffed attributes, like double sized (visually and in terms of paint volume), less viscous (drops faster), and a rare buff that makes every droplet a full burst.
        - 1.9.1: *DONE* - Created basic power-up infrastructure with modules for definition, rendering, and management
        - 1.9.2: Integrate power-up system with game loop for spawning and rendering
        - 1.9.3: Implement collision detection to collect power-ups
        - 1.9.4: Create active power-up processing system for timed effects
        - 1.9.5: Implement each power-up effect (shield, acetone, spring, mega can)
        - 1.9.6: Add visual effects to indicate active power-ups on players

- **2. Advanced Gameplay Mechanics:**
    - 2.1: Design more complex level structures (multiple levels?).
    - 2.2: Environmental hazards? (Moving platforms, laser grids?).
    - 2.3: Better score tracking: reward players for painting other players.

- **3. Polish & Refinement:**
    - 3.1: Sound effects.
    - 3.2: More visual effects (e.g., player respawn animation).
    - 3.3: Optimize rendering and physics.
    - 3.4: Add player avatars to scoreboard/game.
    - 3.5: Continue tuning player rotation physics (inertia, damping, uprighting strength, bungee torque factor) for desired feel. Collision-based torque could also be added.
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