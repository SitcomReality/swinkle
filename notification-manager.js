/**
 * notification-manager.js
 * Manages the state and logic for notifications.
 * Handles adding local/global notifications, updates, and cleanup.
 * Delegates DOM manipulation to notification-renderer.js.
 */
// Import room instance from main.js to use collections
import { room } from './main.js';
// Import DOM rendering functions
import {
    renderNotificationsDOM,
    removeNotificationDOM,
    clearNotificationsDOM,
    getNotificationsContainer // Renderer handles container creation
} from './notification-renderer.js'; // Ensure path is correct

// Store active notifications: { id: { id, message, type, startTime, duration, element, count, recordId? } }
const activeNotifications = new Map();
// Store IDs of global notification records *currently being displayed or fading out*
// This prevents rapid re-adding if the subscription fires multiple times quickly for the same record.
// IDs are removed once the notification is fully gone (after fade-out).
const displayedGlobalNotificationIds = new Set(); // Note: This set's usage is reduced after the fix below.
let notificationCounter = 0;

// Default notification duration (can be overridden)
const DEFAULT_DURATION = 3000; // 3 seconds

let unsubscribeGlobalNotifications = () => {}; // Unsubscribe function for global notifications


/**
 * Internal function to add or update a notification in the state map.
 * Handles duplicate checking and combining for *active* notifications.
 * Prevents re-adding global notifications that are currently active or fading out.
 * Calls the renderer to update the DOM.
 * @param {string} message - The text content.
 * @param {string} type - Notification type.
 * @param {number} duration - Duration in ms.
 * @param {string|null} recordId - The ID of the Websim record if this is a global notification.
 * @param {number|null} startTimeOverride - Specific start time (e.g., from record creation).
 */
function addNotificationInternal(message, type, duration, recordId = null, startTimeOverride = null) {
    const now = Date.now();
    const startTime = startTimeOverride !== null ? startTimeOverride : now;

    // Basic validation
    if (!message || typeof message !== 'string') {
        console.warn("Invalid message provided for notification.");
        return;
    }
    if (typeof duration !== 'number' || duration <= 0) {
        console.warn(`Invalid duration for notification "${message}". Using default.`);
        duration = DEFAULT_DURATION;
    }

    // --- Check for Identical ACTIVE Notification ---
    let foundActiveMatch = false;
    activeNotifications.forEach(existingNotification => {
        const isGlobalMatch = recordId && existingNotification.recordId === recordId;
        const isLocalMatch = !recordId && !existingNotification.recordId && existingNotification.message === message && existingNotification.type === type;

        if (!foundActiveMatch && (isGlobalMatch || isLocalMatch)) {
            if (isLocalMatch) {
                existingNotification.count = (existingNotification.count || 1) + 1;
            }
            existingNotification.startTime = startTime;
            existingNotification.duration = duration;

            if (recordId) displayedGlobalNotificationIds.add(recordId);

            foundActiveMatch = true;
            updateAndRenderNotifications(now); // Trigger DOM update via renderer
        }
    });

    if (foundActiveMatch) return;

    // Add new notification if no active match was found
    const id = `notif-${notificationCounter++}`;
    activeNotifications.set(id, {
        id,
        message,
        type,
        startTime,
        duration,
        element: null, // Renderer will manage the element reference
        count: 1,
        recordId // Store the record ID if it's a global notification
    });

    if (recordId) {
        displayedGlobalNotificationIds.add(recordId);
        if (displayedGlobalNotificationIds.size > 500) {
            const oldIds = Array.from(displayedGlobalNotificationIds).slice(0, 100);
            oldIds.forEach(oldId => displayedGlobalNotificationIds.delete(oldId));
            console.log("Pruned old displayed global notification IDs.");
        }
    }

    updateAndRenderNotifications(now); // Trigger DOM update via renderer
}

/**
 * Adds a *local* notification (only visible to the current client).
 * @param {string} message - The text content of the notification.
 * @param {string} [type='info'] - Type of notification.
 * @param {number} [duration=DEFAULT_DURATION] - Duration in ms.
 */
export function addNotification(message, type = 'info', duration = DEFAULT_DURATION) {
    addNotificationInternal(message, type, duration, null, null);
}

/**
 * Adds a *global* notification visible to all players by creating a Websim record.
 * Relies on the subscription in initializeNotificationManager to display it.
 * Includes detailed logging for debugging.
 * @param {string} message - The text content of the notification.
 * @param {string} [type='info'] - Type of notification.
 * @param {number} [duration=DEFAULT_DURATION] - Duration in ms.
 */
