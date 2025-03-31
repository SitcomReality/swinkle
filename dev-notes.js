export const notes = `
## Developer Notes - Multiplayer Painter

**Design Goals & Considerations:**
- **Core Gameplay:** Players swing around on bungee cords attached to their cursor. They acquire and carry a separate 'paint can' object, also attached via bungee to their player capsule. This can is used to automatically drop paint droplets or release bursts of paint. Players try to paint each other by maneuvering so their opponents collide with their paint droplets. Collision with another player's droplet adds that color to the victim's capsule outline. Reaching 100% painted is a loss condition. Players respawn after a delay. Players without a can can steal one by colliding with a player holding one. Level geometry provides obstacles.
- **Theme:** 'xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism' (Dark background, neon highlights). Apply this to characters, paint cans, paint droplets, UI elements.
- **Character Design:** Player capsule with big expressive eyes, dangling from a bungee cord attached to the cursor. Physics-based limbs enhance the dangle effect. A paint can dangles from the player capsule via another bungee cord. The capsule rotates in response to forces, trying to stay upright. **(Rotation implemented, parameters tuned for stability)**.
- **Modularity:** Keep logic separated (physics, rendering, game loop, networking, interactions, UI).
- **Performance & Networking:** Prioritize perceived smoothness. Trust clients for collision detection and state reporting. Use client-side prediction/rendering where possible (droplet expiration, maybe can physics). Rely on 'roomState' for authoritative positions of cans, droplets, and power-ups, and 'presence' for player anchor/painted state/active power-ups.
- **Developer Notes:** Update this file outlining planned steps and key questions. Remember to escape all backticks in these notes.

**Next Steps:**

- **1. Environment/Level Generation:**
    *1.1-1.8: Done.*
    - 1.9: Power-ups. Eg. Shorter, stiffer or springier bungee between cursor and capsule; temporary shield; acetone (a 'health pickup' that reduces how painted the player is); paint buckets with buffed attributes, like double sized (visually and in terms of paint volume), less viscous (drops faster), and a rare buff that makes every droplet a full burst.
        - 1.9.1: *DONE* - Created basic power-up infrastructure with modules for definition, rendering, and management
        - 1.9.2: *DONE* - Integrated power-up system with game loop for spawning and rendering
        - 1.9.3: *DONE* - Implemented collision detection to collect power-ups
        - 1.9.4: *DONE* - Create active power-up processing system for timed effects
        - 1.9.5: *DONE* - Implement each power-up effect (shield, acetone, spring, mega can)
            - **Acetone:** *DONE* - Instant effect applied on collection.
            - **Shield:** *DONE* - Modified 'collisionHandler.js' to check 'presence.shielded', skip paint application, and add 'blockSpark' effect.
            - **Spring:** *DONE* - Modified 'playerPhysics.js' to check 'presence.springyBungee' and adjust main bungee spring constant.
            - **Mega Can:** *DONE* - Modified 'playerInteractions.js' ('handlePaintCanPickup') to apply effect (double capacity, 'isMega' flag, consume powerup). Modified 'ui-manager.js' and 'paintCan.js' to visually represent the mega can and its capacity.
        - 1.9.6: Add visual effects to indicate active power-ups on players
            - Modify 'playerRenderer.js' to draw indicators (e.g., shield outline, springy bungee visual change, mega-can indicator on player?) based on active power-up flags in presence.

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
    - 3.6: Implement notification system to show transient messages during gameplay events:
        - Power-up collection ("Shield activated!" or "Acetone cleansed your paint!")
        - Player status changes ("Player X got painted out!" or "Player Y respawned!")
        - Player join/leave events ("Player Z joined the game!")
        - Gameplay tips or whimsical messages based on game state
        - This system should support different message priorities, durations, and visual styling
        - Implementation should avoid interfering with other gameplay systems by using a separate rendering layer and state management

**Error Fixes:**
- *DONE* - Fixed error in 'effectsRenderer.js' ('renderStealSpark') where radius could become negative by clamping progress calculation between 0 and 1 and adding checks for non-positive radius/linewidth.
`;

export function loadDevNotes() {
    const container = document.getElementById('dev-notes-container');
    if (container) {
        // Use textContent to avoid HTML injection issues
        // Replace backticks with a similar character or remove them for display
        container.textContent = notes.replace(/\`/g, "'"); // Replace backticks with single quotes for display
        console.log("Dev notes loaded.");
    } else {
        console.error("Dev notes container not found!");
    }
}