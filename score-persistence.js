/**
 * score-persistence.js
 * Handles persistence of player scores in the database
 */

/**
 * Loads the player's score from the database or creates a new entry if none exists.
 * @param {string} username - The player's username
 * @returns {Promise<number>} The player's score
 */
export async function loadPlayerScore(username) {
    if (!username) return 0;
    
    try {
        // Find existing score record for this player
        const scoreRecords = await room.collection('player_score').filter({ username: username }).getList();
        
        if (scoreRecords && scoreRecords.length > 0) {
            // Return existing score
            return scoreRecords[0].score || 0;
        } else {
            // Create new score record with initial score of 0
            await room.collection('player_score').create({
                username: username,
                score: 0
            });
            return 0;
        }
    } catch (error) {
        console.error("Error loading player score:", error);
        return 0;
    }
}

/**
 * Updates the player's score in the database.
 * @param {string} username - The player's username
 * @param {number} score - The new score value
 */
export async function updatePlayerScore(username, score) {
    if (!username) return;
    
    try {
        // Find existing score record for this player
        const scoreRecords = await room.collection('player_score').filter({ username: username }).getList();
        
        if (scoreRecords && scoreRecords.length > 0) {
            // Update existing record
            await room.collection('player_score').update(scoreRecords[0].id, {
                score: score
            });
        } else {
            // Create new score record
            await room.collection('player_score').create({
                username: username,
                score: score
            });
        }
    } catch (error) {
        console.error("Error updating player score:", error);
    }
}