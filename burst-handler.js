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
        console.log(`Big Burst active (on empty)! Applying multipliers: ${finalNumDroplets} droplets, ${finalSpreadRadius} radius.`);
        // Note: Consumption logic needs to be handled where presence is updated (playerInteractions.js).
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

/**
 * Handles the creation of a paint burst when the player releases the charge manually (e.g., mouse up).
 * Checks for the 'Big Burst' power-up and applies multipliers if active.
 * Generates presence updates required to consume the power-up if used.
 *
 * @param {string} clientId - The ID of the player triggering the burst.
 * @param {object} canState - The state of the paint can being released { id, x, y, paintColor, accumulatedDroplets }.
 * @param {object} presence - The player's presence data { bigBurstActive, activePowerUps }.
 * @param {number} now - The current timestamp (Date.now()).
 * @returns {{ newDroplets: object, paintCanUpdates: object, presenceUpdates: object }} - Droplets, can updates, and presence updates.
 */
export function handleManualBurst(clientId, canState, presence, now) {
    const accumulated = canState.accumulatedDroplets || 0;
    let paintCanUpdates = {
        isCharging: false, // Always stop charging on mouse up
        accumulatedDroplets: 0 // Always reset accumulation on manual burst
    };
    let newDroplets = {};
    let presenceUpdates = {};

    if (accumulated <= 0) {
        // No burst needed, just return the can update
        return { newDroplets, paintCanUpdates, presenceUpdates };
    }

    console.log(`Manual burst triggered by ${clientId} for can ${canState.id}`);

    let finalNumDroplets = accumulated;
    let finalSpreadRadius = config.burstSpreadRadius;
    const isBigBurstActive = presence?.bigBurstActive || false;

    if (isBigBurstActive) {
        finalNumDroplets = Math.round(accumulated * config.bigBurstDropletMultiplier);
        finalSpreadRadius = config.burstSpreadRadius * config.bigBurstRangeMultiplier;
        console.log(`Manual Burst: Big Burst active! Applying multipliers: ${finalNumDroplets} droplets, ${finalSpreadRadius} radius.`);

        // Generate presence updates to consume the power-up
        presenceUpdates.bigBurstActive = false; // Set flag to false
        // Remove from activePowerUps tracking
        if (presence.activePowerUps && presence.activePowerUps['bigBurst']) {
            // Create a new object for updates to avoid modifying the original presence directly
            presenceUpdates.activePowerUps = { ...presence.activePowerUps };
            delete presenceUpdates.activePowerUps['bigBurst']; // Remove the specific entry
        }
        console.log("Generated presence updates to consume Big Burst power-up after manual burst.");
    }

    // Create the burst droplets using the calculated parameters
    newDroplets = createBurstDroplets(
        clientId,
        canState,
        finalNumDroplets,
        finalSpreadRadius,
        now
    );

    // Return all updates
    return { newDroplets, paintCanUpdates, presenceUpdates };
}