/**
 * collision-system.js
 * Handles player-player collisions for actions like can stealing
 */
import config from 'config';
import { getPlayerPhysicsState } from './playerState.js';
import { addEffect } from './effectsRenderer.js';

/**
 * Simple Axis-Aligned Bounding Box collision check.
 * @param {object} rectA - { left, right, top, bottom }
 * @param {object} rectB - { left, right, top, bottom }
 * @returns {boolean} True if colliding, false otherwise.
 */
export function checkRectCollision(rectA, rectB) {
    if (!rectA || !rectB) return false;
    return (
        rectA.left < rectB.right &&
        rectA.right > rectB.left &&
        rectA.top < rectB.bottom &&
        rectA.bottom > rectB.top
    );
}

/**
 * Creates a bounding box for a player based on their physics state.
 * @param {object} physicsState - The player's physics state.
 * @returns {object|null} Bounding box { left, right, top, bottom } or null.
 */
export function getPlayerBoundingBox(physicsState) {
    if (!physicsState) return null;
    const bodyWidth = config.playerBodyWidth;
    const bodyHeight = config.playerBodyHeight;
    return {
        left: physicsState.position.x - bodyWidth / 2,
        right: physicsState.position.x + bodyWidth / 2,
        top: physicsState.position.y - bodyHeight / 2,
        bottom: physicsState.position.y + bodyHeight / 2
    };
}

/**
 * Handle collisions between players for actions like can stealing
 * @param {string} localClientId - The ID of the local client
 * @param {object} room - The room instance
 * @returns {object} Updates to apply for cans and presence
 */
export function handlePlayerCollisions(localClientId, room) {
    const updates = {
        paintCanUpdates: {},
        localPresenceUpdates: {},
        presenceRequests: []
    };
    
    const localPlayerPhysics = getPlayerPhysicsState(localClientId);
    const localPlayerBox = getPlayerBoundingBox(localPlayerPhysics);
    const localPresence = room.presence[localClientId];

    // Only check if local player exists, has a hitbox, is not lost, and doesn't currently have a can
    if (!localPlayerBox || !localPresence || localPresence.lost || localPresence.currentCanId) {
        return updates;
    }

    Object.entries(room.peers).forEach(([otherClientId, otherPeer]) => {
        // Skip self, skip if other player doesn't exist or is lost
        if (otherClientId === localClientId) return;
        const otherPresence = room.presence[otherClientId];
        if (!otherPresence || otherPresence.lost) return;

        // Check if the other player HAS a can
        const canIdToSteal = otherPresence.currentCanId;
        if (canIdToSteal && room.roomState.paintCans?.[canIdToSteal]) {
            const otherPlayerPhysics = getPlayerPhysicsState(otherClientId);
            const otherPlayerBox = getPlayerBoundingBox(otherPlayerPhysics);

            // Check collision between local player body and other player body
            if (checkRectCollision(localPlayerBox, otherPlayerBox)) {
                console.log(`Player ${localClientId} collided with ${otherClientId} who has can ${canIdToSteal}. Attempting steal!`);

                // Prevent stealing the same can multiple times in quick succession if updates lag
                // Check if we already updated presence this frame to take this can
                if (updates.localPresenceUpdates.currentCanId === canIdToSteal) return;

                // 1. Update local presence to hold the can
                updates.localPresenceUpdates.currentCanId = canIdToSteal;

                // 2. Request the other player drops the can
                updates.presenceRequests.push({ 
                    targetId: otherClientId, 
                    update: { type: 'dropCan' } 
                });

                // 3. Update the can's ownership in roomState
                updates.paintCanUpdates[canIdToSteal] = {
                    ownerId: localClientId,
                    vx: 0,
                    vy: 0,
                    isCharging: false,
                    accumulatedDroplets: 0
                };

                // Optional: Add a visual/audio cue for the steal
                addEffect('stealSpark', { 
                    x: localPlayerPhysics.position.x, 
                    y: localPlayerPhysics.position.y 
                });
            }
        }
    });

    return updates;
}