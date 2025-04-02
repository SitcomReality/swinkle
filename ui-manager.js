/**
 * ui-manager.js
 * Manages UI elements like the paint level indicator
 */
import config from 'config';

// UI Element References
let paintIndicatorElement;
let paintIndicatorFillElement;
let paintIndicatorTextElement;
let paintIndicatorLabelElement;
let scoreboardElement; // Add reference for scoreboard

/**
 * Initialize UI elements
 */
export function initializeUI() {
    // Get UI element references
    paintIndicatorElement = document.getElementById('paint-level-indicator');
    if (paintIndicatorElement) {
        paintIndicatorFillElement = paintIndicatorElement.querySelector('.indicator-bar-fill');
        paintIndicatorTextElement = paintIndicatorElement.querySelector('.indicator-text');
        paintIndicatorLabelElement = paintIndicatorElement.querySelector('.indicator-label'); // Get label element
        if (!paintIndicatorFillElement || !paintIndicatorTextElement || !paintIndicatorLabelElement) {
            console.error("Paint level indicator elements not found!");
            paintIndicatorElement = null; // Disable if children are missing
        }
    } else {
        console.error("Paint level indicator container not found!");
    }

    // Get scoreboard reference
    scoreboardElement = document.getElementById('scoreboard');
    if (!scoreboardElement) {
        console.error("Scoreboard element not found!");
    }
}

/**
 * Updates the paint level indicator UI element. Accounts for Mega Cans.
 * @param {string} localClientId - The ID of the local client
 * @param {object} presence - The local player's presence data
 * @param {object} paintCans - Current paint cans from roomState
 */
export function updatePaintLevelIndicator(localClientId, presence, paintCans) {
    if (!paintIndicatorElement || !paintIndicatorLabelElement) return; // Elements not ready

    if (presence && !presence.lost && presence.currentCanId && paintCans[presence.currentCanId]) {
        const canState = paintCans[presence.currentCanId];
        const isMega = canState.isMega || false;
        const maxAmount = isMega
            ? config.paintCanInitialAmount * config.megaCanCapacityMultiplier
            : config.paintCanInitialAmount;
        const currentAmount = canState.paintAmount || 0;
        const fillRatio = Math.max(0, Math.min(1, currentAmount / maxAmount));
        const percentage = (fillRatio * 100).toFixed(0);

        paintIndicatorFillElement.style.width = `${fillRatio * 100}%`;
        paintIndicatorFillElement.style.backgroundColor = canState.paintColor || config.dropletColor; // Match can color
        paintIndicatorTextElement.textContent = `${percentage}%`;
        paintIndicatorLabelElement.textContent = isMega ? 'Mega Ink Can!' : 'Ink Can'; // Update label for mega cans
        paintIndicatorElement.style.borderColor = isMega ? config.megaCanIndicatorColor : '#0ff'; // Change border for mega cans
        paintIndicatorElement.style.boxShadow = isMega ? `0 0 10px ${config.megaCanIndicatorColor}` : '0 0 10px #0ff'; // Change shadow for mega cans
        paintIndicatorElement.style.display = 'block'; // Show the indicator
    } else {
        paintIndicatorElement.style.display = 'none'; // Hide if no can or lost
    }
}

/**
 * Updates the style of the scoreboard (e.g., opacity) based on spectating state.
 * @param {boolean} isSpectating - Whether the local player is currently spectating.
 */
export function updateScoreboardStyle(isSpectating) {
    if (!scoreboardElement) return; // Scoreboard element not found

    const targetOpacity = isSpectating ? 1.0 : 0.25;
    // Only update if the opacity needs to change to avoid unnecessary style recalculations
    if (parseFloat(scoreboardElement.style.opacity) !== targetOpacity) {
         scoreboardElement.style.opacity = targetOpacity;
    }
}