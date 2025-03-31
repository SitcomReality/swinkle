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

1.  **State Management Setup:**
    *   **Player Presence (`updatePresence`):**
        *   Keep `x`, `y` (anchor position).
        *   Keep `color` (player base color, potentially used for identification/UI).
        *   *Add:* `paintedData`: object (e.g., `{ "#FF0000": 10, "#00FF00": 5 }`). Stores colors hit by and their percentage contribution (max total 100). Used for capsule stroke color. Starts empty: `{}`.
        *   *Add:* `currentCanId`: string | null. ID of the paint can object the player currently possesses. Starts `null`.
        *   *Remove:* `paintAmount`.
        *   *Consider later:* `isCharging`, `accumulatedDroplets` - These might belong to the can's state.
    *   **Room State (`updateRoomState`):**
        *   *Rename:* `squirts` to `droplets`. Ensure initial state `{}`.
        *   *Add:* `paintCans`: object. Stores state for all active paint cans in the game. Example entry:
            ```js
            "can-123": {
              id: "can-123",
              ownerId: "client-abc" | null, // Client holding the can, null if unheld
              paintColor: "#FF00FF",
              paintAmount: 100, // Current paint level (0-100)
              // Physics state - managed client-side by owner? Or synced via roomState?
              // Let's start simple: Owner updates can position/velocity in roomState.
              x: 300,
              y: 400,
              vx: 0, // Velocity x
              vy: 0, // Velocity y
              // Charging state - managed by owner via roomState updates
              isCharging: false,
              accumulatedDroplets: 0
            }
            ```
        *   *Add:* `availablePaintCans`: object. Stores state for cans *not* currently held by a player, available for pickup. Similar structure to `paintCans` entries, but `ownerId` is `null`.
    *   **Config (`config.js`):**
        *   Add `paintCanColors`: Array of predefined hex color strings.
        *   Add physics constants for the player-to-can bungee.
        *   Add paint can appearance properties (size, shape).
        *   Add config for charging speed, max accumulated droplets.

