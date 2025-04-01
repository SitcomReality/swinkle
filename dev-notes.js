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

**Current Plan: Global Notifications (Incremental)**
Goal: Make key game event notifications visible to all players, not just the client where the event originates. We'll use a database record approach (\`global_notification_event\`) for broadcasting.

  - **1. [DONE] Setup Global Notifier Module:**
    - Created \`global-notifier.js\`.
    - Defined constants for notification types (e.g., \`PLAYER_LOSS\`, \`POWERUP_COLLECT\`, etc.).
    - Implemented \`broadcastNotification(eventType, payload)\`: Creates a \`global_notification_event_v1\` record in the database. Includes a timestamp.
    - Implemented subscription logic: Subscribe to \`global_notification_event_v1\`. When a *new* record *from another client* is received, parse its \`eventType\` and \`payload\`. Call the local \`addNotification\` function (from \`notification-manager.js\`) with the appropriate message and type.
    - Imported and initialized this module in \`main.js\`.
    - Added basic cleanup for old records (e.g., delete records older than 1 minute? Or maybe just filter in the subscription).
    - **[Refinement]** Modified \`handleNotificationRecords\` in \`global-notifier.js\` to *immediately* process notifications broadcast by the *local* client, ensuring the user who triggered the event sees it instantly. Notifications from other clients are still processed normally via the subscription. This addresses the issue where removing direct \`addNotification\` calls prevented the originating user from seeing their own event notification.
    - *Files Created/Modified: \`global-notifier.js\` (new), \`main.js\`, \`index.html\`*

  - **2. [DONE] Integrate Player Loss Notifications:**
    - Modified \`collisionHandler.js\`: When a player loss is detected (\`totalPercentage >= config.lossThreshold\`), *removed* the direct call to \`addNotification\`.
    - Instead, called \`broadcastNotification('PLAYER_LOSS', { loserUsername: username })\`.
    - Updated \`global-notifier.js\` subscription logic to handle the \`'PLAYER_LOSS'\` event type and format the message for \`addNotification\`.
    - *Files Modified: \`collisionHandler.js\`, \`global-notifier.js\`*

  - **3. [DONE] Integrate Power-up Collection Notifications:**
    - Modified \`power-up-manager.js\` (\`checkPowerUpCollisions\`): *Removed* the direct call to \`addNotification\` upon successful collection.
    - Instead, called \`broadcastNotification('POWERUP_COLLECT', { collectorUsername: username, powerupName: powerUpDef.name })\`.
    - Updated \`global-notifier.js\` subscription logic to handle the \`'POWERUP_COLLECT'\` event type.
    - *Files Modified: \`power-up-manager.js\`, \`global-notifier.js\`*

  - **4. [DONE] Integrate Score Update Notifications:**
    - Modified \`collisionHandler.js\`: When points are awarded (\`painterId\` gets points), *removed* the direct call(s) to \`addNotification\` related to scoring.
    - Instead, called \`broadcastNotification('SCORE_UPDATE', { scorerUsername: painterUsername, victimUsername: localUsername, points: incrementAmount, isLoss: justLost })\`.
    - Updated \`global-notifier.js\` subscription logic to handle \`'SCORE_UPDATE'\`. Replicated the logic to only show loss-related scores or occasional regular hits to avoid spam.
    - *Files Modified: \`collisionHandler.js\`, \`global-notifier.js\`*

  - **5. Integrate Respawn Notifications:**
    - Modify \`respawn-manager.js\` (\`checkPlayerRespawn\`): *Remove* the direct call to \`addNotification\`.
    - Modify \`main.js\` (click/escape listeners): *Remove* the direct call to \`addNotification\`.
    - In *both* places where the respawn is confirmed (i.e., where \`triggerManualRespawn\` is called and its result used), call \`broadcastNotification('PLAYER_RESPAWN', { username: username })\`.
    - Update \`global-notifier.js\` subscription logic to handle \`'PLAYER_RESPAWN'\`.
    - *Files to Modify: \`respawn-manager.js\`, \`main.js\`, \`global-notifier.js\`*

  - **6. Integrate Spectate Mode Notifications:**
    - Modify \`spectate-mode.js\` (\`enterSpectateMode\`): *Remove* the direct call to \`addNotification\`.
    - Instead, call \`broadcastNotification('SPECTATE_ENTER', { username: username })\`.
    - Update \`global-notifier.js\` subscription logic to handle \`'SPECTATE_ENTER'\`. (Leaving spectate mode is covered by PLAYER_RESPAWN).
    - *Files to Modify: \`spectate-mode.js\`, \`global-notifier.js\`*

  - **7. Integrate Level Change Notifications:**
    - Modify \`host-logic.js\`: When the host triggers a level change, *remove* the direct call to \`addNotification\`.
    - Instead, call \`broadcastNotification('LEVEL_CHANGE', { levelName: nextLevel.name })\`.
    - Update \`global-notifier.js\` subscription logic to handle \`'LEVEL_CHANGE'\`.
    - *Files to Modify: \`host-logic.js\`, \`global-notifier.js\`*

  - **8. Review & Refine:**
    - Test thoroughly. Ensure notifications appear correctly for all players and aren't duplicated excessively. Check if the self-notification fix works as expected.
    - Verify join/leave notifications in \`peer-manager.js\` are working globally as expected.
    - Adjust notification messages/types/durations as needed in \`global-notifier.js\`.

**Future Ideas/Stretch Goals:**
    - Sound effects.
    - Player loss/paint-out effect.
    - More visual effects.
    - Environmental hazards? Polygon obstacles?
    - Optimization.
    - Tip messages.
    - Social features (chat?).

`;

// Function to load notes remains the same
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