/**
 * burst-handler.js
 * Handles the logic for creating paint bursts, including checking for power-ups.
 */
import config from 'config';
import { createBurstDroplets } from './paint-burst.js';

/**
 * Handles the creation of a paint burst when a can runs out of paint while charging.
 * Checks for the 'Big Burst' power-up and applies multipliers if active.
 *
 * @param {string} clientId - The ID of the player whose can is bursting.
 * @param {object} canState - The state of the paint can just before bursting { id, x, y, paintColor, accumulatedDroplets }.
 * @param {object} presence - The player's presence data { bigBurstActive }.
 * @param {number} now - The current timestamp (Date.now()).
 * @returns {{ newDroplets: object, paintCanUpdates: object }} - Droplets created and updates for the can.
 */
export function handleBurstOnEmpty(clientId, canState, presence, now) {
    const accumulated = canState.accumulatedDroplets || 0;
    if (accumulated <= 0) {
        return { newDroplets: {}, paintCanUpdates: {} }; // No burst if no accumulation
    }

    console.log(`Can ${canState.id} ran out while charging, attempting burst for ${clientId}`);

    let finalNumDroplets = accumulated;
    let finalSpreadRadius = config.burstSpreadRadius;
    const isBigBurstActive = presence?.bigBurstActive || false;

    if (isBigBurstActive) {
        finalNumDroplets = Math.round(accumulated * config.bigBurstDropletMultiplier);
        finalSpreadRadius = config.burstSpreadRadius * config.bigBurstRangeMultiplier;
        console.log(`Big Burst active! Applying multipliers: ${finalNumDroplets} droplets, ${finalSpreadRadius} radius.`);
        // Consume the Big Burst power-up immediately after use (presence update needed)
        // Note: We return the *request* for the presence update, the caller needs to apply it.
        // This function itself shouldn't directly modify presence.
        // For now, we just calculate based on the flag. Consumption logic needs to be handled where presence is updated.
    }

    // Create the burst droplets using the calculated parameters
    const burstDroplets = createBurstDroplets(
        clientId,
        canState,
        finalNumDroplets,
        finalSpreadRadius,
        now
    );

    // Return the droplets and the can update to reset accumulation
    return {
        newDroplets: burstDroplets,
        paintCanUpdates: {
            accumulatedDroplets: 0 // Reset accumulation since it burst
        }
    };
}

// TODO: Add handleManualBurst function here later when refactoring from main.js