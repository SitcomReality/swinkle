export const notes = `
## Developer Notes - Multiplayer Painter

**Design Goals & Considerations:**
- **Core Gameplay:** Players swing around on bungee cords attached to their cursor. They acquire and carry a separate "paint can" object, also attached via bungee to their player capsule. This can is used to automatically drop paint droplets or release bursts of paint. Players try to paint each other by maneuvering so their opponents collide with their paint droplets. Collision with another player's droplet adds that color to the victim's capsule outline. Reaching 100% painted is a loss condition. Players must manage the paint in their can and find ways to replenish it by acquiring new cans.
- **Theme:** "xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism" (Dark background, neon highlights). Apply this to characters, paint cans, paint droplets, UI elements.
- **Character Design:** Player capsule with big expressive eyes, dangling from a bungee cord attached to the cursor. Physics-based limbs enhance the dangle effect. A paint can dangles from the player capsule via another bungee cord.
- **Modularity:** Keep logic separated (physics, rendering, game loop, networking).
- **Performance & Networking:** Prioritize perceived smoothness. Trust clients for collision detection and state reporting. Use client-side prediction/rendering where possible (droplet expiration, maybe can physics). Rely on \`roomState\` for authoritative positions of cans and droplets, and \`presence\` for player anchor/painted state.
- **Developer Notes:** Update this file outlining planned steps and key questions. Focus on small, testable increments. Remember to escape all backticks in these notes.

**Painting Gameplay Plan (Incremental Steps - NEW DESIGN):**

**1. State Management Setup:** (DONE)
    *   **Player Presence (\`updatePresence\`):**
        *   Keep \`x\`, \`y\` (anchor position).
        *   Keep \`color\` (player base color).
        *   *Added:* \`paintedData\`: object (e.g., \`{ "#FF0000": 10, "#00FF00": 5 }\`). Starts empty: \`{}\`.
        *   *Added:* \`currentCanId\`: string | null. ID of the paint can object the player currently possesses. Starts \`null\`.
    *   **Room State (\`updateRoomState\`):**
        *   *Renamed:* \`squirts\` to \`droplets\`. Ensured initial state \`{}\`.
        *   *Added:* \`paintCans\`: object. Stores state for all active paint cans. Initial state \`{}\`. Structure:
            \`\`\`js
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
            \`\`\`
        *   *Added:* \`availablePaintCans\`: object. Stores state for cans not currently held. Initial state \`{}\`.
    *   **Config (\`config.js\`):**
        *   Added \`paintCanColors\`: Array of hex strings.
        *   Added physics constants for player-to-can bungee.
        *   Added paint can appearance properties.
        *   Added config for charging speed, max accumulated droplets, initial amount.
        *   Renamed squirt config to droplet config.

**2. Paint Can Physics & Rendering:** (DONE)
    *   In \`paintCan.js\`:
        *   Created \`paintCan.js\`.
        *   Added function \`updatePaintCanPhysics(canState, playerBodyPos, deltaTime)\`. Simulates bungee physics connecting the can's position (\`canState.x\`, \`canState.y\`) to the player's capsule position (\`playerBodyPos\`). Uses new can bungee constants from \`config.js\`. Updates \`canState.x\`, \`y\`, \`vx\`, \`vy\`.
        *   Added function \`renderPaintCan(ctx, canState)\`. Draws the paint can based on its state (position, color). (Visualising \`paintAmount\` comes later).
    *   Modified \`game-loop.js\`:
        *   Imported functions from \`paintCan.js\`.
        *   In the physics update section: Iterated through \`room.roomState.paintCans\`. If a can's \`ownerId\` matches the \`localClientId\`, fetched the owner's player capsule position (from \`player.js/getPlayerPhysicsState\`), called \`updatePaintCanPhysics\`, and sent a \`room.updateRoomState\` to update that can's \`x, y, vx, vy\` in \`paintCans\`.
        *   Added rendering loop: Iterate through \`room.roomState.paintCans\` and \`availablePaintCans\` and call \`renderPaintCan\` for each. Ensured held cans are drawn *after* their owner player's body/limbs, including rendering the player-to-can bungee cord.

**3. Droplet Generation from Can:** (NEXT)
    *   Modify automatic droplet logic (likely in \`game-loop.js\` physics update section, or move to \`paintCan.js\`):
        *   Only players with a \`currentCanId\` can drop paint (check owner's presence).
        *   Check runs based on the *can's owner* (only owner client performs this logic).
        *   If can state \`isCharging\` is false and \`paintAmount\` > 0:
            *   Use a timer/rate limit (e.g., based on \`config.paintCanAutoDropRate\` and \`deltaTime\`) to decide when to drop.
            *   Get the *paint can's* current position (from updated \`canState\` after physics).
            *   Create droplet using the can's \`paintColor\` and position. Add to \`room.roomState.droplets\` via \`room.updateRoomState\`.
            *   Owner sends \`room.updateRoomState\` to decrement \`paintAmount\` in the *can's state*.
    *   Modify paint burst logic (\`main.js\` mousedown/mouseup):
        *   Listeners check if the local player has a \`currentCanId\`.
        *   \`mousedown\`: Owner sends \`room.updateRoomState\` to set \`isCharging = true\` on their can. Start client-side timer/logic to accumulate droplets. Periodically (based on \`deltaTime\` and \`config.paintCanChargingSpeed\`), owner sends \`room.updateRoomState\` to increment \`accumulatedDroplets\` and decrement \`paintAmount\` on their can (respecting \`config.paintCanMaxAccumulatedDroplets\`). Accumulation happens client-side, state update syncs it.
        *   \`mouseup\`: Owner sends \`room.updateRoomState\` to set \`isCharging = false\`. If \`accumulatedDroplets > 0\`:
            *   Get can position from local \`canState\`.
            *   Create burst of droplets (multiple additions to \`roomState.droplets\` in one update). Spread them slightly around the can's position. Use can color.
            *   Owner sends \`room.updateRoomState\` to reset \`accumulatedDroplets = 0\` on their can.

**4. Visual Feedback Updates:**
    *   **Player Capsule Stroke:** In \`player.js/renderPlayer\`: Modify capsule stroke rendering. Calculate the final stroke color by blending the base stroke color (from config) with colors stored in the player's \`presence.paintedData\`. Use a weighted average based on percentages.
    *   **Paint Can Amount:** In \`renderPaintCan\`: Visually represent the \`canState.paintAmount\` (e.g., fill level rectangle inside the can, color intensity).

**5. Paint Can Replenishment:**
    *   **Mechanism:** Refill zones or random spawning of \`availablePaintCans\` in \`roomState\`.
    *   **Zone Management:** One client ("host"? First joined? Simplest: random timer on each client, only update if can doesn't exist) manages spawning cans into \`room.roomState.availablePaintCans\` at predefined locations or random positions. Cans should have a random \`paintColor\` from \`config.paintCanColors\` and \`paintAmount: config.paintCanInitialAmount\`. Include \`x, y, vx: 0, vy: 0, ownerId: null\`.
    *   **Pickup Logic:**
        *   In \`game-loop.js\` (physics update section): Client-side collision check between local player *capsule* position (\`playerPhysicsState.position\`) and center of cans in \`availablePaintCans\` using \`config.paintCanPickupDistance\`.
        *   On collision:
            *   If local player \`presence.currentCanId\` is \`null\`:
                *   Send \`room.updateRoomState\` attempting to claim the can. This needs atomicity. Simplest approach (prone to races):
                    1. Read can state from \`availablePaintCans\`.
                    2. Send update: \`{ availablePaintCans: { [canId]: null }, paintCans: { [canId]: { ...canState, ownerId: localClientId } } }\`.
                *   *After* successful room state update (or optimistically): Send \`room.updatePresence({ currentCanId: canId })\`.
                *   Need a mechanism to confirm the state update or handle the race condition where two players grab simultaneously. Maybe the first \`updateRoomState\` wins. The client confirming \`paintCans[canId].ownerId === localClientId\` in the next state sync proceeds with the presence update.
            *   If player already has a can: Ignore the new one.
    *   **Dropping/Losing Cans:** When \`paintAmount\` hits 0, the owner sends \`room.updateRoomState\` to set the can's \`ownerId = null\` and potentially move it back to \`availablePaintCans\` (or just delete from \`paintCans\` if empty cans disappear). Owner also sends \`room.updatePresence({ currentCanId: null })\`. Handle disconnects (partially done in \`main.js\` presence handler).

**6. Droplet Collision & Painting:**
    *   In \`game-loop.js\` (after physics updates): Client-side collision detection.
        *   Iterate through local player's *capsule* physics state (\`playerPhysicsState.position\` and body dimensions) and all droplets in \`roomState.droplets\`.
        *   Check for collision between capsule hitbox and droplets where \`droplet.ownerId !== localClientId\`.
        *   On collision:
            *   Stop rendering the droplet locally immediately (or mark as hit).
            *   Update local \`paintedData\`: Fetch current presence, increment percentage for the hit \`color\` (e.g., +2%), clamp total at 100.
            *   Call \`room.updatePresence\` with the new \`paintedData\`.
            *   Send a \`roomState\` update to remove the droplet: \`room.updateRoomState({ droplets: { [droplet.id]: null } })\`. (Trust client reporting).

**7. Droplet Cleanup:**
    *   Client-side: Visually remove expired droplets based on \`createdAt\` and \`config.dropletDuration\` during rendering loop.
    *   Authoritative Removal: The *client that detected the hit* (Step 6) removes the droplet from \`roomState\`. Timeout removal is implicitly handled by clients visually ignoring old droplets. We might need occasional server-side or host cleanup if state bloats.

**Future Considerations:**
- **Loss Condition:** Implement check for total \`paintedData\` percentage >= 100.
- **Visual Polish:** Can appearance variations, droplet splats, charge indicators, zone visuals.
- **Sound Effects:** Dripping, bursting, hitting, pickup, empty can drop.
- **UI:** Scoreboard, paint level indicator, zone notifications.
- **Can Interaction:** Stealing cans? Throwing cans?
- **Networking Robustness:** Improve handling of state update races (e.g., can pickup).
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