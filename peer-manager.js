/**
 * peer-manager.js
 * Manages peer tracking and cleanup
 */
import { removePlayerPhysicsState } from './playerState.js';

/**
 * Track disconnected peers and clean up their physics state
 * @param {Set} previousPeers - Set of previously connected peer IDs
 * @param {object} currentPeers - Current peer list from room.peers
 * @returns {Set} Updated set of connected peer IDs
 */
export function cleanupDisconnectedPeers(previousPeers, currentPeers) {
    const currentPeerIds = new Set(Object.keys(currentPeers));
    
    previousPeers.forEach(clientId => {
        if (!currentPeerIds.has(clientId)) {
            // Peer disconnected, remove their physics state
            removePlayerPhysicsState(clientId);
            console.log(`Peer ${clientId} disconnected, player physics removed.`);
        }
    });
    
    return currentPeerIds; // Return updated set for next frame
}