/**
 * websocket-chunker.js
 * Handles breaking large WebSocket messages into smaller chunks to prevent
 * "attachment too large" errors.
 */

const MAX_CHUNK_SIZE = 1800; // Conservative limit below the 2048 byte threshold

/**
 * Breaks a large message into smaller chunks if needed.
 * @param {object} roomInstance - The WebsimSocket room instance
 * @param {object} updateData - The data to send
 * @param {string} updateType - The type of update ('roomState' or 'presence')
 */
export function safelySendUpdate(roomInstance, updateData, updateType) {
    if (!roomInstance || !updateData) return;
    
    // Estimate message size
    const dataSize = JSON.stringify(updateData).length;
    
    // If data is small enough, send directly
    if (dataSize <= MAX_CHUNK_SIZE) {
        if (updateType === 'roomState') {
            roomInstance.updateRoomState(updateData);
        } else if (updateType === 'presence') {
            roomInstance.updatePresence(updateData);
        }
        return;
    }
    
    // Data is too large, split into chunks
    console.log(`Breaking large ${updateType} update (${dataSize} bytes) into chunks`);
    
    if (updateType === 'roomState') {
        // Split room state updates by category
        const updateTypes = Object.keys(updateData);
        
        for (const type of updateTypes) {
            const chunkData = { [type]: updateData[type] };
            const chunkSize = JSON.stringify(chunkData).length;
            
            if (chunkSize <= MAX_CHUNK_SIZE) {
                roomInstance.updateRoomState(chunkData);
            } else {
                // Further split by item IDs if needed
                const itemIds = Object.keys(updateData[type]);
                let currentChunk = {};
                
                for (const id of itemIds) {
                    const tempChunk = { 
                        ...currentChunk, 
                        [id]: updateData[type][id] 
                    };
                    
                    if (JSON.stringify({ [type]: tempChunk }).length > MAX_CHUNK_SIZE) {
                        // Current chunk would be too large, send what we have
                        if (Object.keys(currentChunk).length > 0) {
                            roomInstance.updateRoomState({ [type]: currentChunk });
                            currentChunk = { [id]: updateData[type][id] };
                        } else {
                            // Single item is too large, log warning
                            console.warn(`Cannot send item ${id} of type ${type}: too large`);
                        }
                    } else {
                        currentChunk = tempChunk;
                    }
                }
                
                // Send final chunk if anything remains
                if (Object.keys(currentChunk).length > 0) {
                    roomInstance.updateRoomState({ [type]: currentChunk });
                }
            }
        }
    } else if (updateType === 'presence') {
        // For presence, split into individual property updates
        const presenceKeys = Object.keys(updateData);
        
        for (const key of presenceKeys) {
            const singleUpdate = { [key]: updateData[key] };
            roomInstance.updatePresence(singleUpdate);
        }
    }
}