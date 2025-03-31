/**
 * playerState.js
 * Manages the storage, initialization, and retrieval of player physics states.
 */
import config from 'config';

// Stores the physics state for each player, keyed by clientId
// Each entry will have { position: {x, y}, velocity: {x, y}, angle, angularVelocity, limbs: [...] }
const playerPhysicsStates = new Map();

/**
 * Gets the current physics state for a player.
 * Useful for accessing body position from other modules like game-loop.
 * @param {string} clientId - The ID of the player.
 * @returns {object | undefined} The physics state object or undefined if not found.
 */
export function getPlayerPhysicsState(clientId) {
    return playerPhysicsStates.get(clientId);
}

/**
 * Initializes the physics state for a player if it doesn't exist, including limbs.
 * @param {string} clientId - The ID of the player.
 * @param {object} initialAnchorPos - The initial anchor position {x, y}.
 * @returns {object} The ensured physics state object.
 */
export function ensurePhysicsState(clientId, initialAnchorPos) {
    if (!playerPhysicsStates.has(clientId)) {
        const bodyInitialPos = { x: initialAnchorPos.x, y: initialAnchorPos.y + config.bungeeRestLength };
        const initialState = {
            position: { x: bodyInitialPos.x, y: bodyInitialPos.y },
            velocity: { x: 0, y: 0 },
            angle: 0, // Initial angle (radians)
            angularVelocity: 0, // Initial angular velocity (radians/sec)
            limbs: [],
        };

        // Initialize limbs based on config
        for (let i = 0; i < config.numberOfLimbs; i++) {
            // Distribute attachment points - simple example: alternate sides
            const side = i % 2 === 0 ? -1 : 1;
            const attachmentOffsetX = (config.playerBodyWidth / 3) * side;
            // Attach slightly below the vertical center
            const attachmentOffsetY = config.playerBodyHeight * 0.2;
            
            // Initial limb position: slightly below attachment point
            const initialLimbPos = {
                x: bodyInitialPos.x + attachmentOffsetX,
                y: bodyInitialPos.y + attachmentOffsetY + config.limbLength * 0.5 // Start somewhat extended
            };

            initialState.limbs.push({
                // Relative offset from the body's center (state.position)
                attachmentOffset: { x: attachmentOffsetX, y: attachmentOffsetY },
                // Current end position of the limb
                position: { x: initialLimbPos.x, y: initialLimbPos.y },
                // Current velocity of the limb end
                velocity: { x: 0, y: 0 },
            });
        }
        playerPhysicsStates.set(clientId, initialState);
        console.log(`Initialized physics state for client ${clientId}`);
    }
    return playerPhysicsStates.get(clientId);
}

/**
 * Removes the physics state for a player when they disconnect.
 * @param {string} clientId - The ID of the player who left.
 */
export function removePlayerPhysicsState(clientId) {
    playerPhysicsStates.delete(clientId);
    console.log(`Removed physics state for client ${clientId}`);
}

/**
 * Updates the physics state object in the map.
 * Usually called after physics calculations are complete for a frame.
 * @param {string} clientId - The ID of the player.
 * @param {object} newState - The updated physics state object.
 */
export function setPlayerPhysicsState(clientId, newState) {
    playerPhysicsStates.set(clientId, newState);
}