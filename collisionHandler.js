/**
 * collisionHandler.js
 * Handles collision detection between game objects, particularly players and droplets.
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
 * @returns {{ dropletsToRemove: object, collisionPoints: Array<object> }} - Droplets to remove and points where collisions occurred.
 */
export function checkCollisionsWithPlayer(playerBodyPos, droplets, localClientId, currentPresence, now) {
    const dropletsToRemove = {};
    const collisionPoints = []; // Store { x, y, color } for splat effects
    const bodyWidth = config.playerBodyWidth;
    const bodyHeight = config.playerBodyHeight;
    let paintedUpdates = {};
    let paintingOccurred = false;
    const currentPaintedData = currentPresence?.paintedData || {};
    const alreadyLost = currentPresence?.lost || false;

    // If already lost, don't process further collisions or record losses again
    if (alreadyLost) return { dropletsToRemove: {}, collisionPoints: [] };

    // Simple rectangular hitbox for the player capsule
    const playerHitbox = {
        left: playerBodyPos.x - bodyWidth / 2,
        right: playerBodyPos.x + bodyWidth / 2,
        top: playerBodyPos.y - bodyHeight / 2,
        bottom: playerBodyPos.y + bodyHeight / 2
    };

    Object.entries(droplets).forEach(([dropletId, droplet]) => {
        // Skip if droplet doesn't exist, is owned by the local player, or player is already lost
        if (!droplet || droplet.ownerId === localClientId) return;

        // Simple circle-rectangle collision check
        const dropletRadius = config.dropletSize || 3;

        // Find the closest point on the rectangle to the circle
        const closestX = Math.max(playerHitbox.left, Math.min(droplet.x, playerHitbox.right));
        const closestY = Math.max(playerHitbox.top, Math.min(droplet.y, playerHitbox.bottom));

        // Calculate distance between the closest point and the circle center
        const distanceX = droplet.x - closestX;
        const distanceY = droplet.y - closestY;
        const distanceSquared = distanceX * distanceX + distanceY * distanceY;

        // Check if the distance is less than the circle's radius squared
        if (distanceSquared <= (dropletRadius * dropletRadius)) {
            // Collision detected!
            // console.log(`Player ${localClientId} hit by droplet ${dropletId} (color: ${droplet.color})`);

            // Mark this droplet for removal
            dropletsToRemove[dropletId] = null;

            // Record collision point for splat effect
            collisionPoints.push({ x: droplet.x, y: droplet.y, color: droplet.color });

            // Update painted data: increment the percentage for this color
            const currentPercentage = currentPaintedData[droplet.color] || 0;
            // Make increment amount configurable?
            const incrementAmount = config.paintIncrementPerDroplet || 2;
            paintedUpdates[droplet.color] = currentPercentage + incrementAmount;
            paintingOccurred = true;
        }
    });

    // If any painting occurred, update the player's painted data
    if (paintingOccurred) {
        // Calculate total paint percentage
        let totalPercentage = 0;
        const updatedPaintedData = { ...currentPaintedData, ...paintedUpdates };

        Object.values(updatedPaintedData).forEach(percentage => {
            totalPercentage += percentage;
        });

        // Clamp total percentage at the loss threshold to avoid going over visually
        totalPercentage = Math.min(totalPercentage, config.lossThreshold);

        // console.log(`Player ${localClientId} painted: ${totalPercentage}% total`);

        // Prepare presence update data
        const updateData = { paintedData: updatedPaintedData };
        let justLost = false;

        // Check if player has reached loss threshold (and wasn't already lost)
        if (totalPercentage >= config.lossThreshold) {
            console.log(`Player ${localClientId} has been fully painted out! (${totalPercentage}%)`);
            updateData.lost = true;
            // Set the respawn time
            updateData.respawnTime = now + (config.respawnDelay || 5000);
            justLost = true; // Flag that the loss occurred this frame

            // Record the loss in the database
            const username = room.peers[localClientId]?.username;
            if (username) {
                console.log(`Recording loss for ${username}`);
                room.collection('loss_v1').create({ loserUsername: username })
                    .then(record => console.log("Loss recorded:", record))
                    .catch(err => console.error("Error recording loss:", err));
                // Use loss_v1 to invalidate any old test records if schema changes
            } else {
                console.warn(`Could not find username for client ${localClientId} to record loss.`);
            }

            // Optionally: Drop the player's current paint can if they lose
            if (currentPresence.currentCanId) {
                 console.log(`Player ${localClientId} lost, dropping can ${currentPresence.currentCanId}`);
                 const canId = currentPresence.currentCanId;
                 const canState = room.roomState.paintCans?.[canId];
                 if (canState) {
                    // Send room state updates to make the can available
                    // This might be better handled in game-loop or playerInteractions on presence change detection
                    // For now, let's just update presence to drop it.
                    // The disconnect logic in main.js might handle the roomState update implicitly,
                    // OR we need dedicated logic here or elsewhere.
                    // Simplest: Update presence. Game loop will eventually see player has no can.
                    // We need to ensure the can itself becomes available though.
                     room.updateRoomState({
                         paintCans: { [canId]: null }, // Remove from owned cans
                         availablePaintCans: { // Add to available cans
                            [canId]: {
                                ...canState,
                                ownerId: null,
                                vx: 0, vy: 0, // Reset physics
                                isCharging: false, accumulatedDroplets: 0
                             }
                         }
                     });
                     updateData.currentCanId = null; // Also update presence immediately
                 }
            }

        }

        // Send presence update only if something changed (paint or loss state)
        room.updatePresence(updateData);
    }

    return { dropletsToRemove, collisionPoints };
}