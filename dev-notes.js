export const notes = `
## Developer Notes - Multiplayer Painter

**Design Goals & Considerations:**
- **Core Gameplay:** Players swing around on bungee cords attached to their cursor. They acquire and carry a separate "paint can" object, also attached via bungee to their player capsule. This can is used to automatically drop paint droplets or release bursts of paint. Players try to paint each other by maneuvering so their opponents collide with their paint droplets. Collision with another player's droplet adds that color to the victim's capsule outline. Reaching 100% painted is a loss condition. Players must manage the paint in their can and find ways to replenish it by acquiring new cans.
- **Theme:** "xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism" (Dark background, neon highlights). Apply this to characters, paint cans, paint droplets, UI elements.
- **Character Design:** Player capsule with big expressive eyes, dangling from a bungee cord attached to the cursor. Physics-based limbs enhance the dangle effect. A paint can dangles from the player capsule via another bungee cord.
- **Modularity:** Keep logic separated (physics, rendering, game loop, networking).
- **Performance & Networking:** Prioritize perceived smoothness. Trust clients for collision detection and state reporting. Use client-side prediction/rendering where possible (droplet expiration, maybe can physics). Rely on `roomState` for authoritative positions of cans and droplets, and `presence` for player anchor/painted state.
- **Developer Notes:** Update this file outlining planned steps and key questions. Focus on small, testable increments. Remember to escape all backticks in these notes.

**Painting Gameplay Plan (Incremental Steps - NEW DESIGN):**

**1. State Management Setup:** 
    *   **Player Presence (`updatePresence`):**
        *   Keep `x`, `y` (anchor position). 
        *   Keep `color` (player base color). 
        *   *Add:* `paintedData`: object (e.g., `{ "#FF0000": 10, "#00FF00": 5 }`). Starts empty: `{}`. 
        *   *Add:* `currentCanId`: string | null. ID of the paint can object the player currently possesses. Starts `null`. 
    *   **Room State (`updateRoomState`):**
        *   *Rename:* `squirts` to `droplets`. Ensure initial state `{}`. 
        *   *Add:* `paintCans`: object. Stores state for all active paint cans. Initial state `{}`. Structure:
            ```js
            "can-123": {
              id: "can-123",
              ownerId: "client-abc" | null,
              paintColor: "#FF00FF",
              paintAmount: 100,
              x: 300, y: 400, // Position (updated by owner)
              vx: 0, vy: 0,    // Velocity (updated by owner)
              isCharging: false,
              accumulatedDroplets: 0
            }
            ```
        *   *Add:* `availablePaintCans`: object. Stores state for cans not currently held. Initial state `{}`. 
    *   **Config (`config.js`):**
        *   Add `paintCanColors`: Array of hex strings. 
        *   Add physics constants for player-to-can bungee. 
        *   Add paint can appearance properties. 
        *   Add config for charging speed, max accumulated droplets, initial amount. 
        *   Rename squirt config to droplet config. 

**2. Paint Can Physics & Rendering:** 
    *   In `paintCan.js`:
        *   Create `paintCan.js`.
        *   Add function `updatePaintCanPhysics(canState, playerBodyPos, deltaTime)`. Simulates bungee physics connecting the can's position (`canState.x`, `canState.y`) to the player's capsule position (`playerBodyPos`). Use new can bungee constants from `config.js`. Updates `canState.x`, `canState.y`, `canState.vx`, `canState.vy` (returns updated state).
        *   Add function `renderPaintCan(ctx, canState)`. Draws the paint can based on its state (position, color). (Visualising `paintAmount` comes later).
    *   Modify `game-loop.js`:
        *   Import functions from `paintCan.js`.
        *   In the physics update section: Iterate through `room.roomState.paintCans`. If a can's `ownerId` matches the `localClientId`, fetch the owner's player capsule position (from the already calculated physics state in `playerPhysicsStates`), call `updatePaintCanPhysics`, and send a `room.updateRoomState` to update that can's `x, y, vx, vy` in `paintCans`.
        *   Add a rendering loop: Iterate through `room.roomState.paintCans` and `room.roomState.availablePaintCans` and call `renderPaintCan` for each. Ensure held cans are drawn *after* their owner player's body/limbs but potentially before other players (z-index).

**3. Droplet Generation from Can:**
    *   Modify automatic droplet logic (`game-loop.js` or dedicated function in `paintCan.js`):
        *   Only players with a `currentCanId` can drop paint (check owner's presence).
        *   Check runs based on the *can's owner*.
        *   If can state `isCharging` is false and `paintAmount` > 0:
            *   Get the *paint can's* current position (from `roomState`).
            *   Create droplet using the can's `paintColor` and position. Add to `room.roomState.droplets`.
            *   Owner sends `room.updateRoomState` to decrement `paintAmount` in the *can's state*.
    *   Modify paint burst logic (`main.js` mousedown/mouseup):
        *   Listeners check if the local player has a `currentCanId`.
        *   `mousedown`: Owner sends `room.updateRoomState` to set `isCharging = true` on their can. Start client-side timer/logic to accumulate droplets. Periodically, owner sends `room.updateRoomState` to increment `accumulatedDroplets` and decrement `paintAmount` on their can (respecting `config.paintCanChargingSpeed` and `config.paintCanMaxAccumulatedDroplets`).
        *   `mouseup`: Owner sends `room.updateRoomState` to set `isCharging = false`. If `accumulatedDroplets > 0`:
            *   Get can position from `roomState`.
            *   Create burst of droplets using can color/position. Add to `room.roomState.droplets`.
            *   Owner sends `room.updateRoomState` to reset `accumulatedDroplets = 0` on their can.

**4. Visual Feedback Updates:**
    *   **Player Capsule Stroke:** In `player.js/renderPlayer`: Modify capsule stroke rendering. Calculate the final stroke color by blending the base stroke color (from config) with colors stored in the player's `presence.paintedData`. Use a weighted average based on percentages.
    *   **Paint Can Amount:** In `renderPaintCan`: Visually represent the `canState.paintAmount` (e.g., fill level, color intensity).

**5. Paint Can Replenishment:**
    *   **Mechanism:** Refill zones spawn `availablePaintCans` in `roomState`.
    *   **Zone Management:** One client ("host"? or simple timer?) manages spawning cans into `room.roomState.availablePaintCans` at predefined locations. Cans should have a random `paintColor` from `config.paintCanColors` and `paintAmount: config.paintCanInitialAmount`.
    *   **Pickup Logic:**
        *   In `game-loop.js`: Client-side collision check between local player *capsule* and cans in `availablePaintCans`.
        *   On collision:
            *   If local player `presence.currentCanId` is `null`:
                *   Send `room.updateRoomState` to move the collided can from `availablePaintCans` (set to `null`) to `paintCans`, setting its `ownerId` to the local client ID. *Crucially: this update needs to be atomic or handle races*. Maybe use a request mechanism? For now, try direct update.
                *   Send `room.updatePresence` to set `currentCanId` to the picked-up can's ID.
            *   If player already has a can: Ignore the new one.
    *   **Dropping/Losing Cans:** When `paintAmount` hits 0, the owner sends `room.updateRoomState` to move the can from `paintCans` back to `availablePaintCans` (or delete it?), setting `ownerId = null`. Owner also sends `room.updatePresence({ currentCanId: null })`.

**6. Droplet Collision & Painting:**
    *   In `game-loop.js`: Client-side collision detection.
        *   Iterate through local player's *capsule* physics state and all droplets in `roomState.droplets`.
        *   Check for collision between capsule hitbox and droplets where `droplet.ownerId !== localClientId`.
        *   On collision:
            *   Stop rendering the droplet locally immediately.
            *   Update local `paintedData`: Fetch current presence, increment percentage for the hit `color`, clamp total at 100.
            *   Call `room.updatePresence` with the new `paintedData`.
            *   Send a `roomState` update to remove the droplet: `room.updateRoomState({ droplets: { [droplet.id]: null } })`.

**7. Droplet Cleanup:**
    *   Client-side: Visually remove expired droplets based on `createdAt` and `config.dropletDuration`.
    *   Authoritative Removal: The *client that detected the hit* (Step 6) removes the droplet from `roomState`. For timeout, rely on client-side visual removal. Maybe add periodic cleanup by a "host" client for robustness if needed.

**Future Considerations:**
- **Loss Condition:** Implement check for total `paintedData` percentage >= 100.
- **Visual Polish:** Can appearance variations, droplet splats, charge indicators, zone visuals.
- **Sound Effects:** Dripping, bursting, hitting, pickup, empty can drop.
- **UI:** Scoreboard, zone notifications.
- **Can Interaction:** Stealing cans? Throwing cans?
`;

export function loadDevNotes() {
    const container = document.getElementById('dev-notes-container');
    if (container) {
        container.textContent = notes.replace(/`/g, '\\`');
        console.log("Dev notes loaded.");
    } else {
        console.error("Dev notes container not found!");
    }
}