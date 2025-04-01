/**
 * power-up-data.js
 * Defines the data structure for all power-ups in the game.
 */
import config from '../config.js'; // Import config to use duration value

/**
 * Power-up definitions with their properties and effects
 * Each power-up has:
 * - id: Unique identifier string
 * - name: Display name for the power-up
 * - description: Text explaining what the power-up does
 * - duration: How long the effect lasts in milliseconds (0 for instant effects)
 * - color: Primary color for the power-up visual
 * - glowColor: Color for the glow effect (usually same as color)
 * - icon: Simple string identifier for what icon to render ('star', 'shield', etc)
 * - size: Visual size for the power-up
 * - rarity: How rare this power-up is (affects spawn rate, 1-10)
 * - effect: Function that applies the power-up effect (stub implementations for now)
 */
export const powerUpDefinitions = {
    'shield': {
        id: 'shield',
        name: 'Paint Shield',
        description: 'Temporarily blocks incoming paint',
        duration: 5000, // 5 seconds
        color: '#88FFFF',
        glowColor: '#00FFFF',
        icon: 'shield',
        size: 25,
        rarity: 4,
        effect: (clientId, presence) => {
            console.log(`Shield effect applied to ${clientId}`);
            // Presence updates to apply
            return {
                shielded: true,
                // Note: activePowerUps tracking is handled by checkPowerUpCollisions automatically for timed effects
            };
        }
    },
    'acetone': {
        id: 'acetone',
        name: 'Acetone',
        description: 'Cleans off paint from your character',
        duration: 0, // Instant effect
        color: '#FFFFFF',
        glowColor: '#CCFFFF',
        icon: 'droplet',
        size: 22,
        rarity: 5,
        effect: (clientId, presence) => {
            console.log(`Acetone effect applied to ${clientId}`);
            return {
                paintedData: {} // Reset painted data
            };
        }
    },
    'spring': {
        id: 'spring',
        name: 'Springy Bungee',
        description: 'Makes your bungee more springy for quick movement',
        duration: 8000, // 8 seconds
        color: '#FFFF00',
        glowColor: '#AAAA00',
        icon: 'spring',
        size: 20,
        rarity: 3,
        effect: (clientId, presence) => {
            console.log(`Spring effect applied to ${clientId}`);
            return {
                springyBungee: true,
                // Note: activePowerUps tracking is handled by checkPowerUpCollisions automatically for timed effects
            };
        }
    },
    'megaCan': {
        id: 'megaCan',
        name: 'Mega Paint Can',
        description: 'Next paint can you pick up will have double capacity',
        duration: 15000, // Until next can pickup or timeout
        color: '#FF88FF',
        glowColor: '#FF00FF',
        icon: 'can',
        size: 28,
        rarity: 2,
        effect: (clientId, presence) => {
            console.log(`Mega can effect applied to ${clientId}`);
            return {
                megaCanPowerup: true,
                // Note: activePowerUps tracking is handled by checkPowerUpCollisions automatically for timed effects
            };
        }
    },
    // --- NEW POWER-UPS ---
    'shortRope': {
        id: 'shortRope',
        name: 'Short Rope',
        description: 'Temporarily shortens your bungee cord',
        duration: config.shortRopeDuration, // Use duration from config
        color: '#FFA500', // Orange
        glowColor: '#FF8C00', // Darker Orange
        icon: 'rope', // New icon ID - need to add rendering later
        size: 24,
        rarity: 4,
        effect: (clientId, presence) => {
            console.log(`Short Rope effect applied to ${clientId}`);
            // Actual effect: Set flag in presence
             return {
                shortRopeActive: true, // Set the flag for physics check
                // Note: activePowerUps tracking is handled by checkPowerUpCollisions automatically for timed effects
             };
        }
    },
    'bigBurst': {
        id: 'bigBurst',
        name: 'Big Burst',
        description: 'Your next paint burst is bigger and wider',
        duration: config.bigBurstDuration, // Use duration from config
        color: '#FF4500', // OrangeRed
        glowColor: '#FF6347', // Tomato
        icon: 'burst', // New icon ID - need to add rendering later
        size: 26,
        rarity: 3,
        effect: (clientId, presence) => {
            console.log(`Big Burst effect applied to ${clientId}`);
            // Actual effect: Set flag in presence
            return {
                bigBurstActive: true, // Set the flag for interaction check
                // Note: activePowerUps tracking is handled by checkPowerUpCollisions automatically for timed effects
            };
        }
    }
};

/**
 * Get a random power-up definition based on rarity weights
 * @returns {object} A randomly selected power-up definition
 */
export function getRandomPowerUpDefinition() {
    // Create a weighted array based on rarity values
    const weightedChoices = [];
    for (const [id, powerUp] of Object.entries(powerUpDefinitions)) {
        // Lower rarity = less common, so we invert the value
        const weight = 11 - (powerUp.rarity || 5); // Default to medium rarity (5)
        for (let i = 0; i < weight; i++) {
            weightedChoices.push(id);
        }
    }

    // Select a random item from the weighted array
    const randomIndex = Math.floor(Math.random() * weightedChoices.length);
    const selectedId = weightedChoices[randomIndex];

    return powerUpDefinitions[selectedId];
}