/**
 * level-namer.js
 * Generates creative names for procedurally generated levels using prefix/generic/suffix combinations
 */
 
const wordPrefix = [
    "Blissful", "Hollow", "Toxic", "Silent", "Electric", 
    "Neon", "Cyber", "Forgotten", "Chaotic", "Frozen",
    "Glowing", "Pixel", "Digital", "Abandoned", "Ruined",
    "Blazing", "Crimson", "Void", "Laser", "Plasma"
];

const wordGeneric = [
    "Hurricane", "Tenacity", "Requiem", "Romance", "Stadium",
    "Factory", "Asylum", "Sanctuary", "Circuit", "Vortex",
    "Machine", "Dimension", "Core", "Outpost", "Terminus",
    "Citadel", "Fortress", "Relic", "Monument", "Pinnacle"
];

const wordSuffix = [
    "Arena", "Cacophony", "of Doom", "Bay", "of Shadows",
    "of Ruin", "Coliseum", "Battleground", "Showdown", "of Chaos",
    "of Fury", "of Fate", "of Legends", "Gardens", "Laboratory",
    "Caverns", "Shrine", "Nexus", "Crash Site", "Warzone"
];

/**
 * Generates a creative level name based on random word combinations
 * @returns {string} The generated level name
 */
export function generateLevelName() {
    // Randomly choose a naming pattern
    const pattern = Math.floor(Math.random() * 4);
    
    switch(pattern) {
        case 0: // prefix + generic + suffix
            return `${randomFrom(wordPrefix)} ${randomFrom(wordGeneric)} ${randomFrom(wordSuffix)}`;
        case 1: // prefix + generic
            return `${randomFrom(wordPrefix)} ${randomFrom(wordGeneric)}`;
        case 2: // prefix + suffix
            return `${randomFrom(wordPrefix)} ${randomFrom(wordSuffix)}`;
        case 3: // generic + suffix
            return `${randomFrom(wordGeneric)} ${randomFrom(wordSuffix)}`;
        default: // fallback to just generic
            return randomFrom(wordGeneric);
    }
}

// Helper function to get a random element from an array
function randomFrom(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Test the name generator by outputting 10 sample names
// console.log("Sample level names:");
// for (let i = 0; i < 10; i++) {
//     console.log(generateLevelName());
// }
