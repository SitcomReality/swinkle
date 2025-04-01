/**
 * notification-manager.js
 * Manages displaying temporary messages (notifications) to the user on screen.
 * Supports both local notifications and global notifications via Websim records.
 */
// Import room instance from main.js to use collections
import { room } from './main.js';

// Store active notifications: { id: { id, message, type, startTime, duration, element, count, recordId? } }
const activeNotifications = new Map();
// Store IDs of global notification records already displayed to prevent duplicates
const displayedGlobalNotificationIds = new Set();
let notificationCounter = 0;

// Default notification duration (can be overridden)
const DEFAULT_DURATION = 3000; // 3 seconds

// Configuration for notifications (unchanged)
const NOTIFICATION_CONFIG = {
    maxVisible: 5,        // Maximum number of notifications visible at once
    spacing: 10,          // Vertical space between notifications
    startY: 80,           // Starting Y position (from top) for the container
    height: 45,           // Estimated height of a notification (for spacing)
    fadeInTime: 300,      // Time in ms for fade in animation
    fadeOutTime: 500,     // Time in ms for fade out animation
    typeColors: {         // Colors for different notification types (used in CSS)
        info: '#44AAFF',
        success: '#44FF88',
        warning: '#FFAA44',
        error: '#FF5555',
        pickup: '#FF88FF',
        score: '#66FFAA', // Add color for score notifications
        loss: '#FF5555',
        join: '#66FF66',
        leave: '#FFAA66',
        tip: '#FFFF66'
    }
};

let notificationsContainer = null;
let unsubscribeGlobalNotifications = () => {}; // Unsubscribe function for global notifications

/**
 * Creates or retrieves the main container for notification elements.
 * @returns {HTMLElement} The container element.
 */
function getNotificationsContainer() {
    if (!notificationsContainer) {
        notificationsContainer = document.getElementById('notifications-container');
        if (!notificationsContainer) {
            console.log("Creating notifications container div.");
            notificationsContainer = document.createElement('div');
            notificationsContainer.id = 'notifications-container';
            // Apply styles via CSS file now
            document.body.appendChild(notificationsContainer);
        }
    }
    return notificationsContainer;
}

/**
 * Internal function to add or update a notification in the DOM.
 * Handles duplicate checking and combining.
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

    // --- Check for Identical Active Notification ---
    let foundMatch = false;
    activeNotifications.forEach(existingNotification => {
        // Match local notifications by message/type, or global ones by recordId
        const isMatch = (recordId && existingNotification.recordId === recordId) ||
                        (!recordId && !existingNotification.recordId && existingNotification.message === message && existingNotification.type === type);

        if (!foundMatch && isMatch) {
            existingNotification.count = (existingNotification.count || 1) + 1; // Increment count
            existingNotification.startTime = startTime; // Reset timer
            existingNotification.duration = duration; // Update duration
            // If it's a global notification reappearing, ensure we track it as displayed again
            if (recordId) displayedGlobalNotificationIds.add(recordId);
            foundMatch = true;
            updateAndRenderNotifications(now); // Trigger update
        }
    });

    if (foundMatch) return; // Don't add a new one if we combined it

    // If it's a global notification, check if we've *ever* displayed it
    if (recordId && displayedGlobalNotificationIds.has(recordId)) {
         // console.log(`Skipping already displayed global notification: ${recordId}`);
         return;
    }

    // Add new notification
    const id = `notif-${notificationCounter++}`;
    activeNotifications.set(id, {
        id,
        message,
        type,
        startTime,
        duration,
        element: null,
        count: 1,
        recordId // Store the record ID if it's a global notification
    });

    // If it's a global notification, mark it as displayed
    if (recordId) {
        displayedGlobalNotificationIds.add(recordId);
        // Simple pruning: Occasionally clear very old IDs to prevent memory leak
        if (displayedGlobalNotificationIds.size > 500) { // Arbitrary limit
            // This is basic; a time-based cleanup might be better
            const oldIds = Array.from(displayedGlobalNotificationIds).slice(0, 100);
            oldIds.forEach(oldId => displayedGlobalNotificationIds.delete(oldId));
            console.log("Pruned old displayed global notification IDs.");
        }
    }

    updateAndRenderNotifications(now); // Trigger render
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
 * @param {string} message - The text content of the notification.
 * @param {string} [type='info'] - Type of notification.
 * @param {number} [duration=DEFAULT_DURATION] - Duration in ms.
 */
