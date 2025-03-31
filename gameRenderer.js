/**
 * gameRenderer.js
 * Handles all canvas drawing operations for the game.
 */
import config from 'config';
// Player facade
import { renderPlayer } from './player.js';
// Paint Can
import { renderPaintCan } from './paintCan.js';
// Droplets
import { renderDroplets } from './dropletRenderer.js';
// Effects
import { updateAndRenderEffects } from './effectsRenderer.js';

/**
 * Updates the paint level indicator UI element based on the local player's state.
 * @param {object} roomInstance - The WebsimSocket room instance.
 * @param {string} localClientId - The ID of the local client.
 * @param {HTMLElement} paintIndicatorElement - The container element.
 * @param {HTMLElement} paintIndicatorFillElement - The fill bar element.
 * @param {HTMLElement} paintIndicatorTextElement - The text element.
 */
function updatePaintLevelIndicator(roomInstance, localClientId, paintIndicatorElement, paintIndicatorFillElement, paintIndicatorTextElement) {
    if (!paintIndicatorElement || !roomInstance) return; // Elements or room not ready

    const presence = roomInstance.presence[localClientId];
    const paintCans = roomInstance.roomState.paintCans || {}; // Owned cans

    // Check if alive and holding a can that exists in the owned cans list
    if (presence && !presence.lost && presence.currentCanId && paintCans[presence.currentCanId]) {
         const canState = paintCans[presence.currentCanId];
         // Double check ownership for safety (might be redundant if gameUpdater handles discrepancies)
         if (canState.ownerId === localClientId) {
            const maxAmount = config.paintCanInitialAmount;
            const currentAmount = canState.paintAmount || 0;
            const fillRatio = Math.max(0, Math.min(1, currentAmount / maxAmount));
            const percentage = (fillRatio * 100).toFixed(0);

            paintIndicatorFillElement.style.width = `${fillRatio * 100}%`;
            paintIndicatorFillElement.style.backgroundColor = canState.paintColor || config.dropletColor; // Match can color
            paintIndicatorTextElement.textContent = `${percentage}%`;
            paintIndicatorElement.style.display = 'block'; // Show the indicator
            return; // Exit if shown
         }
    }

    // Hide if lost, no can, can doesn't exist, or ownership mismatch
    paintIndicatorElement.style.display = 'none';
}


/**
 * Renders the entire game scene onto the canvas.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {object} roomInstance - The WebsimSocket room instance.
 * @param {number} now - The current timestamp (Date.now()).
 * @param {number} deltaTime - Time since last frame (for effects).
 * @param {string} localClientId - The ID of the local client.
 * @param {HTMLElement} paintIndicatorElement - The container element for the paint indicator.
 * @param {HTMLElement} paintIndicatorFillElement - The fill bar element for the paint indicator.
 * @param {HTMLElement} paintIndicatorTextElement - The text element for the paint indicator.
 */
export function renderGame(ctx, roomInstance, now, deltaTime, localClientId, paintIndicatorElement, paintIndicatorFillElement, paintIndicatorTextElement) {
    // --- Clear Canvas ---
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // --- Render Effects ---
    updateAndRenderEffects(ctx, deltaTime, now); // From effectsRenderer.js

    // --- Render Droplets ---
    const dropletsToRender = roomInstance.roomState.droplets || {};
    renderDroplets(ctx, dropletsToRender, now); // From dropletRenderer.js

    // --- Render Available Paint Cans ---
    const availableCansToRender = roomInstance.roomState.availablePaintCans || {};
    Object.values(availableCansToRender).forEach(canState => {
        if (canState) {
            renderPaintCan(ctx, canState); // From paintCan.js (handles static & thrown)
        }
    });

    // --- Render Players and their Owned Cans ---
    const ownedCansToRender = roomInstance.roomState.paintCans || {};
    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        // Pass owned cans state; renderPlayer handles bungee and rendering the specific held can
        renderPlayer(ctx, clientId, localClientId, presence, peer, ownedCansToRender); // From playerRenderer.js
    });

    // --- Update UI Elements ---
    updatePaintLevelIndicator(roomInstance, localClientId, paintIndicatorElement, paintIndicatorFillElement, paintIndicatorTextElement);
}
