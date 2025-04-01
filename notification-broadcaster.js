/**
 * notification-broadcaster.js
 * Handles broadcasting notifications to all players by sending presence update requests.
 * This separates notification broadcasting logic from individual event handlers.
 */
import { room } from './main.js';

/**
 * Broadcasts a notification to all players in the room.
 * @param {string} message - The notification message.
 * @param {string} type - The notification type.
 * @param {number} duration - How long the notification stays visible (ms).
 */
export function broadcastNotification(message, type = 'info', duration = 3000) {
    if (!room || !room.peers) return;
    
    Object.keys(room.peers).forEach(clientId => {
        if (clientId !== room.clientId) { // Don't send to self, we'll show locally
            room.requestPresenceUpdate(clientId, {
                type: 'showNotification',
                message,
                notificationType: type,
                duration
            });
        }
    });
    
    // Show notification locally
    import('./notification-manager.js').then(({ addNotification }) => {
        addNotification(message, type, duration);
    });
}

/**
 * Handles incoming notification requests from other clients.
 * Call this from presence update request subscriber.
 * @param {object} updateRequest - The presence update request object.
 */
export function handleNotificationRequest(updateRequest) {
    if (updateRequest.type === 'showNotification' && 
        updateRequest.message && 
        updateRequest.notificationType) {
        import('./notification-manager.js').then(({ addNotification }) => {
            addNotification(
                updateRequest.message, 
                updateRequest.notificationType, 
                updateRequest.duration || 3000
            );
        });
    }
}