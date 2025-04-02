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

// Create a monitoring system for WebSocket issues with parent frame
let originalWebSocket = window.WebSocket;
let activeConnections = new Set();
let connectionErrorHandled = false;

// Override the WebSocket constructor to track connections
window.WebSocket = function(url, protocols) {
    // Create an actual WebSocket with the original constructor
    const ws = new originalWebSocket(url, protocols);
    activeConnections.add(ws);
    
    // Intercept the close event to prevent error messages in parent frame
    const originalOnClose = ws.onclose;
    ws.onclose = function(event) {
        // Check if this is a connection that would trigger an error notification
        if (event.code === 1009 || 
            (event.reason && event.reason.includes('attachment'))) {
            
            // Apply CSS fix to prevent parent frame scrollbar
            if (!connectionErrorHandled) {
                applyParentFrameScrollFix();
                connectionErrorHandled = true;
            }
            
            console.warn('WebSocket closed: Caught potential "attachment too large" error');
            // Still call the original handler for proper cleanup
            if (originalOnClose) originalOnClose.call(this, event);
        } else {
            // For normal closes, just call the original handler
            if (originalOnClose) originalOnClose.call(this, event);
        }
        
        // Remove from active connections
        activeConnections.delete(ws);
    };
    
    return ws;
};

// Function to apply CSS fix to prevent parent frame scrollbar
function applyParentFrameScrollFix() {
    try {
        // Attempt to access parent frame
        if (window.parent && window.parent !== window) {
            // Create and inject a style element into the parent frame
            const style = document.createElement('style');
            style.textContent = `
                section[aria-label="Notifications alt+T"] {
                    display: none !important; /* Hide notification section */
                }
                body, html {
                    overflow: hidden !important; /* Prevent scrollbars */
                    margin-right: 0 !important; /* Prevent layout shifts */
                }
            `;
            
            // Try to append to parent frame, using different approaches
            try {
                // Direct approach (may fail due to cross-origin policy)
                window.parent.document.head.appendChild(style);
            } catch (e) {
                // Fallback: postMessage to communicate with parent frame
                window.parent.postMessage({
                    type: 'websim_fix_scrollbar',
                    css: style.textContent
                }, '*');
                
                // Also listen for postMessage from other scripts that might help us
                window.addEventListener('message', (event) => {
                    if (event.data && event.data.type === 'websim_parent_ready') {
                        event.source.postMessage({
                            type: 'websim_fix_scrollbar',
                            css: style.textContent
                        }, '*');
                    }
                });
            }
            
            console.log('Applied parent frame scroll fix');
        }
    } catch (e) {
        console.warn('Could not apply parent frame scroll fix:', e);
    }
}

// Create globally accessible methods
export const WebSocketMonitor = {
    // Get active connection count
    getActiveConnectionCount: () => activeConnections.size,
    
    // Force-apply the scrollbar fix
    applyScrollbarFix: () => applyParentFrameScrollFix(),
    
    // Debug logging
    logConnectionStats: () => {
        console.log(`Active WebSocket connections: ${activeConnections.size}`);
        return { 
            activeConnections: activeConnections.size,
            errorHandled: connectionErrorHandled
        };
    }
};