export async function addGlobalNotification(message, type = 'info', duration = DEFAULT_DURATION) {
    console.log(`Creating global notification: "${message}" (Type: ${type})`);
    try {
        // Use v2 to avoid conflict with any old test data
        await room.collection('notification_v2').create({
            message,
            type,
            duration
            // created_at is added automatically
        });
    } catch (error) {
        console.error("Failed to create global notification record:", error);
        // Fallback to local notification on error
        addNotification(`[Global Failed] ${message}`, 'error');
    }
}

/**
 * Removes expired notifications and cleans up displayed global IDs.
 * @param {number} now - The current timestamp (Date.now()).
 */
export function updateNotifications(now) {
    const notificationsToRemove = [];
    activeNotifications.forEach(notification => {
        if (now >= notification.startTime + notification.duration + NOTIFICATION_CONFIG.fadeOutTime) {
            notificationsToRemove.push(notification.id);
            // If this was a global notification, allow it to be displayed again if the record reappears later
            // Note: We might want a longer timeout before removing from displayedGlobalNotificationIds
            //       to handle network lag or brief disconnects more gracefully.
            //       For now, remove immediately when it fades out locally.
            if (notification.recordId) {
                // console.log(`Removing global notification ${notification.recordId} from displayed set.`);
                // Keep it in the set for a bit longer? Maybe 30s after fade?
                // setTimeout(() => displayedGlobalNotificationIds.delete(notification.recordId), 30000);
                // Or remove immediately:
                displayedGlobalNotificationIds.delete(notification.recordId);
            }
        }
    });

    notificationsToRemove.forEach(id => activeNotifications.delete(id));
    updateAndRenderNotifications(now); // Update the DOM
}

/**
 * Updates the DOM elements for active notifications.
 * @param {number} now - The current timestamp (Date.now()).
 */
function updateAndRenderNotifications(now) {
    const container = getNotificationsContainer();
    if (!container) return;

    // Get active notifications sorted oldest first, limit to max visible
    const sortedNotifications = Array.from(activeNotifications.values())
        .sort((a, b) => a.startTime - b.startTime); // Oldest first

    const visibleNotifications = sortedNotifications.slice(-NOTIFICATION_CONFIG.maxVisible); // Take the N newest
    const visibleIds = new Set(visibleNotifications.map(n => n.id));

    // --- Manage DOM Elements ---
    const currentElements = new Map();
    Array.from(container.children).forEach(child => {
        if (child.dataset.id) {
            currentElements.set(child.dataset.id, child);
        } else {
            // Clean up unexpected children?
            container.removeChild(child);
        }
    });

    // Remove elements that are no longer visible or active
    currentElements.forEach((element, id) => {
        if (!visibleIds.has(id)) {
            // Check if it's already fading out
            if (!element.classList.contains('fade-out')) {
                element.classList.add('fade-out');
                element.style.animation = `notificationFadeOut ${NOTIFICATION_CONFIG.fadeOutTime / 1000}s forwards`;
                // Remove from DOM after animation
                setTimeout(() => {
                    if (element.parentElement === container) {
                        container.removeChild(element);
                    }
                    // Also ensure removed from activeNotifications if somehow still there
                    activeNotifications.delete(id);
                }, NOTIFICATION_CONFIG.fadeOutTime);
            }
        }
    });

    // Add/Update visible elements
    visibleNotifications.forEach((notification, index) => {
        let element = currentElements.get(notification.id);

        if (!element) {
            // Create new notification element
            element = document.createElement('div');
            notification.element = element; // Store reference
            element.id = `notification-${notification.id}`;
            element.dataset.id = notification.id; // Store ID for later retrieval
            // Add recordId to dataset if present
            if (notification.recordId) {
                element.dataset.recordId = notification.recordId;
            }
            element.className = `notification notification-${notification.type || 'info'}`;
            element.style.marginBottom = `${NOTIFICATION_CONFIG.spacing}px`;

            // Create content
            const content = document.createElement('div');
            content.className = 'notification-content';

            // Add icon indicator
            const icon = document.createElement('div');
            icon.className = 'notification-icon';
            content.appendChild(icon);

            // Add message
            const messageSpan = document.createElement('span');
            messageSpan.textContent = notification.message + (notification.count > 1 ? ` (x${notification.count})` : '');
            messageSpan.className = 'notification-message'; // Add class for targeting
            content.appendChild(messageSpan);

            element.appendChild(content); // Append content to element
            container.appendChild(element); // Append element to container

            // Apply fade-in animation
            element.style.animation = `notificationFadeIn ${NOTIFICATION_CONFIG.fadeInTime / 1000}s forwards`;

        } else {
             // --- EXISTING ELEMENT ---
             // Update existing message text if count changed
            const messageSpan = element.querySelector('.notification-message');
            if (messageSpan) {
                const expectedText = notification.message + (notification.count > 1 ? ` (x${notification.count})` : '');
                if (messageSpan.textContent !== expectedText) {
                     const oldCount = parseInt(messageSpan.textContent.match(/\(x(\d+)\)$/)?.[1] || '1');
                     messageSpan.textContent = expectedText;
                     // Only pulse if the count *increased*
                     if (notification.count > oldCount) {
                          // Add the pulse animation when count increases
                          const contentElement = element.querySelector('.notification-content');
                          if (contentElement) {
                              // Remove any existing pulse class to restart animation
                              contentElement.classList.remove('notification-pulse');
                              // Force a reflow to restart animation if needed (browser dependent)
                              void contentElement.offsetWidth;
                              // Add pulse class
                              contentElement.classList.add('notification-pulse');
                              // Remove the class after animation finishes to allow re-triggering
                              setTimeout(() => {
                                  contentElement.classList.remove('notification-pulse');
                              }, 500); // Match animation duration in CSS
                          }
                     }
                }
            }

             // Ensure fade-out class is removed if it was added previously (e.g., if it reappeared)
             element.classList.remove('fade-out');
             // Remove explicit animation style if it was fade-out, let CSS handle default state
             if (element.style.animation.includes('notificationFadeOut')) {
                 element.style.animation = '';
             }
        }

        // Calculate vertical position (using CSS variable for pulse animation)
        const yPos = index * (NOTIFICATION_CONFIG.height + NOTIFICATION_CONFIG.spacing);
        element.style.setProperty('--translate-y', `${yPos}px`); // Set CSS variable
        element.style.transform = `translateY(${yPos}px)`; // Apply immediate transform

        // Age/fade-out check is handled by updateNotifications now
    });
}