export async function addGlobalNotification(message, type = 'info', duration = DEFAULT_DURATION) {
    const notificationData = {
        message,
        type,
        duration
        // created_at is added automatically
    };
    console.log(`[DEBUG] Attempting to create global notification record:`, { ...notificationData }); // Log data being sent
    try {
        // Use v2 to avoid conflict with any old test data
        const record = await room.collection('notification_v2').create(notificationData);
        console.log(`[DEBUG] Successfully created global notification record:`, record); // Log success and the created record
    } catch (error) {
        console.error("[DEBUG] Failed to create global notification record:", error, "Data:", notificationData); // Log error and data
        // Fallback to local notification on error
        addNotification(`[Global Failed] ${message}`, 'error');
    }
}

/**
 * Removes expired notifications and cleans up displayed global IDs.
 * Calls the renderer to update the DOM if changes occurred.
 * @param {number} now - The current timestamp (Date.now()).
 */
export function updateNotifications(now) {
    const notificationsToRemove = [];
    let fadeOutTime = 500; // Default fadeOutTime, get from config if possible
    // Attempt to get fadeOutTime from renderer's config - requires renderer to export it or pass it during init
    // For simplicity, hardcoding it here for now, but ideally it would come from the renderer's config.
    // Example: fadeOutTime = NOTIFICATION_CONFIG.fadeOutTime (if imported/available)

    activeNotifications.forEach(notification => {
        if (now >= notification.startTime + notification.duration + fadeOutTime) {
            notificationsToRemove.push(notification.id);
            if (notification.recordId) {
                displayedGlobalNotificationIds.delete(notification.recordId);
            }
        }
    });

    let changed = false;
    notificationsToRemove.forEach(id => {
         if (activeNotifications.has(id)) {
             activeNotifications.delete(id);
             changed = true;
         }
    });

    if (changed) {
        updateAndRenderNotifications(now); // Update the DOM via renderer
    }
}

/**
 * Updates the notification state and triggers the renderer.
 * INTERNAL function called by add/update logic.
 * @param {number} now - The current timestamp (Date.now()).
 */
function updateAndRenderNotifications(now) {
    // Callback function for the renderer to delete from our map
    const deleteCallback = (id) => activeNotifications.delete(id);
    // Call the renderer function, passing the state it needs
    renderNotificationsDOM(activeNotifications, now, displayedGlobalNotificationIds, deleteCallback);
}

/**
 * Removes a specific notification by its ID from state and triggers DOM removal.
 * @param {string} id - The ID of the notification to remove.
 */
export function removeNotification(id) {
    const notification = activeNotifications.get(id);
    if (notification) {
        removeNotificationDOM(id, notification, displayedGlobalNotificationIds); // Trigger DOM removal via renderer
    }
    activeNotifications.delete(id); // Remove from active map immediately
}

/**
 * Clears all active notifications from state and triggers DOM clearing.
 */
export function clearNotifications() {
    activeNotifications.clear();
    displayedGlobalNotificationIds.clear();
    clearNotificationsDOM(); // Trigger DOM clearing via renderer
}

/**
 * Initializes the notification manager. Ensures container exists and subscribes to global notifications.
 */
export function initializeNotificationManager() {
    console.log("Notification Manager Initialized.");
    getNotificationsContainer(); // Ensure container is ready via renderer

    // Subscribe to global notifications (use a versioned collection name)
    unsubscribeGlobalNotifications = room.collection('notification_v2').subscribe((notificationRecords) => {
        console.log(`[DEBUG] Received ${notificationRecords.length} global notification records via subscription.`); // Debugging line
        notificationRecords.forEach(record => {
            if (record && record.message && record.type && record.duration && record.created_at && record.id) {
                const startTime = new Date(record.created_at).getTime();
                console.log(`[DEBUG] Processing global notification record ${record.id} (created: ${record.created_at}): "${record.message}"`); // Debugging line
                addNotificationInternal(record.message, record.type, record.duration, record.id, startTime);
            } else {
                console.warn("[DEBUG] Received invalid global notification record:", record);
            }
        });
    });

    clearNotifications(); // Clear any stale notifications if restarting
}

/**
 * Cleans up notification subscriptions.
 */
export function cleanupNotifications() {
    console.log("Cleaning up notification subscriptions...");
    if (typeof unsubscribeGlobalNotifications === 'function') {
        unsubscribeGlobalNotifications();
    }
    clearNotifications();
}