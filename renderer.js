/**
 * renderer.js
 * Handles the overall rendering orchestration for the game scene.
 * Imports and calls specific render functions for different game elements.
 */
import config from 'config';
// Rendering Modules
import { renderPlayer } from './playerRenderer.js';
import { renderPaintCan } from './paintCan.js';
import { renderDroplets } from './dropletRenderer.js';
import { updateAndRenderEffects } from './effectsRenderer.js';
import { renderLevel } from './level-renderer.js'; // Now handles transitions internally
import { renderPowerUp } from './power-ups/power-up-renderer.js';
// Note: renderNotifications is no longer called here for canvas drawing
// import { renderNotifications } from './notification-manager.js';
import { renderBoundaries } from './boundary-renderer.js'; // Import boundary renderer
import { renderSpectateUI } from './spectate-mode.js'; // Import spectator UI renderer

/**
 * Initializes any setup needed for the renderer (currently none).
 */
export function initializeRenderer() {
    console.log("Renderer initialized.");
}

/**
 * Renders the entire game scene onto the canvas.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {object} roomInstance - The WebsimSocket room instance containing game state.
 * @param {string} localClientId - The ID of the current user's client.
 * @param {number} now - The current timestamp (Date.now()).
 * @param {number} deltaTime - Time elapsed since the last frame in seconds.
 */
export function renderScene(ctx, roomInstance, localClientId, now, deltaTime) {
    // Canvas size is set in game loop before clearing

    // --- Render Background Elements ---
    // Background color is handled by level-transition.js updating body style
    renderBoundaries(ctx); // Render the game boundaries
    renderLevel(ctx); // Render level obstacles (handles transitions internally)

    // --- Render Dynamic Game Elements ---
    updateAndRenderEffects(ctx, deltaTime, now); // Render effects (e.g., splats)

    const dropletsToRender = roomInstance.roomState.droplets || {};
    renderDroplets(ctx, dropletsToRender, now);

    const availableCansToRender = roomInstance.roomState.availablePaintCans || {};
    Object.values(availableCansToRender).forEach(canState => {
        if (canState) renderPaintCan(ctx, canState);
    });

    // Render Active Power-ups
    const powerUpsToRender = roomInstance.roomState.powerUps || {};
    Object.values(powerUpsToRender).forEach(powerUpState => {
        if (powerUpState) renderPowerUp(ctx, powerUpState, now);
    });

    const ownedCansToRender = roomInstance.roomState.paintCans || {}; // Needed for rendering held cans
    Object.entries(roomInstance.peers).forEach(([clientId, peer]) => {
        const presence = roomInstance.presence[clientId];
        if (presence) { // Ensure presence exists before rendering
            // Pass the synchronized roomState owned cans for rendering
            renderPlayer(ctx, clientId, localClientId, presence, peer, ownedCansToRender, roomInstance);
        }
    });

    // --- Render Overlay Elements ---
    // Notifications are now handled via DOM in notification-manager.js,
    // so no explicit call to renderNotifications(ctx, now) needed here.

    // Render Spectator UI Reminder (only for local player if spectating)
    const localPresence = roomInstance.presence[localClientId];
    if (localPresence) {
        renderSpectateUI(ctx, localPresence.isSpectating);
    }
}