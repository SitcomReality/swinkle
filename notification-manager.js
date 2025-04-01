/**
 * notification-manager.js
 * Manages displaying temporary messages (notifications) to the user on screen.
 */

// Store active notifications
const activeNotifications = new Map(); // { id: { id, message, type, startTime, duration, element } }
let notificationCounter = 0;

// Default notification duration (can be overridden)
const DEFAULT_DURATION = 3000; // 3 seconds

// Configuration for notifications
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
 * Adds a new notification to be displayed.
 * @param {string} message - The text content of the notification.
 * @param {string} [type='info'] - Type of notification ('info', 'success', 'warning', 'error', 'pickup', 'loss', 'join', 'leave', 'tip', 'score'). Affects styling/icon later.
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

    // --- Check for Identical Active Notification ---
    let foundMatch = false;
    activeNotifications.forEach(existingNotification => {
        if (!foundMatch && existingNotification.message === message && existingNotification.type === type) {
            // Found an identical notification
            existingNotification.count = (existingNotification.count || 1) + 1; // Increment count
            existingNotification.startTime = now; // Reset timer
            existingNotification.duration = duration; // Update duration in case it changed
            foundMatch = true;
            // console.log(`Combined notification (${type}): ${message} (x${existingNotification.count})`);
            // Trigger update to reflect the change immediately (e.g., text update, position)
            updateAndRenderNotifications(now);
        }
    });

    if (foundMatch) return; // Don't add a new one if we combined it

    activeNotifications.set(id, {
        id,
        message,
        type,
        startTime: now,
        duration,
        element: null, // Will store the DOM element reference
        count: 1 // Initialize count
    });
    // console.log(`Added notification (${type}): ${message}`); // Optional logging

    // Trigger an immediate update/render to show the new notification
    updateAndRenderNotifications(Date.now());
}

/**
 * Removes expired notifications. Called every frame in the game loop.
 * Also triggers the rendering/update process.
 * @param {number} now - The current timestamp (Date.now()).
 */
export function updateNotifications(now) {
    // Remove expired notifications from the map
    const notificationsToRemove = [];
    activeNotifications.forEach(notification => {
        if (now >= notification.startTime + notification.duration + NOTIFICATION_CONFIG.fadeOutTime) {
             // Keep it slightly longer than duration to allow fade-out
            notificationsToRemove.push(notification.id);
        }
    });

    notificationsToRemove.forEach(id => activeNotifications.delete(id));

    // Update the DOM based on the current state
    updateAndRenderNotifications(now);
}

/**
 * Updates the DOM elements for active notifications. Handles creation, removal, positioning, and animations.
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

            element.appendChild(content); // Append to container
            container.appendChild(element); // Append to container

            // Apply fade-in animation
            element.style.animation = `notificationFadeIn ${NOTIFICATION_CONFIG.fadeInTime / 1000}s forwards`;

        }

        // Update existing message text if count changed
        const messageSpan = element.querySelector('.notification-message');
        if (messageSpan) {
            const expectedText = notification.message + (notification.count > 1 ? ` (x${notification.count})` : '');
            if (messageSpan.textContent !== expectedText) messageSpan.textContent = expectedText;
        }

        // Ensure fade-out class is removed if it was added previously (e.g., if it reappeared)
         element.classList.remove('fade-out');
         // Remove explicit animation style if it was fade-out, let CSS handle default state
         if (element.style.animation.includes('notificationFadeOut')) {
             element.style.animation = '';
         }

        // Calculate vertical position - newest at bottom (index = visibleNotifications.length - 1)
        // translateY should be based on position *from the top*
        const yPos = index * (NOTIFICATION_CONFIG.height + NOTIFICATION_CONFIG.spacing);
        element.style.transform = `translateY(${yPos}px)`;

        // Optionally handle fade-out based on time remaining (can make it smoother)
        const age = now - notification.startTime;
        const timeLeft = notification.duration - age;
        if (timeLeft < NOTIFICATION_CONFIG.fadeOutTime && !element.classList.contains('fade-out')) {
             // Start fading out early if using opacity transition instead of animation for this part
            // element.style.opacity = Math.max(0, timeLeft / NOTIFICATION_CONFIG.fadeOutTime).toFixed(2);
            // Using animation is simpler - the removal logic handles it.
        } else {
            // element.style.opacity = '1'; // Ensure opacity is 1 if not fading
        }
    });
}

/**
 * Renders active notifications on the canvas. (Deprecated - Now uses DOM manipulation)
 * @deprecated Use updateAndRenderNotifications instead.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {number} now - The current timestamp (Date.now()).
 */
export function renderNotifications(ctx, now) {
    // This function is no longer used for rendering.
    // Kept for compatibility if called elsewhere, but does nothing.
    // console.warn("renderNotifications(ctx, now) is deprecated. Notifications are now handled via DOM.");
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
 * Initializes the notification manager. Ensures the container exists.
 */
export function initializeNotificationManager() {
    console.log("Notification Manager Initialized.");
    getNotificationsContainer(); // Ensure container is ready
    clearNotifications(); // Clear any stale notifications if restarting
}