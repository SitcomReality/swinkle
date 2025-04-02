/**
 * scoreboard-init.js
 * Handles initialization of scoreboard with persistent scores
 */
import { initScoreboard } from './scoreboard.js';
import { loadPlayerScore, updatePlayerScore } from './score-persistence.js';

/**
 * Initializes the scoreboard with persistent scores.
 * @param {object} room - The WebsimSocket room instance
 */
export async function initScoreboardWithPersistence(room) {
    if (!room) {
        console.error("Scoreboard initialization requires a valid room instance.");
        return;
    }

    // Initialize the regular scoreboard
    initScoreboard(room);

    // Load persistent score for the current player
    if (room.clientId && room.peers[room.clientId]) {
        const username = room.peers[room.clientId].username;
        if (username) {
            // Pass the room instance to loadPlayerScore
            const savedScore = await loadPlayerScore(room, username);

            // If player has a score in the database and doesn't have one in presence yet
            if (savedScore > 0 && (!room.presence[room.clientId] || !room.presence[room.clientId].score)) {
                // Update presence with saved score
                room.updatePresence({
                    score: savedScore
                });
                console.log(`Loaded saved score of ${savedScore} for ${username}`);
            }
        }
    }

    // Subscribe to presence changes to save score updates
    room.subscribePresence((presence) => {
        const localClientId = room.clientId;
        const localPresence = presence[localClientId];

        if (localPresence && typeof localPresence.score === 'number' && room.peers[localClientId]) {
            const username = room.peers[localClientId].username;
            if (username) {
                // Pass the room instance to updatePlayerScore
                updatePlayerScore(room, username, localPresence.score);
            }
        }
    });
}