2.  **Paint Can Physics & Rendering:**
    *   In `player.js` (or a new `paintCan.js`? Let's keep in `player.js` for now):
        *   Add function `updatePaintCanPhysics(canState, playerBodyPos, deltaTime)`. Simulates bungee physics connecting the can's position (`canState.x`, `canState.y`) to the player's capsule position (`playerBodyPos`). Needs its own bungee constants (rest length, spring K, damping, mass) from `config.js`. Updates `canState.x`, `canState.y`, `canState.vx`, `canState.vy`.
        *   Modify `updatePlayerPhysics`: If the player has a `currentCanId` (from presence), fetch the corresponding can's state from `room.roomState.paintCans`. Call `updatePaintCanPhysics` using the player's calculated body position as the anchor point for the can's bungee. The owner of the can should send `room.updateRoomState` with the updated can physics values (`x`, `y`, `vx`, `vy`). *Optimization: Maybe only send position updates periodically, owner simulates physics locally? Start with sending updates.*
    *   In `player.js` (or `paintCan.js`): Add function `renderPaintCan(ctx, canState)`. Draws the paint can based on its state (position, color, potentially visualising `paintAmount`).
    *   In `game-loop.js`:
        *   Inside the player rendering loop, if `presence.currentCanId` exists, find the can in `room.roomState.paintCans` and call `renderPaintCan`.
        *   Add a loop to render `availablePaintCans` from `roomState`.
        *   The owner client is responsible for running `updatePaintCanPhysics` and sending updates. Non-owners just render based on `roomState`.

3.  **Droplet Generation from Can:**
    *   Modify automatic droplet logic (`game-loop.js` or dedicated function):
        *   Only players with a `currentCanId` can drop paint.
        *   Check runs based on the *can's owner*.
        *   If not `isCharging` (read from the can's state in `roomState`) and `paintAmount` > 0 (from can state):
            *   Get the *paint can's* current position (from `roomState`).
            *   Create droplet using the can's `paintColor` and position. Add to `room.roomState.droplets`.
            *   Decrement `paintAmount` in the *can's state* and update it via `room.updateRoomState({ paintCans: { [canId]: { paintAmount: newAmount } } })`.
    *   Modify paint burst logic (`main.js` mousedown/mouseup):
        *   Listeners check if the player has a `currentCanId`.
        *   `mousedown`: Owner sends `room.updateRoomState` to set `isCharging = true` on their can. Start client-side timer/logic to accumulate droplets. Periodically, owner sends `room.updateRoomState` to increment `accumulatedDroplets` and decrement `paintAmount` on their can.
        *   `mouseup`: Owner sends `room.updateRoomState` to set `isCharging = false`. If `accumulatedDroplets > 0`:
            *   Get can position from `roomState`.
            *   Create burst of droplets using can color/position. Add to `room.roomState.droplets`.
            *   Owner sends `room.updateRoomState` to reset `accumulatedDroplets = 0` on their can.

4.  **Visual Feedback Updates:**
    *   **Player Capsule Stroke:** In `player.js/renderPlayer`: Modify capsule stroke rendering. Calculate the final stroke color by blending the base stroke color (from config) with colors stored in the player's `presence.paintedData`. Use a weighted average based on percentages.
    *   **Paint Can Amount:** In `renderPaintCan`: Visually represent the `canState.paintAmount` (e.g., fill level, color intensity).

5.  **Paint Can Replenishment:**
    *   **Mechanism:** Refill zones spawn `availablePaintCans` in `roomState`.
    *   **Zone Management:** One client ("host"?) manages refill zone timers and spawning cans into `room.roomState.availablePaintCans` at the zone location. Cans should have a random `paintColor` from `config.paintCanColors` and `paintAmount: 100`.
    *   **Pickup Logic:**
        *   In `game-loop.js`: Client-side collision check between local player *capsule* and cans in `availablePaintCans`.
        *   On collision:
            *   If player `currentCanId` is `null`:
                *   Send `room.updateRoomState` to move the collided can from `availablePaintCans` to `paintCans`, setting its `ownerId` to the local client ID.
                *   Send `room.updatePresence` to set `currentCanId` to the picked-up can's ID.
            *   If player already has a can (`currentCanId` is not `null`): Maybe drop the old can? Or ignore the new one? *Design decision: Let's start with: cannot pick up a new can if already holding one.*
    *   **Dropping/Losing Cans:** How does a player get rid of an empty can? Maybe automatically dropped when `paintAmount` reaches 0? Or a specific action? *Design decision: Start with auto-drop when empty.* When `paintAmount` hits 0, the owner sends `room.updateRoomState` to move the can from `paintCans` back to `availablePaintCans` (or maybe just delete it?) and sets `ownerId = null`. Owner also sends `room.updatePresence({ currentCanId: null })`.

6.  **Droplet Collision & Painting:**
    *   In `game-loop.js`: Client-side collision detection.
        *   Iterate through local player's *capsule* physics state and all droplets in `roomState.droplets`.
        *   Check for collision between capsule hitbox and droplets where `droplet.ownerId !== localClientId`. (Ensure droplet has owner info).
        *   On collision:
            *   Stop rendering the droplet locally.
            *   Update local `paintedData`: Increment percentage for the hit `color`, clamp total at 100.
            *   Call `room.updatePresence` with the new `paintedData`.
            *   Send a `roomState` update to remove the droplet: `room.updateRoomState({ droplets: { [droplet.id]: null } })`.

7.  **Droplet Cleanup:**
    *   Client-side: Visually remove expired droplets based on `createdAt` and `config.dropletDuration`.
    *   Server-side / Authoritative Removal: The *client that detected the hit* (Step 6) removes the droplet from `roomState`. For timeout, perhaps the "host" client periodically cleans up old droplets from `roomState`. *Simpler approach: Trust clients to remove on hit. Rely on client-side visual removal for timeout.*

**Future Considerations:**
- **Loss Condition:** Implement check for total `paintedData` percentage >= 100.
- **Visual Polish:** Can appearance, droplet splats, charge indicators, zone visuals.
- **Sound Effects:** Dripping, bursting, hitting, pickup, empty can drop.
- **UI:** Scoreboard, zone notifications.
- **Can Interaction:** Stealing cans? Throwing cans?
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