/**
 * paint-burst.js
 * Handles creating an explosion of paint droplets when a player is painted out
 */
import config from 'config';
import { calculatePaintOnlyBlendedColor } from './colorUtils.js';

/**
 * Creates a burst of paint droplets when a player is painted out.
 * 
 * @param {string} playerId - The ID of the player who was painted out.
 * @param {object} playerPos - The final position of the player {x, y}.
 * @param {object} paintedData - The player's paintedData object containing colors and percentages.
 * @param {number} now - Current timestamp.
 * @returns {object} An object containing droplet data keyed by unique droplet IDs.
 */
export function createPaintBurst(playerId, playerPos, paintedData, now) {
    const burstDroplets = {};
    
    // Get parameters from config or use defaults
    const numDroplets = config.paintOutBurstParticles || 60; // Lots of droplets for dramatic effect
    const maxSpeed = config.paintOutBurstSpeed || 300; // Pixels per second
    const spreadRadius = config.paintOutBurstRadius || 150; // Maximum distance particles travel
    
    // Calculate weighted color based on the painted data
    const blendedColor = calculatePaintOnlyBlendedColor(paintedData);
    
    for (let i = 0; i < numDroplets; i++) {
        const dropletId = `paintout-${playerId}-${now}-${i}`;
        
        // Random angle for 360-degree burst
        const angle = Math.random() * Math.PI * 2;
        
        // Random speed and distance scaling
        const speed = Math.random() * maxSpeed;
        // Random radius with bias toward center (square root makes distribution more toward edges)
        const radius = Math.sqrt(Math.random()) * spreadRadius;
        
        // Calculate position with small random offset from player center
        const offsetX = Math.random() * 20 - 10;
        const offsetY = Math.random() * 20 - 10;
        
        burstDroplets[dropletId] = {
            id: dropletId,
            ownerId: playerId, // Keep track of which player this came from
            color: blendedColor, // Use their blended paint color
            x: playerPos.x + offsetX,
            y: playerPos.y + offsetY,
            // These droplets don't move - they're just for visual effect
            createdAt: now
        };
    }
    
    return burstDroplets;
}