/**
 * droplet-manager.js
 * Manages droplet lifecycle and expiration
 */
import config from 'config';

/**
 * Checks for expired droplets that should be removed
 * @param {object} droplets - Current droplets from roomState
 * @param {number} now - Current timestamp
 * @returns {object} Expired droplets to remove (with null values)
 */
export function checkExpiredDroplets(droplets, now) {
    const expiredDroplets = {};
    
    Object.entries(droplets).forEach(([id, droplet]) => {
        if (!droplet) return;
        
        const age = now - droplet.createdAt;
        if (age > config.dropletDuration) {
            expiredDroplets[id] = null;
        }
    });
    
    return expiredDroplets;
}