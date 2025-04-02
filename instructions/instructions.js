/**
 * instructions.js
 * Handles showing gameplay instructions/tips during spectator mode
 */

// Store references to DOM elements
let instructionsContainer;
let titleElement;
let instructionList;

/**
 * Initializes the instructions system by creating DOM elements
 */
export function initializeInstructions() {
    instructionsContainer = document.createElement('div');
    instructionsContainer.id = 'instructions-container';
    instructionsContainer.classList.add('hidden');

    titleElement = document.createElement('h1');
    titleElement.id = 'swinkle-title';
    
    // Create SWINKLE title with colored letters, INK separated
    titleElement.innerHTML = `
        <span class="sw-letter">S</span>
        <span class="sw-letter">W</span>
        <span class="ink-letters">I</span>
        <span class="ink-letters">N</span>
        <span class="ink-letters">K</span>
        <span class="sw-letter">L</span>
        <span class="sw-letter">E</span>
    `;

    instructionList = document.createElement('ul');
    instructionList.id = 'instructions-list';

    // Add instruction items with keywords wrapped in spans
    const instructions = [
        `<strong><span class="keyword">INK</span> Basics</strong>: Collect <span class="keyword">ink cans</span> to spray opponents. Get their <span class="keyword">INK</span> <span class="percentage">100%</span> to knock them out!`,
        `<strong><span class="keyword">Droplets</span></strong>: <span class="keyword">Ink</span> droplets appear where you spray. They stay briefly before fading.`,
        `<strong><span class="keyword">Stealth</span></strong>: You can't see ink cans carried by other players - watch for their droplet trails!`,
        `<strong><span class="keyword">Bursts</span></strong>: <span class="action">Hold Click</span> to charge, <span class="action">Release</span> for an <span class="keyword">ink burst</span> of concentrated droplets.`,
        `<strong><span class="keyword">Power-ups</span></strong>: <span class="powerup-icon powerup-icon-bigBurst">✦</span> = <span class="powerup-name">Big Burst</span> | <span class="powerup-icon powerup-icon-shortRope">✦</span> = <span class="powerup-name">Short Rope</span> | <span class="powerup-icon powerup-icon-shield">✦</span> = <span class="powerup-name">Shield</span>`,
        `<strong><span class="keyword">Spectate</span></strong>: Press <span class="action">ESC</span> to toggle Spectate mode. <span class="action">Click</span> to rejoin the game!`
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
    if (!instructionsContainer) return;
    
    if (isSpectating) {
        instructionsContainer.classList.remove('hidden');
    } else {
        instructionsContainer.classList.add('hidden');
    }
}