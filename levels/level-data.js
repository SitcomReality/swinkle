/**
 * level-data.js
 * Defines the structure and data for game levels.
 */

// --- Level Definitions ---

export const level1 = {
    id: 'level-01',
    name: 'Simple Arena',
    backgroundColor: '#0a0a1e',
    obstacles: [
        {
            id: 'platform-center',
            type: 'rectangle',
            x: 500,
            y: 400,
            width: 200,
            height: 30,
            color: '#2a2a4a',
            properties: { friction: 0.8, restitution: 0.2 }
        },
        {
            id: 'block-left',
            type: 'rectangle',
            x: 200,
            y: 550,
            width: 50,
            height: 100,
            color: '#333366',
            properties: { friction: 0.7, restitution: 0.3 }
        },
         {
            id: 'block-right',
            type: 'rectangle',
            x: 800,
            y: 250,
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
        // Floor
        {
            id: 'floor',
            type: 'rectangle',
            x: 500,
            y: 750,
            width: 800,
            height: 50,
            color: '#442222',
            properties: { friction: 0.9, restitution: 0.1 }
        },
        // Pillars
        {
            id: 'pillar-left',
            type: 'rectangle',
            x: 300,
            y: 500,
            width: 60,
            height: 400,
            color: '#553333',
            properties: { friction: 0.7, restitution: 0.2 }
        },
        {
            id: 'pillar-right',
            type: 'rectangle',
            x: 700,
            y: 500,
            width: 60,
            height: 400,
            color: '#553333',
            properties: { friction: 0.7, restitution: 0.2 }
        },
        // Small floating platform
        {
            id: 'platform-top',
            type: 'rectangle',
            x: 500,
            y: 200,
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
        {
            id: 'wall-left',
            type: 'rectangle',
            x: 100,
            y: 400,
            width: 50,
            height: 600,
            color: '#224422',
            properties: { friction: 0.5, restitution: 0.5 }
        },
        {
            id: 'wall-right',
            type: 'rectangle',
            x: 900,
            y: 400,
            width: 50,
            height: 600,
            color: '#224422',
            properties: { friction: 0.5, restitution: 0.5 }
        },
        {
            id: 'ramp-left',
            type: 'rectangle', 
            x: 350,
            y: 600,
            width: 300,
            height: 30,
            angle: -0.3, 
            color: '#335533',
            properties: { friction: 0.7, restitution: 0.2 }
        },
        {
            id: 'ramp-right',
            type: 'rectangle',
            x: 650,
            y: 600,
            width: 300,
            height: 30,
            angle: 0.3, 
            color: '#335533',
            properties: { friction: 0.7, restitution: 0.2 }
        },
         {
            id: 'block-center-top',
            type: 'rectangle',
            x: 500,
            y: 200,
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