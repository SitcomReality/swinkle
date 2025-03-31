/**
 * scoreboard.js
 * Manages the display and data updates for the game scoreboard.
 */
import config from 'config';

let scoreboardRoom = null; // Store the room instance
let lossCounts = {}; // Store aggregated loss counts { username: count }
let unsubscribePresence = () => {};
let unsubscribeLosses = () => {};

const scoreboardTableBody = document.getElementById('scoreboard-table')?.querySelector('tbody');

/**
 * Calculates the total paint percentage for a player.
 * @param {object} paintedData - The player's paintedData object.
 * @returns {number} - The total percentage, capped at the loss threshold.
 */
function calculatePaintPercentage(paintedData = {}) {
    let totalPercentage = 0;
    Object.values(paintedData).forEach(percentage => {
        totalPercentage += percentage;
    });
    // Cap percentage at the loss threshold for display
    return Math.min(totalPercentage, config.lossThreshold || 100);
}

/**
 * Aggregates loss records into counts per username.
 * @param {Array<object>} lossRecords - Array of loss records from the database.
 */
function aggregateLosses(lossRecords = []) {
    const counts = {};
    lossRecords.forEach(record => {
        if (record && record.loserUsername) {
            counts[record.loserUsername] = (counts[record.loserUsername] || 0) + 1;
        }
    });
    lossCounts = counts;
}

/**
 * Updates the scoreboard DOM with the latest player data.
 */
function updateScoreboard() {
    if (!scoreboardRoom || !scoreboardTableBody) return; // Ensure dependencies are ready

    const peers = scoreboardRoom.peers || {};
    const presence = scoreboardRoom.presence || {};
    const localClientId = scoreboardRoom.clientId;

    // Create an array of player data for sorting/rendering
    const playersData = Object.entries(peers).map(([clientId, peer]) => {
        const playerPresence = presence[clientId] || {};
        const paintPercentage = calculatePaintPercentage(playerPresence.paintedData);
        const losses = lossCounts[peer.username] || 0;
        const isLost = playerPresence.lost || false;
        const score = playerPresence.score || 0; // Get player score from presence

        return {
            username: peer.username,
            avatarUrl: peer.avatarUrl,
            paintPercentage: paintPercentage,
            losses: losses,
            isLost: isLost,
            score: score, // Include score in player data
            clientId: clientId // Keep client ID if needed for sorting tie-breakers etc.
        };
    });

    // Update sort order: primary sort by score descending, then losses, then paint%
    playersData.sort((a, b) => {
        // Primary sort: Score descending
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        // Secondary sort: Losses descending
        if (b.losses !== a.losses) {
            return b.losses - a.losses;
        }
        // Tertiary sort: Paint Percentage ascending (lower is better)
        if (a.paintPercentage !== b.paintPercentage) {
            return a.paintPercentage - b.paintPercentage;
        }
        // Final sort: Username ascending for stability
        return a.username.localeCompare(b.username);
    });

    // Clear previous scoreboard content
    scoreboardTableBody.innerHTML = '';

    // Populate the table
    playersData.forEach(player => {
        const row = scoreboardTableBody.insertRow();
        row.style.opacity = player.isLost ? 0.5 : 1; // Dim lost players
        if (player.clientId === localClientId) {
             row.classList.add('local-player'); // Add class for CSS styling
        }

        const nameCell = row.insertCell();
        // Add avatar image and username in the name cell
        const avatarHtml = player.avatarUrl ? 
            `<img src="${player.avatarUrl}" alt="${player.username}" class="player-avatar">` : '';
        nameCell.innerHTML = `${avatarHtml}<span>${player.username}</span>`;
        nameCell.classList.add('player-name');

        const scoreCell = row.insertCell();
        scoreCell.textContent = player.score;
        scoreCell.classList.add('player-score');

        const paintCell = row.insertCell();
        paintCell.textContent = `${player.paintPercentage.toFixed(0)}%`;
        paintCell.classList.add('paint-percentage');

        const lossCell = row.insertCell();
        lossCell.textContent = player.losses;
        lossCell.classList.add('loss-count');
    });
}

/**
 * Initializes the scoreboard system.
 * Subscribes to necessary data sources and sets up initial rendering.
 * @param {object} room - The WebsimSocket room instance.
 */
export function initScoreboard(room) {
    if (!room) {
        console.error("Scoreboard initialization requires a valid room instance.");
        return;
    }
    if (!scoreboardTableBody) {
        console.error("Scoreboard table body element not found!");
        return;
    }
    scoreboardRoom = room;

    console.log("Initializing scoreboard...");

    // Subscribe to presence changes (covers player joins/leaves and presence updates like paintedData/lost)
    unsubscribePresence = room.subscribePresence(() => {
        // Presence object is automatically updated, just trigger a scoreboard update
        updateScoreboard();
    });

    // Subscribe to loss records
    // Use a versioned collection name if schema might change
    unsubscribeLosses = room.collection('loss_v1').subscribe((lossRecords) => {
        aggregateLosses(lossRecords);
        updateScoreboard(); // Update scoreboard when losses change
    });

    // Initial data fetch and render
    // Get initial losses (getList might return empty while loading initially, subscribe handles updates)
    aggregateLosses(room.collection('loss_v1').getList());
    updateScoreboard(); // Initial render based on current peers/presence/losses
}

/**
 * Cleans up scoreboard subscriptions when no longer needed.
 * (Not currently called, but good practice for more complex scenarios)
 */
export function cleanupScoreboard() {
    console.log("Cleaning up scoreboard subscriptions...");
    unsubscribePresence();
    unsubscribeLosses();
    scoreboardRoom = null;
    lossCounts = {};
}