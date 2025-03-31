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

**Painting Gameplay Plan (Incremental Steps - NEW DESIGN):**

**1. State Management Setup:** (DONE)
    *   **Player Presence (updatePresence):**
        *   Kept 'x', 'y' (anchor position).
        *   Kept 'color' (player base color).
        *   *Added:* 'paintedData': object (e.g., '{'#FF0000': 10, '#00FF00': 5}'). Starts empty: '{}'.
        *   *Added:* 'currentCanId': string | null. ID of the paint can object the player currently possesses. Starts 'null'.
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

**5. Paint Can Replenishment:** (NEXT)
    *   **Mechanism:** Refill zones or random spawning of 'availablePaintCans' in 'roomState'.
    *   **Zone Management:** One client ('host'? First joined? Simplest: random timer on each client, only update if can doesn't exist) manages spawning cans into 'room.roomState.availablePaintCans' at predefined locations or random positions. Cans should have a random 'paintColor' from 'config.paintCanColors' and 'paintAmount: config.paintCanInitialAmount'. Include 'x, y, vx: 0, vy: 0, ownerId: null'.
    *   **Pickup Logic:**
        *   In 'game-loop.js' (physics update section, or maybe 'playerInteractions.js'?): Client-side collision check between local player *capsule* position ('playerPhysicsState.position') and center of cans in 'availablePaintCans' using 'config.paintCanPickupDistance'.
        *   On collision:
            *   If local player 'presence.currentCanId' is 'null':
                *   Send 'room.updateRoomState' attempting to claim the can. Needs mechanism to handle races. Simplest:
                    1. Read can state from 'availablePaintCans'.
                    2. Send update: '{ availablePaintCans: { [canId]: null }, paintCans: { [canId]: { ...canState, ownerId: localClientId } } }'.
                *   *After* confirmation (e.g., next state sync shows ownerId matches): Send 'room.updatePresence({ currentCanId: canId })'.
            *   If player already has a can: Ignore the new one.
    *   **Dropping/Losing Cans:** When 'paintAmount' hits 0, the owner sends 'room.updateRoomState' to set the can's 'ownerId = null' and move it back to 'availablePaintCans' (requires position reset) or just delete from 'paintCans' if empty cans disappear. Owner also sends 'room.updatePresence({ currentCanId: null })'. Handle disconnects (partially done in 'main.js' presence handler).

**6. Droplet Collision & Painting:**
    *   In 'game-loop.js' (after physics updates, or new collision module): Client-side collision detection.
        *   Iterate through local player's *capsule* physics state ('playerPhysicsState.position' and body dimensions) and all droplets in 'roomState.droplets'.
        *   Check for collision between capsule hitbox and droplets where 'droplet.ownerId !== localClientId'.
        *   On collision:
            *   Stop rendering the droplet locally immediately (or mark as hit).
            *   Update local 'paintedData': Fetch current presence, increment percentage for the hit 'color' (e.g., +2% per droplet), clamp total at 100.
            *   Call 'room.updatePresence' with the new 'paintedData'.
            *   Send a 'roomState' update to remove the droplet: 'room.updateRoomState({ droplets: { [droplet.id]: null } })'. (Trust client reporting).

**7. Droplet Cleanup:**
    *   Client-side: Visually remove expired droplets based on 'createdAt' and 'config.dropletDuration' during rendering loop (fade out implemented in 'dropletRenderer.js').
    *   Authoritative Removal: The *client that detected the hit* (Step 6) removes the droplet from 'roomState'. Timeout removal is currently not performed authoritatively (clients just stop rendering). Needs review if state bloats.

**Future Considerations:**
- **Loss Condition:** Implement check for total 'paintedData' percentage >= 100.
- **Visual Polish:** Can appearance variations, droplet splats, charge indicators, zone visuals.
- **Sound Effects:** Dripping, bursting, hitting, pickup, empty can drop.
- **UI:** Scoreboard, paint level indicator, zone notifications.
- **Can Interaction:** Stealing cans? Throwing cans?
- **Networking Robustness:** Improve handling of state update races (e.g., can pickup, disconnects).
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