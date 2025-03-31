/**
 * notification-manager.js
 * Manages displaying temporary messages (notifications) to the user on screen.
 */

// Store active notifications
const activeNotifications = new Map(); // { id: { id, message, type, startTime, duration, ... } }
let notificationCounter = 0;

// Default notification duration (can be overridden)
const DEFAULT_DURATION = 3000; // 3 seconds

/**
 * Adds a new notification to be displayed.
 * @param {string} message - The text content of the notification.
 * @param {string} [type='info'] - Type of notification ('info', 'success', 'warning', 'error', 'pickup', 'loss', 'join', 'leave', 'tip'). Affects styling/icon later.
 * @param {number} [duration=DEFAULT_DURATION] - How long the notification should stay on screen in milliseconds.
 */
export function addNotification(message, type = 'info', duration = DEFAULT_DURATION) {
    const id = `notif-${notificationCounter++}`;
    const now = Date.now();

    // Basic validation
    if (!message || typeof message !== 'string') {
        console.warn("Invalid message provided for notification.");
        return;
    }
    if (typeof duration !== 'number' || duration <= 0) {
        console.warn(`Invalid duration for notification "${message}". Using default.`);
        duration = DEFAULT_DURATION;
    }

    activeNotifications.set(id, {
        id,
        message,
        type,
        startTime: now,
        duration
    });
    // console.log(`Added notification (${type}): ${message}`); // Optional logging
}

/**
 * Removes expired notifications. Called every frame in the game loop.
 * @param {number} now - The current timestamp (Date.now()).
 */
export function updateNotifications(now) {
    const notificationsToRemove = [];
    activeNotifications.forEach(notification => {
        if (now >= notification.startTime + notification.duration) {
            notificationsToRemove.push(notification.id);
        }
    });

    notificationsToRemove.forEach(id => activeNotifications.delete(id));
}

/**
 * Renders active notifications on the canvas.
 * Basic implementation for now - just text at the top.
 * NOTE: Step 1.2 will enhance this rendering logic.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {number} now - The current timestamp (Date.now()).
 */
export function renderNotifications(ctx, now) {
    // Basic rendering logic will be added in step 1.2
    // For now, this function does nothing visually.
}

/**
 * Removes a specific notification by its ID.
 * (Not strictly necessary for expiration-based removal, but might be useful).
 * @param {string} id - The ID of the notification to remove.
 */
export function removeNotification(id) {
    activeNotifications.delete(id);
}

/**
 * Clears all active notifications.
 */
export function clearNotifications() {
    activeNotifications.clear();
}

/**
 * Initializes the notification manager (currently does nothing, placeholder).
 */
export function initializeNotificationManager() {
    console.log("Notification Manager Initialized.");
    clearNotifications(); // Clear any stale notifications if restarting
}