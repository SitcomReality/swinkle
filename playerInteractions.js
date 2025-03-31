/**
 * playerInteractions.js
 * Handles interactions initiated by the player, specifically paint can charging and dropping.
 */
import config from 'config';

// Maintain state for auto-dropping timer PER CAN - This needs to be managed carefully.
// For simplicity, let's assume only one can is handled per client at a time,
// so a single timer variable is sufficient for the local client.
// If players could control multiple things simultaneously, this would need a map.
let timeSinceLastAutoDrop = 0; // Milliseconds

/**
 * Handles paint can charging and auto-dropping logic for the local client's owned can.
 * @param {string} localClientId - The ID of the local client.
 * @param {object} canState - The current state of the paint can being interacted with.
 * @param {number} deltaTime - Time elapsed since the last frame in seconds.
 * @param {number} now - The current timestamp (Date.now()).
 * @returns {{ paintCanUpdates: object, newDroplets: object }} - Updates to send to roomState.
 */
export function handleCanInteractions(localClientId, canState, deltaTime, now) {
    const paintCanUpdates = {}; // Updates for the paintCans state object
    const newDroplets = {};     // Updates for the droplets state object

    const currentPaintAmount = canState.paintAmount || 0;
    const currentAccumulated = canState.accumulatedDroplets || 0;

    if (canState.isCharging && currentPaintAmount > 0) {
        // --- Charging Logic ---
        const chargeRate = config.paintCanChargingSpeed; // Units per second
        const maxAccumulation = config.paintCanMaxAccumulatedDroplets;

        // Calculate how much paint would be consumed and how many droplets accumulated this frame
        const paintToConsume = chargeRate * deltaTime;
        const dropletsToAccumulate = chargeRate * deltaTime; // Assuming 1 unit paint = 1 droplet potential

        // Determine actual amounts considering remaining paint and max accumulation
        const actualPaintConsumed = Math.min(paintToConsume, currentPaintAmount);
        const actualDropletsAccumulated = Math.min(dropletsToAccumulate, maxAccumulation - currentAccumulated, actualPaintConsumed);

        if (actualDropletsAccumulated > 0 || actualPaintConsumed > 0) {
             // Apply the changes to the update batch
             paintCanUpdates.paintAmount = Math.max(0, currentPaintAmount - actualPaintConsumed);
             paintCanUpdates.accumulatedDroplets = Math.min(maxAccumulation, currentAccumulated + actualDropletsAccumulated);
            // console.log(`Charging: Consumed ${actualPaintConsumed.toFixed(2)}, Accumulated ${actualDropletsAccumulated.toFixed(2)}. New Amount: ${paintCanUpdates.paintAmount.toFixed(2)}, New Acc: ${paintCanUpdates.accumulatedDroplets.toFixed(2)}`);
        }
        // Reset auto-drop timer while charging
        timeSinceLastAutoDrop = 0;

    } else if (!canState.isCharging && currentPaintAmount > 0) {
        // --- Auto-Dropping Logic ---
        timeSinceLastAutoDrop += deltaTime * 1000; // Accumulate time in ms
        const autoDropInterval = 1000 / config.paintCanAutoDropRate; // ms per drop

        let dropsThisFrame = 0;
        while (timeSinceLastAutoDrop >= autoDropInterval && (currentPaintAmount - dropsThisFrame) > 0) {
            timeSinceLastAutoDrop -= autoDropInterval;
            dropsThisFrame++;

            // Create the droplet object
            const dropletId = `${localClientId}-${now}-auto-${dropsThisFrame}`; // Use 'now' for uniqueness
            newDroplets[dropletId] = {
                id: dropletId,
                ownerId: localClientId,
                color: canState.paintColor,
                x: canState.x, // Use current (updated) can position
                y: canState.y,
                createdAt: now // Use consistent timestamp for frame
            };
            // console.log(`Auto-dropping droplet ${dropletId}`);
        }

        if (dropsThisFrame > 0) {
            // Update paint amount in the update batch
            paintCanUpdates.paintAmount = Math.max(0, currentPaintAmount - dropsThisFrame);
            // console.log(`Dropped ${dropsThisFrame}. New Amount: ${paintCanUpdates.paintAmount}`);
        }
    } else {
         // Not charging, no paint, or invalid state - reset timer just in case
         timeSinceLastAutoDrop = 0;
    }

    return { paintCanUpdates, newDroplets };
}
