/**
 * notification-renderer.js
 * Handles the DOM manipulation and rendering of notification elements.
 */

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
export function getNotificationsContainer() {
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
 * Updates the DOM elements for active notifications based on the provided map.
 * @param {Map<string, object>} activeNotifications - Map of active notifications from the manager.
 * @param {number} now - The current timestamp (Date.now()).
 * @param {Set<string>} displayedGlobalNotificationIds - Set of displayed global IDs (needed for cleanup).
 * @param {Function} deleteActiveNotification - Callback to delete a notification from the manager's map.
 */
export function renderNotificationsDOM(activeNotifications, now, displayedGlobalNotificationIds, deleteActiveNotification) {
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
            // Clean up unexpected children
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
                    // Also ensure removed from activeNotifications map if somehow still there
                    // Call back to the manager to delete it from the map
                    const notifToDelete = activeNotifications.get(id);
                    if (notifToDelete) {
                        // Ensure removed from displayed set too, although should have happened in updateNotifications
                         if (notifToDelete.recordId) {
                             // This delete is mainly for pruning logic now
                             displayedGlobalNotificationIds.delete(notifToDelete.recordId);
                         }
                         deleteActiveNotification(id); // Use callback
                    }

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
            notification.element = element; // Store reference BACK on the notification object in the manager's map
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
             // Ensure the reference is up-to-date (might be redundant but safe)
             notification.element = element;
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

        // Age/fade-out check is handled by updateNotifications in the manager
    });
}

/**
 * Removes a specific notification element from the DOM with fade-out animation.
 * @param {string} id - The ID of the notification to remove.
 * @param {object} notification - The notification object from the manager's map.
 * @param {Set<string>} displayedGlobalNotificationIds - Set of displayed global IDs.
 */
export function removeNotificationDOM(id, notification, displayedGlobalNotificationIds) {
    if (notification && notification.element && notification.element.parentElement) {
        // Trigger fade out animation
         if (!notification.element.classList.contains('fade-out')) {
            notification.element.classList.add('fade-out');
            notification.element.style.animation = `notificationFadeOut ${NOTIFICATION_CONFIG.fadeOutTime / 1000}s forwards`;
            setTimeout(() => {
                 const container = getNotificationsContainer(); // Get container again
                 if (notification.element.parentElement === container) {
                     container.removeChild(notification.element);
                 }
                 // Remove from displayedGlobalNotificationIds when fadeout completes
                 // (Primarily for pruning now)
                 if (notification.recordId) {
                    displayedGlobalNotificationIds.delete(notification.recordId);
                 }
             }, NOTIFICATION_CONFIG.fadeOutTime);
         }
    }
}

/**
 * Clears all notification elements from the DOM.
 */
export function clearNotificationsDOM() {
    const container = getNotificationsContainer();
    if (container) container.innerHTML = ''; // Clear container contents
}