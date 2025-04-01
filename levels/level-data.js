/**
 * level-data.js
 * Defines the structure and data for game levels.
 * Note: All coordinates are relative to a game area defined in config.js (e.g., 1600x900).
 * The center of the game area is approximately (800, 450).
 */
import config from '../config.js'; // Import config to potentially use gameAreaWidth/Height if needed later

// --- Level Definitions ---

export const level1 = {
    id: 'level-01',
    name: 'Simple Arena',
    backgroundColor: '#0a0a1e',
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
            color: '#2a2a4a',
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
            color: '#333366',
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
            color: '#333366',
            properties: { friction: 0.9, restitution: 0.1 }
        },
    ]
};

export const level2 = {
    id: 'level-02',
    name: 'Pillars',
    backgroundColor: '#1a0a0e',
    obstacles: [
        // Floor - Centered horizontally
        {
            id: 'floor',
            type: 'rectangle',
            x: 800,
            y: 750, // Kept original low position
            width: 800,
            height: 50,
            color: '#442222',
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
            color: '#553333',
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
            color: '#553333',
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
            color: '#664444',
            properties: { friction: 0.8, restitution: 0.1 }
        }
    ]
};

export const level3 = {
    id: 'level-03',
    name: 'Funnel',
    backgroundColor: '#0a1a0e',
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
            color: '#224422',
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
            color: '#224422',
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
            color: '#335533',
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
            color: '#335533',
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
            color: '#446644',
            properties: { friction: 0.8, restitution: 0.1 }
        }
    ]
};

// Combine levels into an array or object for easy selection
export const allLevels = [level1, level2, level3];

// Keep defaultLevel pointing to level1 for backward compatibility if needed elsewhere
export const defaultLevel = level1;

// In the future, this could export functions to generate levels procedurally.