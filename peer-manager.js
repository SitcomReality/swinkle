/**
 * peer-manager.js
 * Manages peer tracking, cleanup, and notifications for joins/leaves.
 */
import { removePlayerPhysicsState } from './playerState.js';
import { removeSpectatorState } from './spectate-mode.js'; // Import spectator state cleanup

/**
 * Track disconnected/joined peers, clean up physics state, and trigger notifications.
 * @param {object} previousPeerData - Shallow copy of the previous `room.peers` object.
 * @param {object} currentPeers - Current peer list from `room.peers`.
 * @param {Function} addNotification - The notification function to call.
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
            if (addNotification) {
                addNotification(`${username} left the game.`, 'leave', 3000);
            }
        }
    });

    // --- Handle New Connections ---
    currentPeerIds.forEach(clientId => {
        if (!previousPeerIds.has(clientId)) {
            // Peer joined
            const username = currentPeers[clientId]?.username || 'Player';
            console.log(`Peer ${username} (${clientId}) joined.`);
            if (addNotification) {
                // Don't notify about self joining initially
                // Check if previousPeerData was empty to avoid initial join spam
                if (previousPeerIds.size > 0) {
                    addNotification(`${username} joined the game!`, 'join', 3000);
                }
            }
        }
    });

    // Return a shallow copy of currentPeers for the next frame's comparison
    return { ...currentPeers };
}