/**
 * paint-burst.js
 * Handles creating explosion of paint droplets when a player is painted out
 * or when a charged paint can is released.
 */
import config from 'config';
import { calculatePaintOnlyBlendedColor } from './colorUtils.js';

/**
 * Creates a burst of paint droplets when a player is painted out.
 * This function now directly uses `config.paintOutBurstRadius` for its spread.
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
    const spreadRadius = config.paintOutBurstRadius || 200; // Use specific paint-out radius

    // Calculate weighted color based on the painted data
    const blendedColor = calculatePaintOnlyBlendedColor(paintedData);

    for (let i = 0; i < numDroplets; i++) {
        const dropletId = `paintout-${playerId}-${now}-${i}`;

        // Random angle for 360-degree burst
        const angle = Math.random() * Math.PI * 2;

        // Random speed and distance scaling
        const speed = Math.random() * maxSpeed; // Still use speed for potential future movement
        // Random radius with bias toward center (square root makes distribution more toward edges)
        const radius = Math.sqrt(Math.random()) * spreadRadius; // Use paint-out specific radius

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

/**
 * Creates the droplet data for a paint burst released from a can.
 * Accepts a spreadRadius parameter.
 * @param {string} ownerId - The ID of the player releasing the burst.
 * @param {object} canState - The state of the can releasing the burst { x, y, paintColor }.
 * @param {number} numDroplets - The number of droplets to create.
 * @param {number} spreadRadius - The radius within which droplets should spread.
 * @param {number} now - The current timestamp.
 * @returns {object} An object containing droplet data keyed by unique droplet IDs.
 */
export function createBurstDroplets(ownerId, canState, numDroplets, spreadRadius, now) {
    const burstDroplets = {};
    const canX = canState.x;
    const canY = canState.y;

    for (let i = 0; i < numDroplets; i++) {
        const dropletId = `${ownerId}-${now}-burst-${i}`;
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * spreadRadius; // Random distance within the provided spread radius
        burstDroplets[dropletId] = {
            id: dropletId,
            ownerId: ownerId,
            color: canState.paintColor,
            x: canX + Math.cos(angle) * radius,
            y: canY + Math.sin(angle) * radius,
            createdAt: now
        };
    }
    return burstDroplets;
}