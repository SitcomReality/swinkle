/**
 * level-data.js
 * Replaces hardcoded levels with generated ones, using the new generator
 */
// Import the generator function itself
import { levelGenerate } from '../level-generator.js';
// Import the naming function
import { generateLevelName } from '../level-namer.js';
// Level generation config is now defined within level-generator.js

// Generate 10 levels at startup
const generateRandomLevels = (count) => {
    const levels = [];
    for (let i = 0; i < count; i++) {
        // Call the generator function
        const level = levelGenerate(); // Uses internal config within levelGenerate
        level.name = generateLevelName(); // Assign a random name
        levels.push(level);
    }
    console.log(`Generated ${levels.length} random levels.`);
    return levels;
};

// Store the generated levels
export let allLevels = generateRandomLevels(10);

// Set the default level to the first generated level
export const defaultLevel = allLevels.length > 0 ? allLevels[0] : null;