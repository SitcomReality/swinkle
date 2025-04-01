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

/**
 * Adds getLevel function that can be called to generate new levels
 * @param {string} [optional] Specific level type to generate (can import into level-manager.js)
 */
export { levelGenConfig, addRandomLevel } from './level-data.js';