/**
 * instructions.js
 * Handles showing gameplay and hiding gameplay instructions
 */
import { renderer } from './renderer.js';

// Store references to DOM elements
let instructionsContainer;
let titleElement;
let instructionList;

// Icon mapping - will be populated with images later
const powerUpIcons = {};

/**
 * Initializes the instructions system by creating DOM elements
 */
export function initializeInstructions() {
    instructionsContainer = document.createElement('div');
    instructionsContainer.id = 'instructions-container';
    instructionsContainer.classList.add('hidden');

    titleElement = document.createElement('h1');
    titleElement.id = 'swinkle-title';
    
    // Create SWINKLE title with colored letters
    titleElement.innerHTML = `
        <span class="sw-letter">S</span>
        <span class="sw-letter">W</span>
        <span class="ink-letters">INK</span>
        <span class="sw-letter">L</span>
        <span class="sw-letter">E</span>
    `;

    instructionList = document.createElement('ul');
    instructionList.id = 'instructions-list';

    // Add instruction items
    const instructions = [
        `<strong>INK Basics</strong>: Collect ink cans to spray opponents. Get their INK % to 100% to knock them out!`,
        `<strong>Droplets</strong>: Ink droplets appear where you spray. They stay briefly before fading.`,
        `<strong>Stealth</strong>: You can't see ink cans carried by other players - watch for their droplet trails!`,
        `<strong>Bursts</strong>: Hold to charge, release for an <em>ink burst</em> of concentrated droplets.`,
        `<strong>Power-ups</strong>: <span class="powerup-icon"></span> = Big Burst | <span class="powerup-icon"></span> = Short Rope | <span class="powerup-icon"></span> = Shield`
    ];

    instructions.forEach(text => {
        const item = document.createElement('li');
        item.innerHTML = text;
        instructionList.appendChild(item);
    });

    instructionsContainer.appendChild(titleElement);
    instructionsContainer.appendChild(instructionList);
    document.body.appendChild(instructionsContainer);
}

/**
 * Shows or hides the instructions based on spectating state
 * @param {boolean} isSpectating - Whether the player is currently spectating
 */
export function toggleInstructions(isSpectating) {
    if (!instructionsContainer) {
        initializeInstructions();
    }
    
    if (isSpectating) {
        instructionsContainer.classList.remove('hidden');
    } else {
        instructionsContainer.classList.add('hidden');
    }
}

/**
 * Updates power-up icons when they become available
 * @param {string} powerUpType - Type identifier ('bigBurst', 'shortRope', 'shield')
 * @param {string} iconUrl - URL of the icon image
 */
export function updatePowerUpIcon(powerUpType, iconUrl) {
    if (!powerUpIcons[powerUpType]) {
        powerUpIcons[powerUpType] = iconUrl;
        const iconElements = document.querySelectorAll(`.powerup-${powerUpType}`);
        iconElements.forEach(el => {
            el.style.backgroundImage = `url(${iconUrl})`;
        });
    }
}

// New function to check if instructions should be shown
export function shouldShowInstructions(presence) {
    return presence && presence.isSpectating;
}