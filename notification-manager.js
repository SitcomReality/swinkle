/**
 * notification-manager.js
 * Manages displaying temporary messages (notifications) to the user on screen.
 */

// Store active notifications
const activeNotifications = new Map(); // { id: { id, message, type, startTime, duration, ... } }
let notificationCounter = 0;

// Default notification duration (can be overridden)
const DEFAULT_DURATION = 3000; // 3 seconds

// Configuration for notifications 
const NOTIFICATION_CONFIG = {
    maxVisible: 5,        // Maximum number of notifications visible at once
    spacing: 10,          // Vertical space between notifications
    startY: 80,           // Starting Y position (from top)
    width: 300,           // Width of notification
    height: 40,           // Base height of notification
    fadeInTime: 300,      // Time in ms for fade in
    fadeOutTime: 500,     // Time in ms for fade out
    typeColors: {         // Colors for different notification types
        info: '#44AAFF',
        success: '#44FF88',
        warning: '#FFAA44',
        error: '#FF5555',
        pickup: '#FF88FF',
        loss: '#FF5555',
        join: '#66FF66',  
        leave: '#FFAA66', 
        tip: '#FFFF66'
    }
};

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
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {number} now - The current timestamp (Date.now()).
 */
export function renderNotifications(ctx, now) {
    if (activeNotifications.size === 0) return; // Skip if no notifications
    
    // Sort notifications from newest to oldest
    const sortedNotifications = Array.from(activeNotifications.values())
        .sort((a, b) => b.startTime - a.startTime)
        .slice(0, NOTIFICATION_CONFIG.maxVisible); // Limit max visible
    
    // Create and append HTML notifications instead of canvas drawing
    let notificationsContainer = document.getElementById('notifications-container');
    
    // Create container if it doesn't exist
    if (!notificationsContainer) {
        notificationsContainer = document.createElement('div');
        notificationsContainer.id = 'notifications-container';
        notificationsContainer.style.position = 'fixed';
        notificationsContainer.style.right = '20px';
        notificationsContainer.style.top = NOTIFICATION_CONFIG.startY + 'px';
        notificationsContainer.style.zIndex = '1000';
        document.body.appendChild(notificationsContainer);
    }
    
    // Clear existing notifications that aren't in our active set
    Array.from(notificationsContainer.children).forEach(child => {
        const notificationId = child.dataset.id;
        if (!activeNotifications.has(notificationId)) {
            // Start fade out animation
            child.style.animation = 'notificationFadeOut 0.5s forwards';
            // Remove after animation completes
            setTimeout(() => {
                if (child.parentElement === notificationsContainer) {
                    notificationsContainer.removeChild(child);
                }
            }, 500);
        }
    });
    
    // Add/update notifications
    sortedNotifications.forEach((notification, index) => {
        let element = document.getElementById(`notification-${notification.id}`);
        const age = now - notification.startTime;
        const timeLeft = notification.duration - age;
        
        // If notification is about to expire, skip creating/updating it
        if (timeLeft < 100) return;
        
        if (!element) {
            // Create new notification element
            element = document.createElement('div');
            element.id = `notification-${notification.id}`;
            element.dataset.id = notification.id;
            element.className = `notification notification-${notification.type || 'info'}`;
            element.style.animation = 'notificationFadeIn 0.3s forwards';
            element.style.marginBottom = '10px';
            
            // Create content
            const content = document.createElement('div');
            content.className = 'notification-content';
            
            // Add icon indicator
            const icon = document.createElement('div');
            icon.className = 'notification-icon';
            content.appendChild(icon);
            
            // Add message
            const message = document.createElement('span');
            message.textContent = notification.message;
            content.appendChild(message);
            
            element.appendChild(content);
            notificationsContainer.appendChild(element);
        }
        
        // Position based on index
        element.style.transform = `translateY(${index * (NOTIFICATION_CONFIG.height + NOTIFICATION_CONFIG.spacing)}px)`;
        
        // Start fade-out animation if approaching end of duration
        if (timeLeft < NOTIFICATION_CONFIG.fadeOutTime) {
            element.style.opacity = (timeLeft / NOTIFICATION_CONFIG.fadeOutTime).toFixed(2);
        }
    });
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