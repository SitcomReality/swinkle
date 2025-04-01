/**
 * global-notifier.js
 * Handles broadcasting and receiving global notification events via database records.
 */
import { addNotification } from './notification-manager.js';
import { room } from './main.js'; // Import room to access client ID and collection

const NOTIFICATION_COLLECTION = 'global_notification_event_v1';
const RECORD_TTL_MS = 60 * 1000; // Keep records for 1 minute before potential cleanup
// const PROCESS_DELAY_MS = 100; // No longer needed for self-notifications

let processedRecordIds = new Set(); // Keep track of processed record IDs to prevent duplicates
let unsubscribeNotifications = () => {};

/**
 * Maps a notification record to the arguments needed for addNotification.
 * @param {object} record - The notification record.
 * @returns {Array|null} Array of arguments [message, type, duration] or null if invalid/unhandled.
 */
function mapRecordToNotificationArgs(record) {
    if (!record || !record.type || !record.payload) return null;

    const { type, payload } = record;

    switch (type) {
        case 'PLAYER_LOSS':
            if (payload.loserUsername) {
                return [`${payload.loserUsername} was PAINTED OUT!`, 'loss', 5000];
            }
            break;

        case 'POWERUP_COLLECT':
            if (payload.collectorUsername && payload.powerupName) {
                return [`${payload.collectorUsername} collected ${payload.powerupName}!`, 'pickup', 3000];
            }
            break;

        case 'SCORE_UPDATE':
            if (payload.scorerUsername && payload.victimUsername && payload.points !== undefined && payload.isLoss !== undefined) {
                if (payload.isLoss) {
                    return [`${payload.scorerUsername} scored ${payload.points} points for painting out ${payload.victimUsername}!`, 'score', 4000];
                } else if (Math.random() < 0.2) { // Only show occasional notifications for regular hits to avoid spam
                    return [`${payload.scorerUsername} scored a point for painting ${payload.victimUsername}`, 'info', 2000];
                }
            }
            break;

        // Add other cases here...

        default:
            console.warn(`GlobalNotifier: Unhandled notification event type in mapping: ${type}`);
            return null;
    }
    return null; // Return null if payload validation fails within a case
}

/**
 * Handles incoming notification records from the database subscription.
 * Processes self-generated records immediately and others after basic checks.
 * @param {Array<object>} records - Array of notification event records.
 */
function handleNotificationRecords(records) {
    if (!room || !room.clientId) return;

    const now = Date.now();
    const localClientId = room.clientId;
    const localUsername = room.peers[localClientId]?.username;

    // Sort records by creation time (oldest first) to process in order
    // Note: getList already sorts newest first, so reverse it. Subscribe might too.
    const sortedRecords = records.slice().reverse();

    sortedRecords.forEach(record => {
        // Basic validation
        if (!record || !record.id || !record.type || !record.payload || !record.timestamp || !record.username) {
            console.warn("GlobalNotifier: Received invalid notification record:", record);
            return;
        }

        // Skip if already processed by this client
        if (processedRecordIds.has(record.id)) {
            return;
        }

        // --- Handle self-generated vs remote records ---
        if (record.username === localUsername) {
            // --- Self-generated event ---
            // Process immediately, no delay or TTL check needed here.
            const notificationArgs = mapRecordToNotificationArgs(record);
            if (notificationArgs) {
                addNotification(...notificationArgs);
                console.log(`GlobalNotifier: Processed self-generated record ${record.id} (${record.type})`);
            } else {
                 console.log(`GlobalNotifier: Skipped mapping self-generated record ${record.id} (${record.type}) - likely filtered`);
            }
            processedRecordIds.add(record.id); // Mark as processed

        } else {
            // --- Remote event ---
            // Skip if the record is too old (optional cleanup)
            if (now - record.timestamp > RECORD_TTL_MS) {
                processedRecordIds.add(record.id); // Mark as processed even if old
                return;
            }

            // Process the notification event from another client
            console.log(`GlobalNotifier: Processing remote record ${record.id} (${record.type}) from ${record.username}`);
            const notificationArgs = mapRecordToNotificationArgs(record);
             if (notificationArgs) {
                 addNotification(...notificationArgs);
             }
             processedRecordIds.add(record.id); // Mark as processed
        }
    });

    // Optional: Clean up processedRecordIds if it grows too large
    if (processedRecordIds.size > 500) {
        // Simple cleanup: remove oldest half based on assumption they were added chronologically
        const oldestIds = Array.from(processedRecordIds).slice(0, Math.floor(processedRecordIds.size / 2));
        oldestIds.forEach(id => processedRecordIds.delete(id));
        console.log(`GlobalNotifier: Cleaned up ${oldestIds.length} old processed record IDs.`);
    }
}

/**
 * Broadcasts a notification event to all clients by creating a database record.
 * @param {string} eventType - The type of notification (e.g., 'PLAYER_LOSS').
 * @param {object} payload - Data associated with the event (e.g., { loserUsername: '...' }).
 */
export async function broadcastNotification(eventType, payload) {
    if (!room || !room.collection || !room.clientId) {
        console.error("GlobalNotifier: Room/Client ID not available for broadcasting.");
        return;
    }
    const localUsername = room.peers[room.clientId]?.username;
    if (!localUsername) {
        console.error("GlobalNotifier: Could not get local username for broadcasting.");
        return; // Need username to be added automatically
    }

    console.log(`Broadcasting notification: ${eventType}`, payload);
    try {
        await room.collection(NOTIFICATION_COLLECTION).create({
            type: eventType,
            payload: payload,
            timestamp: Date.now() // Add timestamp for filtering/ordering
            // `username` is added automatically by WebsimSocket
        });
    } catch (error) {
        console.error(`Error broadcasting notification (${eventType}):`, error);
    }
}

/**
 * Initializes the global notification system by subscribing to records.
 */
export function initializeGlobalNotifier() {
    if (!room || !room.collection) {
        console.error("GlobalNotifier: Room not available for initialization.");
        return;
    }
    console.log("Initializing Global Notifier...");

    // Unsubscribe from previous listener if any
    unsubscribeNotifications();
    processedRecordIds.clear(); // Clear processed set on re-init

    // Subscribe to the notification collection
    unsubscribeNotifications = room.collection(NOTIFICATION_COLLECTION).subscribe(handleNotificationRecords);

    // Trigger initial fetch/processing (will handle both self and remote)
    // Filter out very old records initially to avoid processing backlog unnecessarily
    const initialRecords = room.collection(NOTIFICATION_COLLECTION).getList();
    const recentInitialRecords = initialRecords.filter(r => (Date.now() - (r.timestamp || 0)) <= RECORD_TTL_MS);
    handleNotificationRecords(recentInitialRecords);
    console.log(`GlobalNotifier: Initial processing of ${recentInitialRecords.length} recent records.`);
}

/**
 * Cleans up the global notification system subscription.
 */
export function cleanupGlobalNotifier() {
    console.log("Cleaning up Global Notifier...");
    unsubscribeNotifications();
    processedRecordIds.clear();
}