/**
 * collisionHandler.js
 * Handles collision detection between game objects, particularly players and droplets.
 * Also includes helper functions for collision geometry.
 */
import config from 'config';
// Import the room instance directly to access peers and collections
import { room } from './main.js';

/**
 * Checks for collisions between the local player and all droplets.
 * Updates the player's painted data when hit by another player's droplet.
 * Records a loss event when the player reaches the loss threshold.
 *
 * @param {object} playerBodyPos - The body position of the local player {x, y}.
 * @param {object} droplets - The current droplets in the room state.
 * @param {string} localClientId - The ID of the local client.
 * @param {object} currentPresence - The player's current presence data (including paintedData, lost).
 * @param {number} now - The current timestamp (Date.now()).
 * @returns {{
 *   dropletsToRemove: object,
 *   collisionPoints: Array<object>,
 *   presenceUpdates: object // Updates for the local player's presence
 * }} - Droplets to remove, points where collisions occurred, and presence changes.
 */
export function checkCollisionsWithPlayer(playerBodyPos, droplets, localClientId, currentPresence, now) {
    const dropletsToRemove = {};
    const collisionPoints = []; // Store { x, y, color } for splat effects
    let presenceUpdates = {}; // Collect presence updates for this player
    const bodyWidth = config.playerBodyWidth;
    const bodyHeight = config.playerBodyHeight;
    let paintedUpdates = {};
    let paintingOccurred = false;
    const currentPaintedData = currentPresence?.paintedData || {};
    const alreadyLost = currentPresence?.lost || false;

    // If already lost, don't process further collisions or record losses again
    if (alreadyLost) return { dropletsToRemove: {}, collisionPoints: [], presenceUpdates: {} };

    // Simple rectangular hitbox for the player capsule
    const playerHitbox = {
        left: playerBodyPos.x - bodyWidth / 2,
        right: playerBodyPos.x + bodyWidth / 2,
        top: playerBodyPos.y - bodyHeight / 2,
        bottom: playerBodyPos.y + bodyHeight / 2
    };

    Object.entries(droplets).forEach(([dropletId, droplet]) => {
        // Skip if droplet doesn't exist, is owned by the local player
        if (!droplet || droplet.ownerId === localClientId) return;

        // Simple circle-rectangle collision check
        const dropletRadius = config.dropletSize || 3;

        const closestX = Math.max(playerHitbox.left, Math.min(droplet.x, playerHitbox.right));
        const closestY = Math.max(playerHitbox.top, Math.min(droplet.y, playerHitbox.bottom));

        const distanceX = droplet.x - closestX;
        const distanceY = droplet.y - closestY;
        const distanceSquared = distanceX * distanceX + distanceY * distanceY;

        if (distanceSquared <= (dropletRadius * dropletRadius)) {
            // Collision detected!
            dropletsToRemove[dropletId] = null;
            collisionPoints.push({ x: droplet.x, y: droplet.y, color: droplet.color });

            const currentPercentage = currentPaintedData[droplet.color] || 0;
            const incrementAmount = config.paintIncrementPerDroplet || 2;
            paintedUpdates[droplet.color] = currentPercentage + incrementAmount;
            paintingOccurred = true;
        }
    });

    // If any painting occurred, update the player's painted data and check for loss
    if (paintingOccurred) {
        let totalPercentage = 0;
        const updatedPaintedData = { ...currentPaintedData, ...paintedUpdates };

        Object.values(updatedPaintedData).forEach(percentage => {
            totalPercentage += percentage;
        });

        totalPercentage = Math.min(totalPercentage, config.lossThreshold);

        // Prepare presence update data
        presenceUpdates.paintedData = updatedPaintedData;

        // Check if player has reached loss threshold (and wasn't already lost)
        if (totalPercentage >= config.lossThreshold) {
            console.log(`Player ${localClientId} has been fully painted out! (${totalPercentage}%)`);
            presenceUpdates.lost = true;
            presenceUpdates.respawnTime = now + (config.respawnDelay || 5000);

            // Record the loss in the database
            const username = room.peers[localClientId]?.username;
            if (username) {
                console.log(`Recording loss for ${username}`);
                room.collection('loss_v1').create({ loserUsername: username })
                    .catch(err => console.error("Error recording loss:", err));
            } else {
                console.warn(`Could not find username for client ${localClientId} to record loss.`);
            }

            // Drop the player's current paint can if they lose (add to presence update)
            if (currentPresence.currentCanId) {
                 console.log(`Player ${localClientId} lost, dropping can ${currentPresence.currentCanId}`);
                 presenceUpdates.currentCanId = null; // Drop can in presence update

                 // Trigger room state update to make the can available (handled by gameUpdater/main based on presence change)
                 // We need to ensure the can actually becomes available in roomState.
                 // The logic in main.js listening to presence changes should handle this,
                 // or gameUpdater could explicitly create the availablePaintCan update based on the loss event.
                 // Let's rely on main.js presence subscription for now to handle making the can available.
            }
        }
        // Note: The actual presence update is sent by game-loop after collecting all updates.
    }

    return { dropletsToRemove, collisionPoints, presenceUpdates };
}

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