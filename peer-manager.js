/**
 * peer-manager.js
 * Manages peer tracking, cleanup, and notifications for joins/leaves.
 */
import { removePlayerPhysicsState } from './playerState.js';
import { removeSpectatorState } from './spectate-mode.js'; // Import spectator state cleanup
// Use global notifications for join/leave
import { addGlobalNotification } from './notification-manager.js';

/**
 * Track disconnected/joined peers, clean up physics state, and trigger notifications.
 * @param {object} previousPeerData - Shallow copy of the previous `room.peers` object.
 * @param {object} currentPeers - Current peer list from `room.peers`.
 * @param {Function} addNotification - (DEPRECATED in this context, using addGlobalNotification directly).
 * @returns {object} Updated `previousPeerData` object for the next frame (a shallow copy of `currentPeers`).
 */
export function cleanupAndNotifyPeers(previousPeerData, currentPeers, addNotification) {
    const currentPeerIds = new Set(Object.keys(currentPeers));
    const previousPeerIds = new Set(Object.keys(previousPeerData));

    // --- Handle Disconnections ---
    previousPeerIds.forEach(clientId => {
        if (!currentPeerIds.has(clientId)) {
            // Peer disconnected
            const username = previousPeerData[clientId]?.username || 'Player'; // Get username from previous data
            removePlayerPhysicsState(clientId); // Clean up physics state
            removeSpectatorState(clientId); // Clean up spectator state
            console.log(`Peer ${username} (${clientId}) disconnected, player physics & spectator state removed.`);
            // Use addGlobalNotification
            addGlobalNotification(`${username} left the game.`, 'leave', 3000)
                .catch(err => console.error("Error sending global leave notification:", err));
        }
    });

    // --- Handle New Connections ---
    currentPeerIds.forEach(clientId => {
        if (!previousPeerIds.has(clientId)) {
            // Peer joined
            const username = currentPeers[clientId]?.username || 'Player';
            console.log(`Peer ${username} (${clientId}) joined.`);
            // Don't notify about self joining initially
            // Check if previousPeerData was empty to avoid initial join spam
            if (previousPeerIds.size > 0) {
                // Use addGlobalNotification
                addGlobalNotification(`${username} joined the game!`, 'join', 3000)
                    .catch(err => console.error("Error sending global join notification:", err));
            }
        }
    });

    // Return a shallow copy of currentPeers for the next frame's comparison
    return { ...currentPeers };
}