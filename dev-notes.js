/**
 * dev-notes.js
 * Contains developer notes and plans for the project.
 * Loads notes into the UI.
 * Remember to escape backticks!
 */
export const notes = `
## Developer Notes - Multiplayer Painter

**Design Goals & Considerations:**
- **Core Gameplay:** Players swing around on bungee cords attached to their cursor. They acquire and carry a separate 'paint can' object, also attached via bungee to their player capsule. This can is used to automatically drop paint droplets or release bursts of paint. Players try to paint each other by maneuvering so their opponents collide with their paint droplets. Collision with another player's droplet adds that color to the victim's capsule outline. Reaching 100% painted is a loss condition. Players respawn after a delay. Players without a can can steal one by colliding with a player holding one. Level geometry provides obstacles.
- **Theme:** 'xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism' (Dark background, neon highlights). Apply this to characters, paint cans, paint droplets, UI elements.
- **Character Design:** Player capsule with big expressive eyes, dangling from a bungee cord attached to the cursor. Physics-based limbs enhance the dangle effect. A paint can dangles from the player capsule via another bungee cord. The capsule rotates in response to forces, trying to stay upright.
- **Modularity:** Keep logic separated (physics, rendering, game loop, networking, interactions, UI).
- **Performance & Networking:** Prioritize perceived smoothness. Trust clients for collision detection and state reporting. Use client-side prediction/rendering where possible (droplet expiration, maybe can physics). Rely on 'roomState' for authoritative positions of cans, droplets, and power-ups, and 'presence' for player anchor/painted state/active power-ups.
- **Developer Notes:** Update this file outlining planned steps and key questions. Remember to escape all backticks in these notes.

**Next Steps:**

- **1. Notification System Implementation:**
    - *DONE* - 1.1: Create the basic notification manager module (notification-manager.js). Define functions to add/remove/update notifications and the basic structure of a notification object (id, message, type, startTime, duration).
    - *DONE* - 1.2: Implement basic rendering logic in notification-manager.js to display notifications (e.g., simple text boxes at a fixed position, perhaps fading in/out based on progress).
    - *DONE* - 1.3: Integrate the notification manager's update and render calls into game-loop.js.
    - *DONE* - 1.4: Add triggers in power-up-manager.js (checkPowerUpCollisions) to call the notification manager when a power-up is collected.
    - *DONE* - 1.5: Add triggers in collisionHandler.js (checkCollisionsWithPlayer) when a player is painted out, and in respawn-manager.js (checkPlayerRespawn) when a player respawns.
    - *NEXT* - 1.6: Add triggers for player join/leave events. This likely involves modifying the presence subscription in main.js or potentially adding logic to peer-manager.js and calling the notification manager from there.
    - 1.7: Add styling for different notification types in style.css.
    - 1.8: Add logic for occasional whimsical/tip messages (maybe triggered randomly in the game loop or based on simple conditions like low paint).

- **2. Better Score Tracking:** Reward players for painting other players. (Requires tracking who painted whom).

- **3. Polish & Refinement:**
    - 3.1: Sound effects.
    - 3.2: More visual effects (e.g., player respawn animation).
    - 3.3: Add player avatars to scoreboard/game.
    - 3.4: Continue tuning player rotation physics (inertia, damping, uprighting strength, bungee torque factor) for desired feel. Collision-based torque could also be added.

- **4. Future Ideas/Stretch Goals:**
    - Environmental hazards? (Moving platforms, laser grids?). Support for polygon obstacles.
    - Optimize rendering and physics.
`;

export function loadDevNotes() {
    const container = document.getElementById('dev-notes-container');
    if (container) {
        // Use textContent to avoid HTML injection issues
        // Replace backticks with a similar character or remove them for display
        container.textContent = notes.replace(/\\\`/g, "'"); // Replace backticks with single quotes for display
        console.log("Dev notes loaded.");
    } else {
        console.error("Dev notes container not found!");
    }
}