/**
 * level-data.js
 * Defines the structure and data for game levels.
 * Currently contains placeholder data for a simple level.
 */

// Example level structure: An object containing level metadata and obstacles.
// Obstacles are an array of objects describing static geometry.
// Each obstacle object should have:
// - id: A unique identifier string (e.g., 'platform-main', 'wall-left')
// - type: The shape type (currently supporting 'rectangle')
// - x: The horizontal center position
// - y: The vertical center position
// - width: The width of the obstacle
// - height: The height of the obstacle
// - color: The fill color (e.g., '#333366')
// - properties: (Optional) An object for physics properties like friction, restitution (bounciness), etc.

export const defaultLevel = {
    id: 'default-01',
    name: 'Simple Arena',
    backgroundColor: '#0a0a1e', // Or maybe derived from theme config?
    obstacles: [
        // --- Added initial obstacles for step 1.3 ---
        {
            id: 'platform-center',
            type: 'rectangle',
            x: 500, // Using fixed coordinates for now, assuming ~1000 width
            y: 400, // Assuming ~800 height
            width: 200,
            height: 30,
            color: '#2a2a4a', // Darker purple/blue
            properties: { friction: 0.8, restitution: 0.1 }
        },
        {
            id: 'block-left',
            type: 'rectangle',
            x: 200,
            y: 550,
            width: 50,
            height: 100,
            color: '#333366',
            properties: { friction: 0.7, restitution: 0.2 }
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
        // --- End initial obstacles ---
    ]
};

// In the future, this could export multiple levels or functions to generate levels.