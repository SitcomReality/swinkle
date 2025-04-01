/**
 * level-transition.js
 * Handles animated transitions between levels.
 */
import { powerUpDefinitions } from './power-ups/power-up-data.js';
import config from 'config';
import { hexToRgb, calculateBlendedColor } from './colorUtils.js'; // Import for color blending
// Import level manager directly to update its state
import * as levelManager from './level-manager.js';

// Transition state
let isTransitioning = false;
let transitionStartTime = 0;
let oldLevelData = null;
let newLevelData = null;
let oldBgColor = null;
let newBgColor = null;
let transitionPhase = 'idle'; // 'idle', 'fade_out', 'fade_in'
let progress = 0; // Progress within the current phase (0 to 1)

// Durations (in milliseconds)
const FADE_OUT_DURATION = 250;
const FADE_IN_DURATION = 400;
const TOTAL_DURATION = FADE_OUT_DURATION + FADE_IN_DURATION;

/**
 * Starts the level transition animation.
 * @param {object} oldData - The data of the level being transitioned FROM.
 * @param {object} newData - The data of the level being transitioned TO.
 */
export function startLevelTransition(oldData, newData) {
    if (!newData) {
        console.error("Level Transition: Cannot start transition, new level data is missing.");
        return;
    }
    if (isTransitioning) {
        console.warn("Level Transition: Already transitioning, ignoring new request.");
        return;
    }
    console.log(`Starting level transition from ${oldData?.id || 'none'} to ${newData.id}`);
    isTransitioning = true;
    transitionStartTime = Date.now();
    oldLevelData = oldData;
    newLevelData = newData;
    // Store background colors for smooth blending
    oldBgColor = hexToRgb(oldData?.backgroundColor || '#0a0a1e');
    newBgColor = hexToRgb(newData.backgroundColor || '#0a0a1e');
    transitionPhase = 'fade_out';
    progress = 0;

    // Potentially clear effects or other elements tied to the old level here
    import('./effectsRenderer.js').then(({ clearEffects }) => clearEffects());
}

/**
 * Updates the transition progress and phase. Should be called every frame.
 * Also handles smooth background color update.
 * @param {number} deltaTime - Time since last frame in seconds.
 * @param {number} now - Current timestamp (Date.now()).
 */
export function updateLevelTransition(deltaTime, now) {
    if (!isTransitioning) return;

    const elapsed = now - transitionStartTime;

    // Determine phase and progress
    if (elapsed < FADE_OUT_DURATION) {
        transitionPhase = 'fade_out';
        progress = Math.min(1, elapsed / FADE_OUT_DURATION);
    } else if (elapsed < TOTAL_DURATION) {
        transitionPhase = 'fade_in';
        progress = Math.min(1, (elapsed - FADE_OUT_DURATION) / FADE_IN_DURATION);
    } else {
        // Transition finished
        // Set final background color precisely
        document.body.style.backgroundColor = newLevelData?.backgroundColor || '#0a0a1e';
        // Immediately update the level manager's state *before* setting isTransitioning to false
        levelManager.setCurrentLevelDataFromTransition(newLevelData);
        // Now mark transition as complete
        isTransitioning = false;
        transitionPhase = 'idle';
        progress = 0;
        console.log("Level transition finished.");
        // Remove notification call - level manager update is now synchronous
        // import('./level-manager.js').then(manager => manager.notifyTransitionComplete(newLevelData));
        return;
    }

    // Smoothly update background color
    if (oldBgColor && newBgColor) {
        let currentProgress = 0;
        if (transitionPhase === 'fade_out') {
            // Fade progresses from 0 to 1 during fade_out phase
            currentProgress = progress * 0.5; // Reach halfway color blend at end of fade_out
        } else { // fade_in phase
            // Fade progresses from 0 to 1 during fade_in phase
            // We need total progress from 0 (start of fade_out) to 1 (end of fade_in)
            currentProgress = 0.5 + (progress * 0.5); // Start from halfway color, end at full new color
        }

        // Clamp progress just in case
        currentProgress = Math.max(0, Math.min(1, currentProgress));

        // Linear interpolation between old and new RGB colors
        const r = Math.round(oldBgColor.r + (newBgColor.r - oldBgColor.r) * currentProgress);
        const g = Math.round(oldBgColor.g + (newBgColor.g - oldBgColor.g) * currentProgress);
        const b = Math.round(oldBgColor.b + (newBgColor.b - oldBgColor.b) * currentProgress);

        document.body.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    } else {
        // Fallback if colors are invalid
        document.body.style.backgroundColor = newLevelData?.backgroundColor || '#0a0a1e';
    }
}

// --- Getters for other modules ---

export function isTransitionActive() {
    return isTransitioning;
}

export function getTransitionPhase() {
    return transitionPhase;
}

export function getOldLevelData() {
    return oldLevelData;
}

export function getNewLevelData() {
    return newLevelData;
}

export function getProgress() {
    // Returns progress (0-1) specific to the current phase
    return progress;
}