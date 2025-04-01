/**
 * dev-notes.js
 * Contains developer notes and plans for the project.
 * Loads notes into the UI.
 * Remember to escape backticks!
 */
export const notes = `
## Developer Notes - Multiplayer Painter

**Design Goals & Considerations:**
- **Core Gameplay:** Players swing around on bungee cords attached to their cursor. They acquire and carry a separate 'paint can' object, also attached via bungee to their player capsule. This can is used to automatically drop paint droplets or release bursts of paint. Players try to paint each other by maneuvering so their opponents collide with their droplets. Collision with another player\'s droplet adds that color to the victim\'s capsule outline. Reaching 100% painted is a loss condition. Players respawn after a delay. Players without a can can steal one by colliding with a player holding one. Level geometry provides obstacles.
- **Theme:** 'xtreme 90s cyberpunk grungewave desperately nostalgic for 60s-70s retrofuturistic neon disco optimism' (Dark background, neon highlights). Apply this to characters, paint cans, paint droplets, UI elements.
- **Character Design:** Player capsule with big expressive eyes, dangling from a bungee cord attached to the cursor. Physics-based limbs enhance the dangle effect. A paint can dangles from the player capsule via another bungee cord. The capsule rotates in response to forces, trying to stay upright.
- **Modularity:** Keep logic separated (physics, rendering, game loop, networking, interactions, UI).
- **Performance & Networking:** Prioritize perceived smoothness. Trust clients for collision detection and state reporting. Use client-side prediction/rendering where possible (droplet expiration, maybe can physics). Rely on 'roomState' for authoritative positions of cans, droplets, and power-ups, and 'presence' for player anchor/painted state/active power-ups.
- **Developer Notes:** Update this file outlining planned steps and key questions. Remember to escape all backticks in these notes.

**Next Steps:**

  - **Debugging Global Notifications:**
     - **Issue:** Most global notifications (join/leave, powerup pickup, player loss, level change) are not appearing. Respawn/spectate notifications are also local. Score notifications remain local (by design for now).
     - **Potential Causes & Debugging Strategy:**
        1. **Record Creation Failure:** Verify that \`addGlobalNotification\` is being called in the expected places (e.g., \`collisionHandler.js\` for loss, \`power-up-manager.js\` for pickup, \`peer-manager.js\` for join/leave, \`host-logic.js\` for level change). Add \`console.log\` statements inside \`addGlobalNotification\` in \`notification-manager.js\`.
        2. **Record Subscription Issue:** Add a \`console.log\` inside the \`room.collection('notification_v2').subscribe()\` callback in \`initializeNotificationManager\` to confirm it's receiving records.
        3. **Rendering Logic / Duplicate Prevention:** The previous strict check using \`displayedGlobalNotificationIds\` might have been preventing notifications. This has been relaxed. Monitor if global notifications now appear. The remaining duplicate check within \`addNotificationInternal\` based on *active* notifications (matching record ID) should prevent visual spam while allowing timers to reset.
        4. **Local Fallback:** Ensure all intended global notifications are calling \`addGlobalNotification\` and not the local \`addNotification\` (e.g., respawns, spectate). Score notifications are intentionally local for now. Check \`respawn-manager.js\`, \`spectate-mode.js\`, \`main.js\` for calls to \`addNotification\` that should be global. (Done in this update).
        5. **Websim Console/Tools:** If available, directly inspect the \`notification_v2\` collection in the Websim backend/debugger to see if records are being created as expected.

  - **Player loss/paint-out effect:** "Painted out" - Currently all that happens is the player freezes and we get the "Painted Out" text on screen, and they stay frozen for a few seconds, and then they respawn. This is terrifically boring. Once their more interesting demise is animated, they should enter spectate mode.
  - **Add more levels.**

**Other Planned Features:**

- **Sound effects.** (Requires audio capabilities)
   - Once audio is available, trigger a respawn sound effect in \`respawn-manager.js\` when the respawn occurs.

- **More visual effects:**

   - Can pickup/steal effect improvement.

- **Future Ideas/Stretch Goals:**
    - Environmental hazards? (Moving platforms, laser grids?). Support for polygon obstacles.
    - Optimize rendering and physics. Continue tuning player rotation physics (inertia, damping, uprighting strength, bungee torque factor) for desired feel. Collision-based torque could also be added.
    - Add logic for occasional whimsical/tip messages (maybe triggered randomly in the game loop or based on simple conditions like low paint)
    - More social features, like chat messages?

`;

export function loadDevNotes() {
    const container = document.getElementById('dev-notes-container');
    if (container) {
        // Use textContent to avoid HTML injection issues
        // Replace escaped backticks with single quotes for display
        container.textContent = notes.replace(/\\\`/g, "'");
        console.log("Dev notes loaded.");
    } else {
        console.error("Dev notes container not found!");
    }
}