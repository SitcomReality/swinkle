/**
 * player-eye-targeting.js
 * Handles eye target selection and timing for player character expressions.
 * Makes eyes periodically focus on different game elements.
 */

// Store targeting state for each player
const playerEyeTargeting = new Map();

// Possible target types
const TARGET_TYPES = {
    CURSOR: 'cursor',         // Default - player's own cursor/anchor
    OWN_CAN: 'ownCan',        // Player's own paint can
    OTHER_PLAYER: 'otherPlayer', // Another random player
    RANDOM_POINT: 'randomPoint', // Random point in the game area
    POWER_UP: 'powerUp'       // Nearby power-up
};

/**
 * Updates the eye target for a player, potentially choosing a new target
 * based on elapsed time and available objects in the game world.
 * 
 * @param {string} clientId - The player's client ID
 * @param {boolean} isLocalPlayer - Whether this is the local player
 * @param {object} roomInstance - The WebsimSocket room instance
 * @param {object} playerPos - The player's body position {x, y}
 * @param {object} gameState - Additional game state information
 * @returns {object} Target position {x, y} and metadata
 */
export function updateEyeTarget(clientId, isLocalPlayer, roomInstance, playerPos, gameState) {
    const now = Date.now();
    
    // Initialize targeting state if needed
    if (!playerEyeTargeting.has(clientId)) {
        playerEyeTargeting.set(clientId, {
            currentTarget: { 
                type: TARGET_TYPES.CURSOR,
                position: null, // Will be set below
                objectId: null,
                nextChangeTime: now + getRandomDuration()
            },
            lastUpdateTime: now
        });
    }
    
    const targetingState = playerEyeTargeting.get(clientId);
    const currentTarget = targetingState.currentTarget;
    
    // Check if it's time to pick a new target
    if (now >= currentTarget.nextChangeTime) {
        selectNewTarget(clientId, targetingState, roomInstance, playerPos, isLocalPlayer);
    }
    
    // Update the current target's position based on its type
    updateTargetPosition(currentTarget, clientId, roomInstance, playerPos, gameState);
    
    // Return the current target position for eye rendering
    return {
        position: currentTarget.position,
        type: currentTarget.type,
        objectId: currentTarget.objectId
    };
}

/**
 * Selects a new random eye target for the player.
 * 
 * @param {string} clientId - The player's client ID
 * @param {object} targetingState - The player's eye targeting state
 * @param {object} roomInstance - The WebsimSocket room instance
 * @param {object} playerPos - The player's body position {x, y}
 * @param {boolean} isLocalPlayer - Whether this is the local player
 */
function selectNewTarget(clientId, targetingState, roomInstance, playerPos, isLocalPlayer) {
    const now = Date.now();
    const presence = roomInstance.presence[clientId];
    const currentCanId = presence?.currentCanId;
    
    // Available target types depend on game state
    const availableTargets = [TARGET_TYPES.RANDOM_POINT]; // Always available
    
    // Local player can look at cursor sometimes
    if (isLocalPlayer) {
        availableTargets.push(TARGET_TYPES.CURSOR);
    }
    
    // Can look at own paint can if holding one
    if (currentCanId && roomInstance.roomState.paintCans?.[currentCanId]) {
        availableTargets.push(TARGET_TYPES.OWN_CAN);
    }
    
    // Can look at other players if any exist
    const otherPlayers = Object.keys(roomInstance.peers).filter(id => 
        id !== clientId && 
        roomInstance.presence[id] && 
        !roomInstance.presence[id].lost && 
        !roomInstance.presence[id].isSpectating
    );
    
    if (otherPlayers.length > 0) {
        availableTargets.push(TARGET_TYPES.OTHER_PLAYER);
    }
    
    // Can look at power-ups if any exist nearby
    const powerUps = Object.values(roomInstance.roomState.powerUps || {}).filter(p => p !== null);
    if (powerUps.length > 0) {
        availableTargets.push(TARGET_TYPES.POWER_UP);
    }
    
    // Select a random target type from available options
    const randomType = availableTargets[Math.floor(Math.random() * availableTargets.length)];
    
    // Initialize the new target
    const newTarget = {
        type: randomType,
        position: { x: 0, y: 0 }, // Will be updated in updateTargetPosition
        objectId: null,
        nextChangeTime: now + getRandomDuration()
    };
    
    // Set up target-specific properties
    switch (randomType) {
        case TARGET_TYPES.OTHER_PLAYER:
            // Pick a random other player to look at
            newTarget.objectId = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
            break;
            
        case TARGET_TYPES.OWN_CAN:
            newTarget.objectId = currentCanId;
            break;
            
        case TARGET_TYPES.POWER_UP:
            // Pick a random power-up, preferring closer ones
            if (powerUps.length > 0) {
                // Simple approach: just pick a random one
                const randomPowerUp = powerUps[Math.floor(Math.random() * powerUps.length)];
                newTarget.objectId = randomPowerUp.id;
            }
            break;
            
        case TARGET_TYPES.RANDOM_POINT:
            // Generate a random point in the game area
            newTarget.position = {
                x: Math.random() * 1200, // gameAreaWidth
                y: Math.random() * 900   // gameAreaHeight
            };
            break;
    }
    
    // Update the targeting state
    targetingState.currentTarget = newTarget;
    targetingState.lastUpdateTime = now;
}

