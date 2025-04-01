/**
 * level-data.js
 * Replaces hardcoded levels with generated ones, using the new generator
 */
import { levelGenerate } from './level-generator.js';
import { generateLevelName } from './level-namer.js';

// levelGenConfig is moved here as per the current code
export const levelGenConfig = {
    gameArea: { width: 1200, height: 900 },
    symmetry: true,
    oCount: { min: 4, max: 8 },
    obstacleSize: { minWidth: 30, maxWidth: 400, minHeight: 20, maxHeight: 600 },
    angleRange: { min: -0.5, max: 0.5 },
    properties: {
        friction: { min: 0.5, max: 0.9 },
        restitution: { min: 0.1, max: 0.5 }
    },
    minSpacing: 50,
    verticalLayers: [
        { name: 'floor', yRange: [700, 0], count: 1 },
        { name: 'mid', yRange: [300, 600], count: { min: 2, max: 4 } },
        { name: 'high', yRange: [100, 250], count: { min: 1, max: 2 } }
    ]
};

// Generate 10 levels at startup
const generateRandomLevels = (count) => {
    const levels = [];
    for (let i = 0; i < count; i++) {
        const level = levelGenerate(levelGenConfig);
        level.name = generateLevelName(); // Uses level-namer
        levels.push(level);
    }
    return levels;
}      

// Now our default levels are randomly gen!
export const defaultLevel = null; // Will be set in getInitialLevels()
export let allLevels = generateRandomLevels(10);