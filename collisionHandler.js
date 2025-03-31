/**
 * collisionHandler.js
 * Handles collision detection between game objects, particularly players and droplets.
 */
import config from 'config';
import { room } from './main.js';

/**
 * Checks for collisions between the local player and all droplets.
 * Updates the player's painted data when hit by another player's droplet.
 * 
 * @param {object} playerBodyPos - The body position of the local player {x, y}.
 * @param {object} droplets - The current droplets in the room state.
 * @param {string} localClientId - The ID of the local client.
 * @param {object} currentPaintedData - The player's current painted data.
 * @returns {object} Droplets to remove (for roomState update).
 */
export function checkCollisionsWithPlayer(playerBodyPos, droplets, localClientId, currentPaintedData = {}) {
    const dropletsToRemove = {};
    const bodyWidth = config.playerBodyWidth;
    const bodyHeight = config.playerBodyHeight;
    let paintedUpdates = {};
    let paintingOccurred = false;

    // Simple rectangular hitbox for the player capsule
    const playerHitbox = {
        left: playerBodyPos.x - bodyWidth / 2,
        right: playerBodyPos.x + bodyWidth / 2,
        top: playerBodyPos.y - bodyHeight / 2,
        bottom: playerBodyPos.y + bodyHeight / 2
    };

    Object.entries(droplets).forEach(([dropletId, droplet]) => {
        // Skip if droplet doesn't exist or is owned by the local player
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
            console.log(`Player ${localClientId} hit by droplet ${dropletId} (color: ${droplet.color})`);
            
            // Mark this droplet for removal
            dropletsToRemove[dropletId] = null;
            
            // Update painted data: increment the percentage for this color
            const currentPercentage = currentPaintedData[droplet.color] || 0;
            const incrementAmount = 2; // 2% per droplet hit
            paintedUpdates[droplet.color] = currentPercentage + incrementAmount;
            paintingOccurred = true;
        }
    });
    
    // If any painting occurred, update the player's painted data
    if (paintingOccurred) {
        // Calculate total paint percentage (for potential loss condition later)
        let totalPercentage = 0;
        const updatedPaintedData = { ...currentPaintedData, ...paintedUpdates };
        
        Object.values(updatedPaintedData).forEach(percentage => {
            totalPercentage += percentage;
        });
        
        console.log(`Player ${localClientId} painted: ${totalPercentage}% total`);
        
        // Update player presence with new painted data
        room.updatePresence({ paintedData: updatedPaintedData });
        
        // Basic loss condition check (just a console message for now)
        if (totalPercentage >= 100) {
            console.log(`Player ${localClientId} has been fully painted! (${totalPercentage}%)`);
        }
    }
    
    return dropletsToRemove;
}