/**
 * Updates the position of the current eye target based on its type and the current game state.
 * 
 * @param {object} target - The current eye target
 * @param {string} clientId - The player's client ID
 * @param {object} roomInstance - The WebsimSocket room instance
 * @param {object} playerPos - The player's body position {x, y}
 * @param {object} gameState - Additional game state information
 */
function updateTargetPosition(target, clientId, roomInstance, playerPos, gameState) {
    switch (target.type) {
        case TARGET_TYPES.CURSOR:
            // Look at the player's own anchor/cursor
            const presence = roomInstance.presence[clientId];
            if (presence && typeof presence.x === 'number' && typeof presence.y === 'number') {
                target.position = { x: presence.x, y: presence.y };
            } else {
                // Fallback if no valid cursor position
                target.position = { x: playerPos.x, y: playerPos.y - 100 };
            }
            break;
            
        case TARGET_TYPES.OWN_CAN:
            // Look at the player's held paint can
            const canState = roomInstance.roomState.paintCans?.[target.objectId];
            if (canState) {
                target.position = { x: canState.x, y: canState.y };
            } else {
                // Can no longer exists, force a new target soon
                target.nextChangeTime = Date.now();
            }
            break;
            
        case TARGET_TYPES.OTHER_PLAYER:
            // Look at another player
            const otherPlayerPhysics = gameState.getPlayerPhysicsState?.(target.objectId);
            if (otherPlayerPhysics?.position) {
                target.position = { 
                    x: otherPlayerPhysics.position.x, 
                    y: otherPlayerPhysics.position.y 
                };
            } else {
                // Player no longer exists or is not visible, force a new target soon
                target.nextChangeTime = Date.now();
            }
            break;
            
        case TARGET_TYPES.POWER_UP:
            // Look at a power-up
            const powerUp = roomInstance.roomState.powerUps?.[target.objectId];
            if (powerUp) {
                target.position = { x: powerUp.x, y: powerUp.y };
            } else {
                // Power-up no longer exists, force a new target soon
                target.nextChangeTime = Date.now();
            }
            break;
            
        case TARGET_TYPES.RANDOM_POINT:
            // Position was set when target was created, no need to update
            break;
    }
}

/**
 * Returns a random duration for how long to look at a target.
 * @returns {number} Duration in milliseconds
 */
function getRandomDuration() {
    // Base duration plus random variation
    const baseDuration = 1500; // 1.5 seconds base
    const randomVariation = Math.random() * 2500; // Up to 2.5 seconds additional
    return baseDuration + randomVariation;
}

/**
 * Cleans up targeting state for a disconnected player.
 * @param {string} clientId - The client ID to remove
 */
export function removePlayerEyeTargeting(clientId) {
    playerEyeTargeting.delete(clientId);
}