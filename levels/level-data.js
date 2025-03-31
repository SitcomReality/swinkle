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
        // Structure defined, actual obstacles will be added in the next step (1.3)
        // Example:
        // {
        //    id: 'platform-1',
        //    type: 'rectangle',
        //    x: window.innerWidth / 2, // Center horizontally
        //    y: window.innerHeight - 50, // Near the bottom
        //    width: window.innerWidth * 0.8, // 80% of screen width
        //    height: 20,
        //    color: '#333366', // Dark purple/blue
        //    properties: { // Optional: friction, bounciness etc.
        //        friction: 0.8,
        //        restitution: 0.1
        //    }
        // },
    ]
};

// In the future, this could export multiple levels or functions to generate levels.