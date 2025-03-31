export const notes = `
## Developer Notes - Multiplayer Painter

**Design Goals & Considerations:**
- **Core Gameplay:** Players swing around on bungee cords attached to their cursor. They acquire and carry a separate 'paint can' object, also attached via bungee to their player capsule. This can is used to automatically drop paint droplets or release bursts of paint. Players try to paint each other by maneuvering so their opponents collide with their paint droplets. Collision with another player's droplet adds that color to the victim's capsule outline. Reaching 100% painted is a loss condition. Players must manage the paint in their can and find ways to replenish it by acquiring new cans.
- **Theme:** 'xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism' (Dark background, neon highlights). Apply this to characters, paint cans, paint droplets, UI elements.
- **Character Design:** Player capsule with big expressive eyes, dangling from a bungee cord attached to the cursor. Physics-based limbs enhance the dangle effect. A paint can dangles from the player capsule via another bungee cord.
- **Modularity:** Keep logic separated (physics, rendering, game loop, networking, interactions).
- **Performance & Networking:** Prioritize perceived smoothness. Trust clients for collision detection and state reporting. Use client-side prediction/rendering where possible (droplet expiration, maybe can physics). Rely on 'roomState' for authoritative positions of cans and droplets, and 'presence' for player anchor/painted state.
- **Developer Notes:** Update this file outlining planned steps and key questions. Focus on small, testable increments. Remember to escape all backticks in these notes.

**Refactoring Note (Post Step 4):**
*   Refactored 'game-loop.js' to delegate more responsibilities.
*   Created 'playerInteractions.js' to handle paint can charging/auto-dropping logic initiated by the local player.
*   Created 'dropletRenderer.js' to handle rendering of all droplets.
*   Moved held paint can rendering and its bungee cord logic into 'playerRenderer.js'.
*   'game-loop.js' now focuses on the core loop timing, canvas setup, peer disconnect checks, calling physics updates, calling interaction handling, batching state updates, and calling render functions for different scene elements.
*   Further refactoring split player.js into playerState.js, playerPhysics.js, and playerRenderer.js with player.js now acting as a facade.

**Painting Gameplay Plan (Incremental Steps - NEW DESIGN):**

**1. State Management Setup:** (DONE)
    *   **Player Presence (updatePresence):**
        *   Kept 'x', 'y' (anchor position).
        *   Kept 'color' (player base color).
        *   *Added:* 'paintedData': object (e.g., '{'#FF0000': 10, '#00FF00': 5}'). Starts empty: '{}'.
        *   *Added:* 'currentCanId': string | null. ID of the paint can object the player currently possesses. Starts 'null'.
        *   *Added:* 'lost': boolean. Whether the player has lost the game. Starts 'false'.
    *   **Room State (updateRoomState):**
        *   *Renamed:* 'squirts' to 'droplets'. Ensured initial state '{}'. Droplets have 'id', 'ownerId', 'color', 'x', 'y', 'createdAt'.
        *   *Added:* 'paintCans': object. Stores state for all active paint cans. Initial state '{}'. Structure:
            'can-123': {
              id: 'can-123',
              ownerId: 'client-abc' | null,
              paintColor: '#FF00FF',
              paintAmount: 100,
              x: 300, y: 400, // Position (updated by owner)
              vx: 0, vy: 0,    // Velocity (updated by owner)
              isCharging: false,
              accumulatedDroplets: 0
            }
        *   *Added:* 'availablePaintCans': object. Stores state for cans not currently held. Initial state '{}'.
    *   **Config (config.js):**
        *   Added 'paintCanColors': Array of hex strings.
        *   Added physics constants for player-to-can bungee.
        *   Added paint can appearance properties.
        *   Added config for charging speed, max accumulated droplets, initial amount, auto drop rate.
        *   Renamed squirt config to droplet config. Added droplet duration.

**2. Paint Can Physics & Rendering:** (DONE)
    *   Created 'paintCan.js':
        *   Added function 'updatePaintCanPhysics(canState, playerBodyPos, deltaTime)'. Simulates bungee physics connecting the can's position ('canState.x', 'y') to the player's capsule position ('playerBodyPos'). Uses new can bungee constants from 'config.js'. Updates 'canState.x', 'y', 'vx', 'vy'.
        *   Added function 'renderPaintCan(ctx, canState)'. Draws the paint can based on its state (position, color). Includes visual representation of 'paintAmount'.
    *   Modified 'game-loop.js' (now delegated):
        *   Imports functions from 'paintCan.js'.
        *   In the physics update section: Iterates through players. If a player owns a can and it's the 'localClientId', fetches the owner's player capsule position (from 'player.js/getPlayerPhysicsState'), calls 'updatePaintCanPhysics', and adds the updated 'x, y, vx, vy' to a batch update object for 'room.roomState.paintCans'.
        *   Rendering loop (now partially delegated): Iterates through 'room.roomState.availablePaintCans' and calls 'renderPaintCan'. Held cans are now rendered within 'playerRenderer.js'.

**3. Droplet Generation from Can:** (DONE - Logic moved)
    *   Modified automatic droplet logic (now in 'playerInteractions.js/handleCanInteractions'):
        *   If can state 'isCharging' is false and 'paintAmount' > 0:
            *   Uses a timer/rate limit ('config.paintCanAutoDropRate' and 'deltaTime') to generate droplet data.
            *   Creates droplet object using the can's 'paintColor' and current position. Includes 'ownerId'.
            *   Returns droplet object(s) to be added to 'room.roomState.droplets' via 'updateRoomState' in 'game-loop.js'.
            *   Returns updates to decrement 'paintAmount' in the can's state update batch.
    *   Modified paint burst logic ('main.js' mousedown/mouseup & 'playerInteractions.js'):
        *   'mousedown': Owner sends 'room.updateRoomState' to set 'isCharging = true' on their can.
        *   'playerInteractions.js': If charging, calculates paint consumption and potential droplet accumulation based on 'deltaTime' and 'config.paintCanChargingSpeed'. Returns updates for 'accumulatedDroplets' and 'paintAmount' for the batch update (respecting 'config.paintCanMaxAccumulatedDroplets').
        *   'mouseup': Owner sends 'room.updateRoomState' to set 'isCharging = false'. If 'accumulatedDroplets > 0' (read from can state):
            *   Creates burst of droplets (multiple additions to 'roomState.droplets' in one update from 'main.js'). Uses can color and position with slight spread. Includes 'ownerId'.
            *   Owner sends 'room.updateRoomState' to reset 'accumulatedDroplets = 0' on their can.

**4. Visual Feedback Updates:** (DONE - Refactored Location)
    *   **Player Capsule Stroke:** In 'playerRenderer.js/renderPlayer': Modified capsule stroke rendering. Calculates the final stroke color by blending the base stroke color (from config) with colors stored in the player's 'presence.paintedData'. Uses a weighted average based on percentages.
    *   **Paint Can Amount:** (DONE in Step 2 'renderPaintCan') Visually represent the 'canState.paintAmount' (fill level rectangle inside the can).
    *   **Held Can Rendering:** (Moved to 'playerRenderer.js') Held cans and their bungees are now drawn as part of the player rendering process.
    *   **Droplet Rendering:** (Moved to 'dropletRenderer.js') Handles drawing and fading of droplets.

**5. Paint Can Replenishment:** (DONE)
    *   **Mechanism:** Implemented random spawning of 'availablePaintCans' in 'roomState' with a low probability each frame.
    *   **Paint Can Spawning:** Added logic to 'game-loop.js' for randomly creating new paint cans in the visible area with a 0.5% chance per frame, limited to 3 available cans at a time.
    *   **Pickup Logic:** Added to 'playerInteractions.js' and called from 'game-loop.js':
        *   Implemented 'handlePaintCanPickup' function that performs client-side collision check between local player capsule position and centers of available cans using 'config.paintCanPickupDistance'.
        *   On collision, generates updates to:
            1. Remove can from 'availablePaintCans'
            2. Add can to 'paintCans' with the player as the owner
            3. Update player presence with 'currentCanId'
        *   Only allows players who have not lost the game to pick up paint cans.
    *   **Empty Can Handling:** Added to 'playerInteractions.js' and called from 'game-loop.js':
        *   Implemented 'handleEmptyPaintCan' function that checks if a player's current can is empty.
        *   When empty, generates updates to:
            1. Remove the can from 'paintCans'
            2. Update player presence to set 'currentCanId' to null
    *   **Updates Batching:** Enhanced 'game-loop.js' to collect, merge, and send batched updates for:
        *   Paint can physics and interactions
        *   Available paint can additions/removals
        *   Local player presence updates

**6. Droplet Collision & Painting:** (DONE)
    *   Created 'collisionHandler.js':
        *   Implemented 'checkCollisionsWithPlayer' function for client-side collision detection.
        *   Uses a simple rectangular hitbox for the player capsule and circular hitbox for droplets.
        *   Checks for collisions only with droplets not owned by the local player.
        *   On collision:
            *   Increments the percentage for the hit color in the player's 'paintedData'.
            *   Updates the player's presence with the new 'paintedData'.
            *   Marks the droplet for removal from roomState.
            *   Includes a basic check for the 100% painted loss condition and updates the player's 'lost' state to 'true'.
            *   Renders "PAINTED OUT!" message above lost players.
    *   Modified 'game-loop.js':
        *   Added collision detection in the update cycle after physics and interaction updates.
        *   Gets the local player's body position and passes it to the collision handler.
        *   Sends roomState updates to remove collided droplets.
    *   Modified 'main.js':
        *   Exported the room instance for use by the collision handler.

**7. Droplet Cleanup:** (DONE)
    *   Client-side: Visually remove expired droplets based on 'createdAt' and 'config.dropletDuration' during rendering loop (fade out implemented in 'dropletRenderer.js').
    *   Authoritative Removal (Collisions): The *client that detected the hit* removes the droplet from 'roomState'.
    *   Authoritative Removal (Timeout): The local client checks all droplets each frame. If a droplet's age exceeds 'config.dropletDuration', the local client sends an update to remove it from 'roomState'. This prevents indefinite growth of the droplet state but may cause redundant updates if multiple clients detect the same timeout simultaneously. Potential optimization: assign responsibility based on ownerId or clientId hash.

**8. Multiplayer Integration:** (DONE)
    *   Modified the codebase to properly use WebsimSocket for multiplayer functionality:
        *   Exported the room instance from main.js so it can be accessed by other modules.
        *   Removed the passed roomInstance parameter from game-loop.js, using the imported room instance instead.
        *   Updated collisionHandler.js to import the room instance.
        *   Ensured all modules that need access to the room instance import it directly.
        *   Established proper peer tracking and subscription to presence updates.
        *   Room instance now manages all shared state (paintCans, droplets, player positions).

**Future Considerations:**
- **Visual Polish:** Can appearance variations, droplet splats, charge indicators, zone visuals.
- **Sound Effects:** Dripping, bursting, hitting, pickup, empty can drop.
- **UI:** Scoreboard, paint level indicator, zone notifications.
- **Can Interaction:** Stealing cans? Throwing cans?
- **Networking Robustness:** Improve handling of state update races (e.g., can pickup, disconnects, droplet timeout removal).
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