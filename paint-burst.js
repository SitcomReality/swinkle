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
    
    // Get parameters from config or use updated defaults
    const numDroplets = config.paintOutBurstParticles || 120; // Significantly increased droplets
    const maxSpeed = config.paintOutBurstSpeed || 300; // Keep speed the same for now
    const spreadRadius = config.paintOutBurstRadius || 500; // Significantly increased radius
    
    // Calculate weighted color based on the painted data
    const blendedColor = calculatePaintOnlyBlendedColor(paintedData);
    
    for (let i = 0; i < numDroplets; i++) {
        const dropletId = `paintout-${playerId}-${now}-${i}`;
        
        // Random angle for 360-degree burst
        const angle = Math.random() * Math.PI * 2;
        
        // Random speed and distance scaling
        const speed = Math.random() * maxSpeed; // Still use speed for potential future movement
        // Random radius with bias toward center (square root makes distribution more toward edges)
        const radius = Math.sqrt(Math.random()) * spreadRadius; // Use increased radius
        
        // Calculate initial position offset based on random angle and radius
        const offsetX = Math.cos(angle) * radius;
        const offsetY = Math.sin(angle) * radius;
        
        // The actual droplet position is the player's center + the calculated offset
        burstDroplets[dropletId] = {
            id: dropletId,
            ownerId: playerId, // Keep track of which player this came from
            color: blendedColor, // Use their blended paint color
            x: playerPos.x + offsetX,
            y: playerPos.y + offsetY,
            // These droplets don't move - they're just for visual effect (no velocity added)
            createdAt: now
        };
    }
    
    return burstDroplets;
}