/**
 * Removes a specific notification by its ID.
 * @param {string} id - The ID of the notification to remove.
 */
export function removeNotification(id) {
    const notification = activeNotifications.get(id);
    if (notification && notification.element && notification.element.parentElement) {
        // Trigger fade out animation
         if (!notification.element.classList.contains('fade-out')) {
            notification.element.classList.add('fade-out');
            notification.element.style.animation = `notificationFadeOut ${NOTIFICATION_CONFIG.fadeOutTime / 1000}s forwards`;
            setTimeout(() => {
                 if (notification.element.parentElement === getNotificationsContainer()) {
                     getNotificationsContainer().removeChild(notification.element);
                 }
             }, NOTIFICATION_CONFIG.fadeOutTime);
         }
    }
    activeNotifications.delete(id);
}

/**
 * Clears all active notifications.
 */
export function clearNotifications() {
    activeNotifications.forEach(notification => {
        if (notification.element && notification.element.parentElement) {
            notification.element.parentElement.removeChild(notification.element);
        }
    });
    activeNotifications.clear();
    const container = getNotificationsContainer();
    if (container) container.innerHTML = ''; // Clear container just in case
}

/**
 * Initializes the notification manager. Ensures container exists and subscribes to global notifications.
 */
export function initializeNotificationManager() {
    console.log("Notification Manager Initialized.");
    getNotificationsContainer(); // Ensure container is ready

    // Subscribe to global notifications (use a versioned collection name)
    unsubscribeGlobalNotifications = room.collection('notification_v2').subscribe((notificationRecords) => {
        // console.log("Received global notification records:", notificationRecords.length);
        notificationRecords.forEach(record => {
            if (record && record.message && record.type && record.duration && record.created_at) {
                const startTime = new Date(record.created_at).getTime();
                // Use internal add function to handle potential duplicates via recordId
                addNotificationInternal(record.message, record.type, record.duration, record.id, startTime);
            } else {
                console.warn("Received invalid global notification record:", record);
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
    unsubscribeGlobalNotifications();
    clearNotifications();
    displayedGlobalNotificationIds.clear();
}