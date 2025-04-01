/**
 * level-generator.js
 * Procedurally generates game levels with obstacles following specified configuration.
 * This version includes the full generation logic.
 */
import config from './config.js'; 

// Use config directly for gameArea dimensions if defined there, otherwise use defaults
const gameAreaWidth = config.gameAreaWidth || 1200;
const gameAreaHeight = config.gameAreaHeight || 900;

// --- Configuration (Moved from levels/level-data.js for encapsulation) ---
// Keep levelGenConfig defined here, level-manager can import it if needed,
// or we pass it to the generate function. Let's keep it internal for now.
const generationConfig = {
    gameArea: { width: gameAreaWidth, height: gameAreaHeight },
    symmetry: true, // Try generating symmetric levels
    obstacleCount: { min: 4, max: 8 }, // Total obstacles (approx, depends on symmetry/layers)
    obstacleSize: { minWidth: 50, maxWidth: 300, minHeight: 30, maxHeight: 150 }, // Adjusted size ranges
    angleRange: { min: -0.3, max: 0.3 }, // Limit angles slightly
    properties: {
        friction: { min: 0.6, max: 0.9 },
        restitution: { min: 0.1, max: 0.3 }
    },
    minSpacing: 75, // Increased spacing between obstacles
    verticalLayers: [
        { name: 'floor', yRange: [gameAreaHeight - 150, gameAreaHeight - 50], count: { min: 1, max: 1 }, sizeMultiplier: 1.5 }, // Larger floor pieces
        { name: 'mid', yRange: [gameAreaHeight * 0.4, gameAreaHeight * 0.7], count: { min: 2, max: 4 } },
        { name: 'high', yRange: [100, gameAreaHeight * 0.3], count: { min: 1, max: 2 } }
    ]
};

/**
 * Generates a single obstacle based on configuration.
 * @param {string} id - Unique ID for the obstacle.
 * @param {number} x - Center X coordinate.
 * @param {number} y - Center Y coordinate.
 * @param {object} layerConfig - Configuration specific to the vertical layer.
 * @param {object} globalConfig - The main generation configuration.
 * @returns {object} The generated obstacle object.
 */
function generateObstacle(id, x, y, layerConfig, globalConfig) {
    const sizeMulti = layerConfig.sizeMultiplier || 1.0; // Apply layer-specific size multiplier

    const minW = globalConfig.obstacleSize.minWidth * sizeMulti;
    const maxW = globalConfig.obstacleSize.maxWidth * sizeMulti;
    const minH = globalConfig.obstacleSize.minHeight * sizeMulti;
    const maxH = globalConfig.obstacleSize.maxHeight * sizeMulti;

    const width = Math.random() * (maxW - minW) + minW;
    const height = Math.random() * (maxH - minH) + minH;
    const angle = Math.random() * (globalConfig.angleRange.max - globalConfig.angleRange.min) + globalConfig.angleRange.min;
    const friction = Math.random() * (globalConfig.properties.friction.max - globalConfig.properties.friction.min) + globalConfig.properties.friction.min;
    const restitution = Math.random() * (globalConfig.properties.restitution.max - globalConfig.properties.restitution.min) + globalConfig.properties.restitution.min;

    return {
        id,
        type: 'rectangle',
        x,
        y,
        width,
        height,
        angle,
        properties: { friction: restitution } // Corrected property name
    };
}

/**
 * Generates a pair of symmetric obstacles.
 * @param {string} idPrefix - Prefix for the obstacle IDs.
 * @param {number} x - Center X coordinate for the left obstacle.
 * @param {number} y - Center Y coordinate for the obstacles.
 * @param {object} layerConfig - Configuration specific to the vertical layer.
 * @param {object} globalConfig - The main generation configuration.
 * @returns {Array<object>} An array containing the left and right obstacles.
 */
function generateSymmetricPair(idPrefix, x, y, layerConfig, globalConfig) {
    const center = globalConfig.gameArea.width / 2;
    const leftObstacle = generateObstacle(`${idPrefix}-left`, x, y, layerConfig, globalConfig);
    // Ensure symmetric counterpart has mirrored angle
    const rightObstacle = {
        ...leftObstacle,
        id: `${idPrefix}-right`,
        x: center + (center - leftObstacle.x),
        angle: -leftObstacle.angle // Mirror the angle
    };
    return [leftObstacle, rightObstacle];
}

/**
 * Generates obstacles for a specific vertical layer.
 * @param {object} layerConfig - Configuration for the layer.
 * @param {object} globalConfig - The main generation configuration.
 * @returns {Array<object>} An array of generated obstacles for the layer.
 */
