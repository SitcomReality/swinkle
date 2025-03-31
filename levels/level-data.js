/**
 * level-data.js
 * Defines the structure and data for game levels.
 * Currently contains placeholder data for a simple level.
 */

// Example level structure: An array of objects describing static obstacles.
// Each object should have properties like type, x, y, width, height, color, etc.

export const defaultLevel = {
    id: 'default-01',
    name: 'Simple Arena',
    backgroundColor: '#0a0a1e', // Or maybe derived from theme config?
    obstacles: [
        // Example: A simple floor platform
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
        // Example: A floating block
        // {
        //    id: 'block-1',
        //    type: 'rectangle',
        //    x: window.innerWidth * 0.25,
        //    y: window.innerHeight / 2,
        //    width: 100,
        //    height: 100,
        //    color: '#444477',
        //    properties: {}
        // }
    ]
};

// In the future, this could export multiple levels or functions to generate levels.