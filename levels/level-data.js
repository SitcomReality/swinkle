/**
 * level-data.js
 * Defines the structure and data for game levels.
 * Note: All coordinates are relative to a game area defined in config.js (e.g., 1600x900).
 * The center of the game area is approximately (800, 450).
 * Background and Obstacle colors are now determined by the selected palette in level-manager.js.
 */
import config from '../config.js'; // Import config to potentially use gameAreaWidth/Height if needed later

// --- Level Definitions ---

export const level1 = {
    id: 'level-01',
    name: 'Simple Arena',
    // backgroundColor property removed
    obstacles: [
        {
            id: 'platform-center',
            type: 'rectangle',
            // Centered horizontally (1600 / 2 = 800)
            // Centered vertically (900 / 2 = 450)
            x: 800,
            y: 450,
            width: 200,
            height: 30,
            // color property removed
            properties: { friction: 0.8, restitution: 0.2 }
        },
        {
            id: 'block-left',
            type: 'rectangle',
            // Shifted right from original 200 -> 500
            // Shifted down from original 550 -> 600
            x: 500,
            y: 600,
            width: 50,
            height: 100,
            // color property removed
            properties: { friction: 0.7, restitution: 0.3 }
        },
         {
            id: 'block-right',
            type: 'rectangle',
            // Shifted right from original 800 -> 1100
            // Shifted down from original 250 -> 300
            x: 1100,
            y: 300,
            width: 80,
            height: 40,
            // color property removed
            properties: { friction: 0.9, restitution: 0.1 }
        },
    ]
};

export const level2 = {
    id: 'level-02',
    name: 'Pillars',
    // backgroundColor property removed
    obstacles: [
        // Floor - Centered horizontally
        {
            id: 'floor',
            type: 'rectangle',
            x: 800,
            y: 750, // Kept original low position
            width: 800,
            height: 50,
            // color property removed
            properties: { friction: 0.9, restitution: 0.1 }
        },
        // Pillars - Shifted right to be symmetric around center
        {
            id: 'pillar-left',
            type: 'rectangle',
            // Shifted right from original 300 -> 600
            x: 600,
            y: 500, // Kept original Y
            width: 60,
            height: 400,
            // color property removed
            properties: { friction: 0.7, restitution: 0.2 }
        },
        {
            id: 'pillar-right',
            type: 'rectangle',
            // Shifted right from original 700 -> 1000
            x: 1000,
            y: 500, // Kept original Y
            width: 60,
            height: 400,
            // color property removed
            properties: { friction: 0.7, restitution: 0.2 }
        },
        // Small floating platform - Centered horizontally
        {
            id: 'platform-top',
            type: 'rectangle',
            // Shifted right from original 500 -> 800
            x: 800,
            y: 200, // Kept original Y
            width: 150,
            height: 25,
            // color property removed
            properties: { friction: 0.8, restitution: 0.1 }
        }
    ]
};

export const level3 = {
    id: 'level-03',
    name: 'Funnel',
    // backgroundColor property removed
    obstacles: [
        // Walls - Shifted right to be symmetric around center
        {
            id: 'wall-left',
            type: 'rectangle',
            // Shifted right from original 100 -> 400
            x: 400,
            y: 400, // Kept original Y
            width: 50,
            height: 600,
            // color property removed
            properties: { friction: 0.5, restitution: 0.5 }
        },
        {
            id: 'wall-right',
            type: 'rectangle',
            // Shifted right from original 900 -> 1200
            x: 1200,
            y: 400, // Kept original Y
            width: 50,
            height: 600,
            // color property removed
            properties: { friction: 0.5, restitution: 0.5 }
        },
        // Ramps - Shifted right to fit within the centered walls
        {
            id: 'ramp-left',
            type: 'rectangle',
            // Shifted right from original 350 -> 650
            x: 650,
            y: 600, // Kept original Y
            width: 300,
            height: 30,
            angle: -0.3,
            // color property removed
            properties: { friction: 0.7, restitution: 0.2 }
        },
        {
            id: 'ramp-right',
            type: 'rectangle',
            // Shifted right from original 650 -> 950
            x: 950,
            y: 600, // Kept original Y
            width: 300,
            height: 30,
            angle: 0.3,
            // color property removed
            properties: { friction: 0.7, restitution: 0.2 }
        },
         // Center top block - Shifted right to be centered
         {
            id: 'block-center-top',
            type: 'rectangle',
            // Shifted right from original 500 -> 800
            x: 800,
            y: 200, // Kept original Y
            width: 100,
            height: 100,
            // color property removed
            properties: { friction: 0.8, restitution: 0.1 }
        }
    ]
};

export const level4 = {
    id: 'level-04',
    name: 'Hurricane Stadium',
    // Design: Curved outer walls, open center, some angled platforms
    obstacles: [
        // Bottom Floor
        {
            id: 'floor-stadium',
            type: 'rectangle',
            x: 800,
            y: 850, // Lower floor
            width: 1200,
            height: 40,
            properties: { friction: 0.85, restitution: 0.15 }
        },
        // Curved Top Walls (approximated with angled rectangles)
        {
            id: 'wall-top-left',
            type: 'rectangle',
            x: 400, // Start further left
            y: 150, // High wall
            width: 400,
            height: 40,
            angle: 0.2, // Slight downward angle towards center
            properties: { friction: 0.6, restitution: 0.4 }
        },
        {
            id: 'wall-top-right',
            type: 'rectangle',
            x: 1200, // Start further right
            y: 150, // High wall
            width: 400,
            height: 40,
            angle: -0.2, // Slight downward angle towards center
            properties: { friction: 0.6, restitution: 0.4 }
        },
        // Side Walls (angled inwards)
        {
            id: 'wall-side-left',
            type: 'rectangle',
            x: 150, // Left edge
            y: 500, // Mid height
            width: 40,
            height: 450,
            angle: -0.1, // Angle slightly inwards
            properties: { friction: 0.7, restitution: 0.3 }
        },
        {
            id: 'wall-side-right',
            type: 'rectangle',
            x: 1450, // Right edge
            y: 500, // Mid height
            width: 40,
            height: 450,
            angle: 0.1, // Angle slightly inwards
            properties: { friction: 0.7, restitution: 0.3 }
        },
        // Inner Angled Platforms
        {
            id: 'platform-inner-left',
            type: 'rectangle',
            x: 550, // Inside side wall
            y: 550, // Below center
            width: 180,
            height: 30,
            angle: -0.5, // Steeper angle
            properties: { friction: 0.8, restitution: 0.2 }
        },
        {
            id: 'platform-inner-right',
            type: 'rectangle',
            x: 1050, // Inside side wall
            y: 550, // Below center
            width: 180,
            height: 30,
            angle: 0.5, // Steeper angle
            properties: { friction: 0.8, restitution: 0.2 }
        }
    ]
};


// Combine levels into an array or object for easy selection
export const allLevels = [level1, level2, level3, level4]; // Add level4

// Keep defaultLevel pointing to level1 for backward compatibility if needed elsewhere
export const defaultLevel = level1;

// In the future, this could export functions to generate levels procedurally.