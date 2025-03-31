/**
 * player.js
 * Facade module for player-related functionality.
 * Imports implementations from specific modules (state, physics, renderer)
 * and exports them for use by other parts of the application (e.g., game-loop).
 */

// Import functions from the specialized modules
import { getPlayerPhysicsState, removePlayerPhysicsState } from './playerState.js';
import { updatePlayerPhysics } from './playerPhysics.js';
import { renderPlayer } from './playerRenderer.js';

// Re-export the functions to maintain the original API
export {
    getPlayerPhysicsState,
    removePlayerPhysicsState,
    updatePlayerPhysics,
    renderPlayer
};