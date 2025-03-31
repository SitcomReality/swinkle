export const notes = `
## Developer Notes - Multiplayer Painter

**Design Goals & Considerations:**
- **Core Gameplay:** Players swing around on bungee cords, leaving paint trails (droplets). Colliding with other players' paint increases a "painted" meter. Reaching 100% painted is a loss condition. Players manage a limited paint supply.
- **Theme:** "xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism" (Dark background, neon highlights). Apply this to characters, paint, UI elements.
- **Character Design:** Big expressive eyes, dangling from a bungee cord attached to the player's cursor. Physics-based limbs enhance the dangle effect.
- **Modularity:** Keep logic separated into manageable files (physics, rendering, game loop, networking).
- **Performance:** Ensure smooth rendering and efficient networking. Use canvas optimally.
- **Developer Notes:** Update this file outlining planned steps and key questions. Focus on small, testable increments. Remember to escape all backticks in these notes.

**Current State & Overview:**
- Multiplayer connection via WebsimSocket is functional. Player joins/leaves handled.
- Player presence includes cursor position (`x`, `y`), color, and potentially other state. Room state used for shared objects.
- Players are rendered as capsules dangling from a bungee cord attached to their cursor position (anchor).
- Bungee and limb physics (spring, gravity, damping, constraints) are implemented in \`player.js\`, providing dynamic movement. Physics state is managed locally per client.
- Character rendering includes body, eyes (local player eyes track cursor), limbs, and username.
- Configuration for physics and appearance is stored in \`config.js\`.
- A basic "squirt" mechanic exists (click to create temporary particles at cursor) using room state - **this will be replaced by the paint droplet system.**
- Basic dev notes system loads this content into the UI.

**Painting Gameplay Plan (Incremental Steps):**

1.  **Player Paint State Management:**
    *   Add core paint properties to player presence (`updatePresence`):
        *   `paintColor`: string (e.g., '#FF00FF'). Assign uniquely on join?
        *   `paintAmount`: number (0-100, represents percentage full). Start at 100.
        *   `paintedData`: object (e.g., `{ "#FF0000": 10, "#00FF00": 5 }`). Stores colors hit by and their percentage contribution. Max total percentage is 100.
        *   `isCharging`: boolean (default false). True when LMB is held down.
        *   `accumulatedDroplets`: number (0-20). Count of droplets stored while charging.
    *   Handle unique `paintColor` assignment (e.g., cycle through a predefined list or generate based on clientId/username).

2.  **Visual Feedback - Paint Meter:**
    *   In `player.js/renderPlayer`: Modify capsule rendering.
    *   Draw the capsule background/fill using the player's `paintColor`.
    *   The fill height should represent `paintAmount` (0% = empty, 100% = full, filling from bottom).

3.  **Visual Feedback - Painted State:**
    *   In `player.js/renderPlayer`: Modify capsule stroke rendering.
    *   Calculate the final stroke color by blending the base stroke color with colors stored in `paintedData` according to their percentages. (E.g., if base is white, and `paintedData` is `{ "red": 10 }`, the stroke is 90% white, 10% red).

4.  **Automatic Paint Droplets:**
    *   In `main.js` or `game-loop.js`: Implement a timer (e.g., `setInterval`).
    *   Every ~250ms, if `isCharging` is false and `paintAmount` > 0:
        *   Get the player's current *body* position from `playerPhysicsStates`.
        *   Create a new droplet object: `{ id, ownerId, color: paintColor, x, y, createdAt }`.
        *   Add the droplet to `room.roomState.squirts` (rename state key to `droplets`?).
        *   Decrement `paintAmount` locally and call `room.updatePresence`.
        *   Handle `paintAmount` depletion (stop dripping when 0).

5.  **Paint Charging & Burst:**
    *   In `main.js`: Add `mousedown` and `mouseup` listeners to the canvas.
    *   `mousedown`:
        *   Set `isCharging = true` in presence.
        *   Start a timer/interval to increment `accumulatedDroplets` (up to 20) while `isCharging` is true and `paintAmount` > 0. Decrement `paintAmount` for each accumulated droplet. Update presence frequently.
    *   `mouseup`:
        *   Set `isCharging = false` in presence.
        *   If `accumulatedDroplets > 0`:
            *   Get current player body position.
            *   Create `accumulatedDroplets` count of droplets in `roomState`, slightly randomized positions around the body position.
            *   Reset `accumulatedDroplets = 0` in presence.

6.  **Droplet Cleanup:**
    *   In `game-loop.js`: Continue removing expired droplets from `roomState` based on `createdAt` and `config.dropletDuration` (new config value).

7.  **Droplet-Player Collision & Painting:**
    *   In `game-loop.js`: Add collision detection logic.
        *   Iterate through all players and all droplets in `roomState`.
        *   Check for collision between a player's body hitbox and droplets where `droplet.ownerId !== player.clientId`.
        *   On collision:
            *   Request presence update for the hit player: `room.requestPresenceUpdate(hitPlayerId, { type: 'paintHit', color: droplet.color, dropletId: droplet.id })`.
            *   Remove the colliding droplet immediately from the local view (optional, for responsiveness) and maybe mark it for removal from roomState in the next update cycle.
    *   In `main.js`: Update `room.subscribePresenceUpdateRequests`.
        *   Handle `paintHit` request:
            *   Check if the target player isn't already 100% painted.
            *   Increment the percentage for the hit `color` in the target player's `paintedData` (add color if new, clamp total percentage at 100).
            *   Call `room.updatePresence` with the updated `paintedData`.
            *   Initiate removal of the `dropletId` from `room.roomState.droplets` (ensure only one client does this, maybe the hit client?).

8.  **Paint Replenishment Mechanic:**
    *   Design: Stationary zones? Pickups? Slow automatic regeneration? Timed events?
    *   Implementation: Add necessary room state objects (e.g., refill zones) or presence logic (regen timer). Update player `paintAmount` accordingly.

**Future Considerations:**
- **Loss Condition:** Implement check for `paintedPercentage` >= 100 and trigger a visual state (e.g., gray out player, display message). Reset mechanism?
- **Paint Mixing:** More sophisticated color blending for the stroke/splatter effects.
- **Visual Polish:** Droplet appearance (splat?), character reactions to getting hit, charge-up animation/indicator, neon glow effects.
- **Environment:** Add simple obstacles or walls? Might require basic physics interactions.
- **Sound Effects:** For dripping, charging, bursting, getting hit, paint refill.
- **UI:** Scoreboard/Leaderboard showing painted percentages.

**Key Questions:**
- How should unique player `paintColor`s be assigned reliably? Predefined list? Hashing username/ID? Derived from avatar?
- What's the most performant way to handle potentially many droplets and player collision checks? Quadtree? Spatial hashing? Simple iteration?
- How should the blended stroke color be calculated precisely when multiple colors are involved in `paintedData`? Average? Additive? Layered?
- What is a fair and fun paint replenishment mechanic? Should it encourage movement or camping?
- How should simultaneous droplet collisions be handled?
- Who should be responsible for removing a droplet from roomState after a hit? The player hit, or the player who fired? (The player hit seems more reliable).
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

