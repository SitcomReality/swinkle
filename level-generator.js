const levelGenerationConfig = {
    gameArea: { width: 1200, height: 900 },
    symmetry: true,
    obstacleCount: { min: 4, max: 8 },
    obstacleSize: { minWidth: 30, maxWidth: 400, minHeight: 20, maxHeight: 600 },
    angleRange: { min: -0.5, max: 0.5 },
    properties: {
        friction: { min: 0.5, max: 0.9 },
        restitution: { min: 0.1, max: 0.5 }
    },
    minSpacing: 50,
    verticalLayers: [
        { name: 'floor', yRange: [700, 800], count: 1 },
        { name: 'mid', yRange: [300, 600], count: { min: 2, max: 4 } },
        { name: 'high', yRange: [100, 250], count: { min: 1, max: 2 } }
    ]
};

function levelGenerateObstacle(id, x, y, config) {
    const width = Math.random() * (config.obstacleSize.maxWidth - config.obstacleSize.minWidth) + config.obstacleSize.minWidth;
    const height = Math.random() * (config.obstacleSize.maxHeight - config.obstacleSize.minHeight) + config.obstacleSize.minHeight;
    const angle = Math.random() * (config.angleRange.max - config.angleRange.min) + config.angleRange.min;
    const friction = Math.random() * (config.properties.friction.max - config.properties.friction.min) + config.properties.friction.min;
    const restitution = Math.random() * (config.properties.restitution.max - config.properties.restitution.min) + config.properties.restitution.min;

    return {
        id,
        type: 'rectangle',
        x,
        y,
        width,
        height,
        angle,
        properties: { friction, restitution }
    };
}

function levelGenerateSymmetricPair(idPrefix, x, y, config) {
    const center = config.gameArea.width / 2;
    const leftObstacle = levelGenerateObstacle(`${idPrefix}-left`, x, y, config);
    const rightObstacle = {
        ...leftObstacle,
        id: `${idPrefix}-right`,
        x: center + (center - leftObstacle.x)
    };
    return [leftObstacle, rightObstacle];
}

function levelGenerateLayerObstacles(layer, config) {
    const obstacles = [];
    const count = layer.count.min + Math.floor(Math.random() * (layer.count.max - layer.count.min + 1));
    const center = config.gameArea.width / 2;

    for (let i = 0; i < count; i++) {
        const y = layer.yRange[0] + Math.random() * (layer.yRange[1] - layer.yRange[0]);
        let x;

        if (config.symmetry && i % 2 === 0) {
            // For symmetric levels, place pairs
            x = center - (Math.random() * (center - config.minSpacing));
            const pair = levelGenerateSymmetricPair(`obstacle-${layer.name}-${i}`, x, y, config);
            obstacles.push(...pair);
        } else {
            // For non-symmetric or odd-numbered obstacles, place anywhere
            x = config.minSpacing + Math.random() * (config.gameArea.width - 2 * config.minSpacing);
            obstacles.push(levelGenerateObstacle(`obstacle-${layer.name}-${i}`, x, y, config));
        }
    }

    return obstacles;
}

function doObstaclesOverlap(obstacle1, obstacle2) {
    const buffer = 10; // Add a small buffer to ensure spacing
    return (
        obstacle1.x < obstacle2.x + obstacle2.width + buffer &&
        obstacle1.x + obstacle1.width + buffer > obstacle2.x &&
        obstacle1.y < obstacle2.y + obstacle2.height + buffer &&
        obstacle1.y + obstacle1.height + buffer > obstacle2.y
    );
}

function ensureNoOverlaps(newObstacle, existingObstacles) {
    return !existingObstacles.some(obstacle => doObstaclesOverlap(newObstacle, obstacle));
}


function levelGenerate(config) {
    const level = {
        id: `level-generated-${Date.now()}`,
        name: `Generated Level`,
        obstacles: []
    };

    // Generate obstacles for each layer
    for (const layer of config.verticalLayers) {
        const newObstacles = levelGenerateLayerObstacles(layer, config);
        // Filter out overlapping obstacles
        for (const obstacle of newObstacles) {
            if (ensureNoOverlaps(obstacle, level.obstacles)) {
                level.obstacles.push(obstacle);
            }
        }
    }

    return level;
}

// Example usage:
// const newLevel = levelGenerate(generationConfig);
// console.log(JSON.stringify(newLevel, null, 2));