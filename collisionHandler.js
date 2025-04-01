/**
 * collisionHandler.js
 * Handles collision detection between game objects, particularly players and droplets.
 */
import config from 'config';
// Import the room instance directly to access peers and collections
import { room } from './main.js';
import { addEffect } from './effectsRenderer.js'; // Import addEffect
// Use addGlobalNotification for loss events
import { addNotification, addGlobalNotification } from './notification-manager.js';

/**
 * Checks for collisions between the local player and all droplets.
 * Updates the player's painted data when hit by another player's droplet.
 * Records a loss event when the player reaches the loss threshold.
 * Accounts for the 'shield' power-up.
 * Skips collision checks if the player is spectating.
 *
 * @param {object} playerBodyPos - The body position of the local player {x, y}.
 * @param {object} droplets - The current droplets in the room state.
 * @param {string} localClientId - The ID of the local client.
 * @param {object} currentPresence - The player's current presence data (including paintedData, lost, shielded, isSpectating).
 * @param {number} now - The current timestamp (Date.now()).
 * @returns {{ dropletsToRemove: object, collisionPoints: Array<object> }} - Droplets to remove and points where collisions occurred.
 */
export function checkCollisionsWithPlayer(playerBodyPos, droplets, localClientId, currentPresence, now) {
    const dropletsToRemove = {};
    const collisionPoints = [];

    if (!currentPresence || currentPresence.lost || currentPresence.isSpectating) {
        return { dropletsToRemove, collisionPoints };
    }

    let paintedUpdates = {};
    let paintingOccurred = false;
    const currentPaintedData = currentPresence.paintedData || {};
    const isShielded = currentPresence.shielded || false;
    const paintingPlayers = new Set();

    const bodyWidth = config.playerBodyWidth;
    const bodyHeight = config.playerBodyHeight;
    const playerHitbox = {
        left: playerBodyPos.x - bodyWidth / 2,
        right: playerBodyPos.x + bodyWidth / 2,
        top: playerBodyPos.y - bodyHeight / 2,
        bottom: playerBodyPos.y + bodyHeight / 2
    };

    Object.entries(droplets).forEach(([dropletId, droplet]) => {
        if (!droplet || droplet.ownerId === localClientId) return;

        const dropletRadius = config.dropletSize || 3;
        const closestX = Math.max(playerHitbox.left, Math.min(droplet.x, playerHitbox.right));
        const closestY = Math.max(playerHitbox.top, Math.min(droplet.y, playerHitbox.bottom));
        const distanceX = droplet.x - closestX;
        const distanceY = droplet.y - closestY;
        const distanceSquared = distanceX * distanceX + distanceY * distanceY;

        if (distanceSquared <= (dropletRadius * dropletRadius)) {
            dropletsToRemove[dropletId] = null; // Mark for removal

            if (isShielded) {
                addEffect('blockSpark', { x: droplet.x, y: droplet.y, color: droplet.color });
            } else {
                // --- Apply Paint ---
                collisionPoints.push({ x: droplet.x, y: droplet.y, color: droplet.color });
                const currentPercentage = currentPaintedData[droplet.color] || 0;
                const incrementAmount = config.paintIncrementPerDroplet || 2;
                paintedUpdates[droplet.color] = currentPercentage + incrementAmount;
                paintingOccurred = true;
                if (droplet.ownerId) {
                    paintingPlayers.add(droplet.ownerId);
                }
            }
        }
    });

    if (paintingOccurred) {
        let totalPercentage = 0;
        const updatedPaintedData = { ...currentPaintedData, ...paintedUpdates };
        Object.values(updatedPaintedData).forEach(percentage => {
            totalPercentage += percentage;
        });
        totalPercentage = Math.min(totalPercentage, config.lossThreshold);

        const updateData = { paintedData: updatedPaintedData };
        let justLost = false;

        if (totalPercentage >= config.lossThreshold) {
            // --- Player Lost ---
            updateData.lost = true;
            updateData.respawnTime = now + (config.respawnDelay || 5000);
            justLost = true;

            const username = room.peers[localClientId]?.username;
            if (username) {
                console.log(`Recording loss for ${username}`);
                // Send GLOBAL notification of player loss
                addGlobalNotification(`${username} was PAINTED OUT!`, 'loss', 5000);
                room.collection('loss_v1').create({ loserUsername: username })
                    .catch(err => console.error("Error recording loss:", err));
            }

            // Drop current can
            if (currentPresence.currentCanId) {
                 const canId = currentPresence.currentCanId;
                 const canState = room.roomState.paintCans?.[canId];
                 if (canState) {
                     room.updateRoomState({
                         paintCans: { [canId]: null },
                         availablePaintCans: {
                            [canId]: {
                                ...canState, ownerId: null, vx: 0, vy: 0,
                                isCharging: false, accumulatedDroplets: 0,
                                isMega: canState.isMega || false
                             }
                         }
                     });
                     updateData.currentCanId = null;
                 }
            }
        }

        room.updatePresence(updateData); // Update local player presence

        // --- Give Score to Painting Players ---
        if (paintingPlayers.size > 0) {
            paintingPlayers.forEach(painterId => {
                if (painterId && painterId !== localClientId && room.peers[painterId]) {
                    const incrementAmount = justLost ? 5 : 1;
                    room.requestPresenceUpdate(painterId, {
                        type: 'incrementScore',
                        amount: incrementAmount
                    });

                    const painterUsername = room.peers[painterId]?.username || 'Player';
                    const localUsername = room.peers[localClientId]?.username || 'Player';

                    // Score notifications remain LOCAL for now to avoid spam
                    if (justLost) {
                        addNotification(`${painterUsername} scored ${incrementAmount} points for painting out ${localUsername}!`, 'score', 4000);
                    } else if (Math.random() < 0.2) {
                        addNotification(`${painterUsername} scored a point for painting ${localUsername}`, 'info', 2000);
                    }
                }
            });
        }
    }

    return { dropletsToRemove, collisionPoints };
}