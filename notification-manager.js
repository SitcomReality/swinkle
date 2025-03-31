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
    
    ctx.save(); // Save context state
    
    // Sort notifications from newest to oldest
    const sortedNotifications = Array.from(activeNotifications.values())
        .sort((a, b) => b.startTime - a.startTime)
        .slice(0, NOTIFICATION_CONFIG.maxVisible); // Limit max visible
    
    // Position and render each notification
    let currentY = NOTIFICATION_CONFIG.startY;
    
    sortedNotifications.forEach(notification => {
        const age = now - notification.startTime;
        const timeLeft = notification.duration - age;
        
        // Calculate alpha based on fade in/out
        let alpha = 1.0;
        if (age < NOTIFICATION_CONFIG.fadeInTime) {
            alpha = age / NOTIFICATION_CONFIG.fadeInTime; // Fade in
        } else if (timeLeft < NOTIFICATION_CONFIG.fadeOutTime) {
            alpha = timeLeft / NOTIFICATION_CONFIG.fadeOutTime; // Fade out
        }
        
        // Skip rendering if completely transparent
        if (alpha <= 0.01) return;
        
        // Determine color based on type
        const color = NOTIFICATION_CONFIG.typeColors[notification.type] || NOTIFICATION_CONFIG.typeColors.info;
        
        // Calculate width - can adjust based on content length if desired
        const width = NOTIFICATION_CONFIG.width;
        const height = NOTIFICATION_CONFIG.height;
        const x = ctx.canvas.width - width - 20; // Position on right side with margin
        
        // Draw notification background with rounded corners
        ctx.globalAlpha = alpha * 0.9; // Slightly transparent bg
        ctx.fillStyle = 'rgba(20, 20, 40, 0.85)'; // Dark background
        
        // Draw rounded rectangle
        const radius = 8;
        ctx.beginPath();
        ctx.moveTo(x + radius, currentY);
        ctx.lineTo(x + width - radius, currentY);
        ctx.quadraticCurveTo(x + width, currentY, x + width, currentY + radius);
        ctx.lineTo(x + width, currentY + height - radius);
        ctx.quadraticCurveTo(x + width, currentY + height, x + width - radius, currentY + height);
        ctx.lineTo(x + radius, currentY + height);
        ctx.quadraticCurveTo(x, currentY + height, x, currentY + height - radius);
        ctx.lineTo(x, currentY + radius);
        ctx.quadraticCurveTo(x, currentY, x + radius, currentY);
        ctx.closePath();
        ctx.fill();
        
        // Draw colored left border
        ctx.fillStyle = color;
        ctx.fillRect(x, currentY, 4, height);
        
        // Draw text
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '14px "Lucida Console", Monaco, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        // Draw text with shadow for better readability
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        
        // Truncate long messages with ellipsis
        const maxLength = 30;
        let displayText = notification.message;
        if (displayText.length > maxLength) {
            displayText = displayText.substring(0, maxLength - 3) + '...';
        }
        
        ctx.fillText(displayText, x + 15, currentY + height/2);
        
        // Optional: Draw icon based on type (would need icon definitions)
        // For now just draw a colored circle as a simple icon
        ctx.shadowBlur = 0; // Disable shadow for icon
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + 10, currentY + height/2, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Update Y position for next notification
        currentY += height + NOTIFICATION_CONFIG.spacing;
    });
    
    ctx.restore(); // Restore context state
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