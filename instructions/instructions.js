/**
 * instructions.js
 * Handles showing gameplay instructions/tips during spectator mode
 */
import config from '../config.js';
import { triggerManualRespawn } from '../respawn-manager.js';
import { broadcastNotification } from '../notification-broadcaster.js';
import { resetIdleTimer } from '../local-state.js';
// Import power-up data to list all power-ups
import { powerUpDefinitions } from '../power-ups/power-up-data.js';

// Store references to DOM elements
let instructionsContainer;
let titleElement;
let instructionList;
let instructionRoom = null; // Store room instance

/**
 * Generates the HTML string for a power-up icon.
 * @param {string} powerUpId - The ID of the power-up (e.g., 'shield').
 * @returns {string} - The HTML span element for the icon.
 */
function getPowerUpIconHtml(powerUpId) {
    const definition = powerUpDefinitions[powerUpId];
    if (!definition) return '';
    // Use the power-up ID as the class name suffix for styling
    return `<span class="powerup-icon powerup-icon-${powerUpId}" style="color:${definition.color || '#FFFFFF'};">✦</span>`;
}

/**
 * Initializes the instructions system by creating DOM elements and adding listeners.
 * @param {object} room - The WebsimSocket room instance.
 */
export function initializeInstructions(room) {
    if (!room) {
        console.error("Instructions initialization requires a valid room instance.");
        return;
    }
    instructionRoom = room;

    instructionsContainer = document.createElement('div');
    instructionsContainer.id = 'instructions-container';
    instructionsContainer.classList.add('hidden');
    // Allow pointer events on the container itself
    instructionsContainer.style.pointerEvents = 'auto';

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

    // Generate power-up list string
    let powerUpListString = '';
    Object.values(powerUpDefinitions).forEach((def, index) => {
        powerUpListString += `${getPowerUpIconHtml(def.id)} = <span class="powerup-name" style="color:${def.glowColor || def.color};">${def.name}</span>`;
        if (index < Object.values(powerUpDefinitions).length - 1) {
            powerUpListString += ' | '; // Separator
        }
    });

    // Add instruction items with keywords wrapped in spans
    // Use <span class="keyword-ink"> for pink 'ink' keyword
    const instructions = [
        `<strong><span class="keyword">Basics</span></strong>: Collect <span class="keyword-ink">ink</span> cans. Held cans automatically leave a trail of <span class="keyword-ink">ink</span> droplets. Hit opponents with droplets to raise their <span class="keyword-ink">INK</span> percentage. <span class="percentage">100%</span> <span class="keyword-ink">INK</span> = Knockout!`,
        `<strong><span class="keyword">Droplets</span></strong>: <span class="keyword-ink">Ink</span> droplets appear behind carried cans and from <span class="keyword-ink">ink</span> bursts. They stay briefly before fading.`,
        `<strong><span class="keyword">Stealth</span></strong>: You can't see <span class="keyword-ink">ink</span> cans carried by other players - watch their droplet trails!`,
        `<strong><span class="keyword">Bursts</span></strong>: <span class="action">Hold Click</span> to charge your held can, <span class="action">Release</span> for an <span class="keyword-ink">ink burst</span> of concentrated droplets. Charging temporarily stops the droplet trail.`,
        `<strong><span class="keyword">Power-ups</span></strong>: ${powerUpListString}`,
        `<strong><span class="keyword">Spectate</span></strong>: Press <span class="action">ESC</span> or <span class="action">Click These Instructions</span> to rejoin the game!`
    ];

    instructions.forEach(text => {
        const item = document.createElement('li');
        item.innerHTML = text; // Use innerHTML to render spans
        instructionList.appendChild(item);
    });

    instructionsContainer.appendChild(titleElement);
    instructionsContainer.appendChild(instructionList);
    document.body.appendChild(instructionsContainer);

    // --- Add Click Listener to Instructions Container ---
    instructionsContainer.addEventListener('click', handleInstructionsClick);
}

/**
 * Handles clicks on the instructions panel to exit spectator mode.
 * @param {MouseEvent} e - The click event object.
 */
function handleInstructionsClick(e) {
    // Ensure room and client ID are available
    if (!instructionRoom || !instructionRoom.clientId) return;

    const localClientId = instructionRoom.clientId;
    const localPresence = instructionRoom.presence[localClientId];

    // Check if player is spectating
    if (localPresence && localPresence.isSpectating) {
        console.log(`Instructions panel clicked while spectating: Respawning player ${localClientId}.`);
        const now = Date.now(); // Get current time for animation end time

        // Use triggerManualRespawn, respawning at the current anchor position
        // No clickX/clickY needed as we're not using the click position
        const respawnUpdates = triggerManualRespawn(
            localClientId,
            localPresence,
            config.gameAreaWidth,
            config.gameAreaHeight,
            now // Pass current time
            // Use current anchor position by default in triggerManualRespawn
        );

        // Send the presence update to rejoin the game
        instructionRoom.updatePresence(respawnUpdates);

        // Send notification
        const username = instructionRoom.peers[localClientId]?.username || 'Player';
        broadcastNotification(`${username} respawned!`, 'info', 3000);

        // Reset idle timer state immediately upon rejoining
        resetIdleTimer({ x: respawnUpdates.x, y: respawnUpdates.y });

        // Explicitly hide instructions panel (though triggerManualRespawn might also do it)
        toggleInstructions(false);
    }
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