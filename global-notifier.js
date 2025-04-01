/**
 * global-notifier.js
 * Handles broadcasting and receiving global notification events via database records.
 */
import { addNotification } from './notification-manager.js';
import { room } from './main.js'; // Import room to access client ID and collection

const NOTIFICATION_COLLECTION = 'global_notification_event_v1';
const RECORD_TTL_MS = 60 * 1000; // Keep records for 1 minute before potential cleanup
const PROCESS_DELAY_MS = 100; // Slight delay to avoid processing self-generated events immediately

let processedRecordIds = new Set(); // Keep track of processed record IDs to prevent duplicates
let unsubscribeNotifications = () => {};

/**
 * Broadcasts a notification event to all clients by creating a database record.
 * @param {string} eventType - The type of notification (e.g., 'PLAYER_LOSS').
 * @param {object} payload - Data associated with the event (e.g., { loserUsername: '...' }).
 */
export async function broadcastNotification(eventType, payload) {
    if (!room || !room.collection) {
        console.error("GlobalNotifier: Room not available for broadcasting.");
        return;
    }
    console.log(`Broadcasting notification: ${eventType}`, payload);
    try {
        await room.collection(NOTIFICATION_COLLECTION).create({
            type: eventType,
            payload: payload,
            timestamp: Date.now() // Add timestamp for filtering/ordering
        });
    } catch (error) {
        console.error(`Error broadcasting notification (${eventType}):`, error);
    }
}

/**
 * Handles incoming notification records from the database subscription.
 * @param {Array<object>} records - Array of notification event records.
 */
function handleNotificationRecords(records) {
    if (!room || !room.clientId) return;

    const now = Date.now();
    const localClientId = room.clientId;

    // Sort records by creation time (oldest first) to process in order
    // Note: getList already sorts newest first, so we might need to reverse if subscribing
    // Let's assume subscribe also gives newest first and reverse it.
    const sortedRecords = records.slice().reverse();

    sortedRecords.forEach(record => {
        // Basic validation
        if (!record || !record.id || !record.type || !record.payload || !record.timestamp) {
            console.warn("GlobalNotifier: Received invalid notification record:", record);
            return;
        }

        // Skip if already processed
        if (processedRecordIds.has(record.id)) {
            return;
        }

        // Skip if the record is too old (optional cleanup)
        if (now - record.timestamp > RECORD_TTL_MS) {
            // Optionally delete old records here? Be careful with permissions.
            // room.collection(NOTIFICATION_COLLECTION).delete(record.id).catch(e => {}); // Best-effort delete
            processedRecordIds.add(record.id); // Add to processed set even if old, to prevent reprocessing if cleanup fails
            return;
        }

        // Skip if the record was created by the current client (prevent self-notification via broadcast)
        // Note: WebsimSocket automatically adds `username` to records, not `clientId`.
        // We need to compare usernames.
        if (record.username === room.peers[localClientId]?.username) {
             // console.log(`GlobalNotifier: Skipping self-generated notification record: ${record.id}`);
             processedRecordIds.add(record.id); // Mark as processed to avoid re-checking
             return;
        }

        // Process the notification event
        console.log(`GlobalNotifier: Processing record ${record.id} from ${record.username}`);
        processedRecordIds.add(record.id); // Mark as processed

        const { type, payload } = record;

        // --- Map event types to local addNotification calls ---
        switch (type) {
            case 'PLAYER_LOSS':
                if (payload.loserUsername) {
                    addNotification(`${payload.loserUsername} was PAINTED OUT!`, 'loss', 5000);
                }
                break;

            case 'POWERUP_COLLECT':
                if (payload.collectorUsername && payload.powerupName) {
                    addNotification(`${payload.collectorUsername} collected ${payload.powerupName}!`, 'pickup', 3000);
                }
                break;

            // Add other cases here...

            default:
                console.warn(`GlobalNotifier: Unhandled notification event type: ${type}`);
        }
    });

    // Optional: Clean up processedRecordIds if it grows too large
    if (processedRecordIds.size > 500) {
        // Simple cleanup: remove oldest half
        const oldestIds = Array.from(processedRecordIds).slice(0, processedRecordIds.size / 2);
        oldestIds.forEach(id => processedRecordIds.delete(id));
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

    // Subscribe to the notification collection
    unsubscribeNotifications = room.collection(NOTIFICATION_COLLECTION).subscribe(handleNotificationRecords);

    // Trigger initial fetch/processing
    handleNotificationRecords(room.collection(NOTIFICATION_COLLECTION).getList());
}

/**
 * Cleans up the global notification system subscription.
 */
export function cleanupGlobalNotifier() {
    console.log("Cleaning up Global Notifier...");
    unsubscribeNotifications();
    processedRecordIds.clear();
}