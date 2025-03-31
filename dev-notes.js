export const notes = `
## Developer Notes - Multiplayer Painter

**Design Goals & Considerations:**
- **Core Gameplay:** Players swing around on bungee cords, leaving paint trails (droplets). Colliding with other players' paint increases a "painted" meter. Reaching 100% painted is a loss condition. Players manage a limited paint supply.
- **Theme:** "xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism" (Dark background, neon highlights). Apply this to characters, paint, UI elements.
- **Character Design:** Big expressive eyes, dangling from a bungee cord attached to the player's cursor. Physics-based limbs enhance the dangle effect.
- **Modularity:** Keep logic separated into manageable files (physics, rendering, game loop, networking).
- **Performance & Networking:** Focus on perceived smoothness over strict simulation accuracy. Trust clients for collision detection and state reporting. Design around potential latency by prioritizing local feedback and eventual consistency. Use client-side prediction/rendering where possible (e.g., droplet expiration).
- **Developer Notes:** Update this file outlining planned steps and key questions. Focus on small, testable increments. Remember to escape all backticks in these notes.

**Painting Gameplay Plan (Incremental Steps):**

1.  **Player Paint State Management:**
    *   Add core paint properties to player presence (`updatePresence`):
        *   `paintColor`: string (e.g., '#FF00FF'). Assign uniquely on join from a predefined list of themed colors (cycle through list or use hash/ID).
        *   `paintAmount`: number (0-100, represents percentage full). Start at 100.
        *   `paintedData`: object (e.g., `{ "#FF0000": 10, "#00FF00": 5 }`). Stores colors hit by and their percentage contribution. Max total percentage is 100.
        *   `isCharging`: boolean (default false). True when LMB is held down.
        *   `accumulatedDroplets`: number (0-20). Count of droplets stored while charging.
    *   Need a predefined list of paint colors in `config.js`.
    *   Assign `paintColor` in `main.js` when a player connects (perhaps in `initGame` or presence subscription based on new peers). *Need a mechanism to coordinate color assignment across clients.* A simple approach might be using modulo of the number of peers on the peer list length.

2.  **Visual Feedback - Paint Meter:**
    *   In `player.js/renderPlayer`: Modify capsule rendering.
    *   Draw the capsule background/fill using the player's `paintColor`.
    *   The fill height should represent `paintAmount` (0% = empty, 100% = full, filling from bottom).

3.  **Visual Feedback - Painted State:**
    *   In `player.js/renderPlayer`: Modify capsule stroke rendering.
    *   Calculate the final stroke color by blending the base stroke color with colors stored in `paintedData`. Use a weighted average: `finalColor = (baseColor * (1 - totalPaintedPercent)) + sum(paintedColor * paintedPercent)`. Store the base stroke color in config.

4.  **Automatic Paint Droplets:**
    *   Rename `room.roomState.squirts` to `room.roomState.droplets`. Update references in `main.js` and `game-loop.js`. Ensure initial state is set correctly in `main.js`. Rename `config.squirt*` properties to `config.droplet*`.
    *   In `game-loop.js` (or a dedicated physics/game logic update function): Implement logic tied to the game loop's `deltaTime`.
    *   Maintain a per-player timer (or check elapsed time). Every `config.dropletInterval` ms (e.g., 250ms), if `isCharging` is false and `paintAmount` > 0:
        *   Get the player's current *body* position from `playerPhysicsStates`.
        *   Create a new droplet object: `{ id, ownerId, color: paintColor, x, y, createdAt }`.
        *   Add the droplet to `room.roomState.droplets` via `room.updateRoomState`.
        *   Decrement `paintAmount` locally and call `room.updatePresence`.
        *   Handle `paintAmount` depletion (stop dripping when 0).

5.  **Paint Charging & Burst:**
    *   In `main.js`: Add `mousedown` and `mouseup` listeners to the canvas.
    *   `mousedown`:
        *   Set `isCharging = true` in presence.
        *   Start tracking accumulation time. In the game loop/update function, if `isCharging` is true and `paintAmount` > 0, increment `accumulatedDroplets` (up to `config.maxAccumulatedDroplets`) at a rate defined in `config.js`, decrementing `paintAmount` for each. Update presence frequently.
    *   `mouseup`:
        *   Set `isCharging = false` in presence.
        *   If `accumulatedDroplets > 0`:
            *   Get current player body position.
            *   Create `accumulatedDroplets` count of droplets in `roomState`, slightly randomized positions around the body position. Use `room.updateRoomState`.
            *   Reset `accumulatedDroplets = 0` in presence.

6.  **Droplet Cleanup:**
    *   In `game-loop.js`: All clients visually remove expired droplets.
        *   Iterate through `roomState.droplets`.
        *   If `Date.now() - droplet.createdAt > config.dropletDuration`, stop rendering it locally.
    *   In `main.js` (or game loop): The *owner* of a droplet (or potentially the "host" if we designated one) could be responsible for periodically cleaning up truly expired droplets from `roomState` by sending `null` updates. Given the "trust client" model, relying on client-side visual cleanup might suffice for perceived performance, deferring actual `roomState` cleanup.

7.  **Droplet-Player Collision & Painting (Client-Side):**
    *   In `game-loop.js`: Add client-side collision detection logic.
        *   Iterate through all *other* players' physics states (`playerPhysicsStates`) and all droplets in `roomState.droplets`.
        *   Check for collision between the local player's body hitbox and droplets where `droplet.ownerId !== localClientId`.
        *   On collision:
            *   Immediately stop rendering the colliding droplet locally (visual feedback).
            *   Send a request to *yourself* to update your painted state: `room.requestPresenceUpdate(localClientId, { type: 'paintHit', color: droplet.color, dropletId: droplet.id })`. This seems counter-intuitive, but follows the pattern that only the owner updates their presence. *Alternatively, directly update local presence and call `room.updatePresence`.* Let's try the direct update first for simplicity.
            *   Update local `paintedData`: Increment percentage for the hit `color`, clamp total at 100. Clamp individual color contributions? (Maybe max 50% per color?).
            *   Call `room.updatePresence` with the new `paintedData`.
            *   Send a `roomState` update to remove the droplet: `room.updateRoomState({ droplets: { [droplet.id]: null } })`. (Ensures the droplet is removed for everyone).
    *   No changes needed to `subscribePresenceUpdateRequests` for this specific interaction if we use the direct update method.

8.  **Paint Replenishment Mechanic:**
    *   Design: A single refill zone appears at a random location for a limited time. When it expires, it reappears elsewhere.
    *   Implementation:
        *   Add `refillZone: { x, y, radius, activeUntil }` to `roomState`.
        *   One client (e.g., the one with the "lowest" clientId) is responsible for managing the zone's timer and position updates in `roomState`.
        *   In `game-loop.js`: Render the active zone. Check for collision between the local player's body and the zone.
        *   On collision: If `paintAmount < 100`, start refilling (e.g., +10 paint per second while overlapping). Update presence with new `paintAmount`. Clamp at 100.

**Future Considerations:**
- **Loss Condition:** Implement check for total `paintedData` percentage >= 100 and trigger a visual state (e.g., gray out player, display message "Painted!"). Reset mechanism? Scoreboard reset?
- **Paint Mixing:** More sophisticated color blending for the stroke/splatter effects if desired.
- **Visual Polish:** Droplet appearance (splat?), character reactions to getting hit, charge-up animation/indicator, neon glow effects, refill zone visuals.
- **Environment:** Add simple obstacles or walls? Might require basic physics interactions.
- **Sound Effects:** For dripping, charging, bursting, getting hit, paint refill, zone appearance.
- **UI:** Scoreboard/Leaderboard showing painted percentages. Notifications for zone spawns, players getting painted out.
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