function generateLayerObstacles(layerConfig, globalConfig) {
    const obstacles = [];
    // Ensure count is an object with min/max or fallback
    const countConfig = typeof layerConfig.count === 'object' ? layerConfig.count : { min: layerConfig.count, max: layerConfig.count };
    const count = countConfig.min + Math.floor(Math.random() * (countConfig.max - countConfig.min + 1));
    const center = globalConfig.gameArea.width / 2;
    const minSpacing = globalConfig.minSpacing;

    // Calculate horizontal placement range based on symmetry
    const xRange = globalConfig.symmetry ?
        [minSpacing, center - minSpacing] : // Place on left half for symmetry
        [minSpacing, globalConfig.gameArea.width - minSpacing]; // Place anywhere if not symmetric

    for (let i = 0; i < count; i++) {
        const y = layerConfig.yRange[0] + Math.random() * (layerConfig.yRange[1] - layerConfig.yRange[0]);
        const x = xRange[0] + Math.random() * (xRange[1] - xRange[0]);

        if (globalConfig.symmetry) {
            // Place pairs symmetrically
            const pair = generateSymmetricPair(`obstacle-${layerConfig.name}-${obstacles.length}`, x, y, layerConfig, globalConfig);
            obstacles.push(...pair);
        } else {
            // Place individually if not symmetric
            obstacles.push(generateObstacle(`obstacle-${layerConfig.name}-${obstacles.length}`, x, y, layerConfig, globalConfig));
        }
    }

    // Return only the number of obstacles actually requested (handling potential pair generation overshoot)
    return obstacles.slice(0, count);
}

/**
 * Simple AABB overlap check with buffer.
 * @param {object} obstacle1 - First obstacle.
 * @param {object} obstacle2 - Second obstacle.
 * @param {number} buffer - Spacing buffer.
 * @returns {boolean} True if obstacles overlap.
 */
function doObstaclesOverlap(obstacle1, obstacle2, buffer) {
    const halfWidth1 = obstacle1.width / 2;
    const halfHeight1 = obstacle1.height / 2;
    const halfWidth2 = obstacle2.width / 2;
    const halfHeight2 = obstacle2.height / 2;

    // Approximate check using AABB centered at obstacle positions
    return (
        Math.abs(obstacle1.x - obstacle2.x) * 2 < (obstacle1.width + obstacle2.width + buffer * 2) &&
        Math.abs(obstacle1.y - obstacle2.y) * 2 < (obstacle1.height + obstacle2.height + buffer * 2)
    );
}

/**
 * Checks if a new obstacle overlaps with existing ones.
 * @param {object} newObstacle - The new obstacle to check.
 * @param {Array<object>} existingObstacles - Array of already placed obstacles.
 * @param {number} minSpacing - Minimum spacing required.
 * @returns {boolean} True if the new obstacle does NOT overlap significantly.
 */
function ensureNoOverlaps(newObstacle, existingObstacles, minSpacing) {
    return !existingObstacles.some(obstacle => doObstaclesOverlap(newObstacle, obstacle, minSpacing));
}

/**
 * Generates a complete level object based on the configuration.
 * Uses the internal `generationConfig`.
 * @param {object} [externalConfig] - Optional external config to override the internal one.
 * @returns {object} The generated level object { id, name, obstacles }.
 */
export function levelGenerate(externalConfig) {
    // Use external config if provided, otherwise use internal default
    const currentConfig = externalConfig || generationConfig;
    const level = {
        id: `level-gen-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`,
        name: 'Procedural Arena', // Default name, can be overwritten later
        obstacles: []
    };
    const maxAttempts = 10; // Limit attempts per obstacle to avoid infinite loops

    // Generate obstacles for each layer
    for (const layer of currentConfig.verticalLayers) {
        const layerObstacles = generateLayerObstacles(layer, currentConfig);

        for (const newObstacle of layerObstacles) {
            let placed = false;
            let attempts = 0;
            let currentX = newObstacle.x;
            let currentY = newObstacle.y;

            // Try placing, nudge if overlapping
            while (!placed && attempts < maxAttempts) {
                newObstacle.x = currentX; // Update position for overlap check
                newObstacle.y = currentY;
                if (ensureNoOverlaps(newObstacle, level.obstacles, currentConfig.minSpacing)) {
                    level.obstacles.push({ ...newObstacle }); // Add a copy
                    placed = true;
                } else {
                    // Nudge slightly horizontally and vertically if overlapping
                    currentX += (Math.random() - 0.5) * 40; // Nudge X
                    currentY += (Math.random() - 0.5) * 20; // Nudge Y less

                    // Clamp nudged position within bounds (minus half width/height)
                    const halfW = newObstacle.width / 2;
                    const halfH = newObstacle.height / 2;
                    currentX = Math.max(halfW, Math.min(currentConfig.gameArea.width - halfW, currentX));
                    currentY = Math.max(halfH, Math.min(currentConfig.gameArea.height - halfH, currentY));
                }
                attempts++;
            }
            if (!placed) {
                console.warn(`Could not place obstacle ${newObstacle.id} for layer ${layer.name} after ${maxAttempts} attempts.`);
            }
        }
    }
    // Name generation is handled in level-manager or level-data where generator is called
    return level;
}

// Export the config in case other modules need it (like level-manager)
export { generationConfig };