/**
 * paletteData.js
 * Defines predefined color palettes for levels.
 * Each palette has:
 * - paint1: First neon paint color (hex)
 * - paint2: Second neon paint color (hex) - chosen to mix well with paint1
 * - backgroundBase: Base color for background and geometry (hex) - darker, complementary/analogous
 */

export const palettes = [
    { // Cyberpunk Classic: Magenta + Cyan, Dark Blue/Indigo BG
        paint1: '#FF00FF', // Magenta
        paint2: '#00FFFF', // Cyan
        backgroundBase: '#0a0a1e'  // Dark Blue/Indigo
    },
    { // Toxic Glow: Lime + Electric Blue, Dark Teal BG
        paint1: '#39FF14', // Lime Green
        paint2: '#0FF0FF', // Electric Blue
        backgroundBase: '#051a1a'  // Dark Teal
    },
    { // Violet Void: Deep Purple + Hot Pink, Dark Purple/Gray BG
        paint1: '#9D00FF', // Deep Purple
        paint2: '#FF10F0', // Hot Pink
        backgroundBase: '#150a15'  // Dark Purple/Gray
    },
    { // Glitch City: Bright Blue + White, Dark Gray BG
        paint1: '#0088FF', // Bright Blue
        paint2: '#FFFFFF', // White
        backgroundBase: '#18181c'  // Dark Gray
    },
    { // Plasma Pulse: Cyan + Lime Green, Dark Blue-Green BG
        paint1: '#00FFFF', // Cyan
        paint2: '#39FF14', // Lime Green
        backgroundBase: '#0a1a14' // Dark Blue-Green
    },
    { // Synthwave Dream: Hot Pink + Light Blue, Deep Indigo BG
         paint1: '#FF10F0', // Hot Pink
         paint2: '#60CFFF', // Light Blue
         backgroundBase: '#1a0a1f' // Deep Indigo
    },
    { // Data Stream: White + Cyan, Very Dark Blue BG
         paint1: '#FFFFFF', // White
         paint2: '#00FFFF', // Cyan
         backgroundBase: '#050510' // Very Dark Blue
    },
    { // Amber Grid: Yellow + Cyan, Dark Gray-Blue BG - Keeping this one, 'Amber' can be neon-ish
        paint1: '#FFD700', // Yellow (Gold-ish)
        paint2: '#00BFFF', // Deep Sky Blue
        backgroundBase: '#10151C' // Dark Gray-Blue
    },
    // --- NEW PALETTES ---
    { // Crimson Laser: Red + Cyan, Very Dark Gray BG
        paint1: '#FF0040', // Neon Red/Crimson
        paint2: '#00FFFF', // Cyan
        backgroundBase: '#0c0c0e'  // Very Dark Gray
    },
    { // Emerald Glade: Bright Green + Yellow, Dark Green BG
        paint1: '#00FF80', // Bright Emerald Green
        paint2: '#FFFF00', // Yellow
        backgroundBase: '#081408' // Dark Green
    },
    { // Orange Soda: Neon Orange + White, Dark Blue-Gray BG
        paint1: '#FFA500', // Neon Orange
        paint2: '#FFFFFF', // White
        backgroundBase: '#12101a' // Dark Blue-Gray
    },
    { // Purple Haze: Lavender + Lime Green, Deep Purple BG
        paint1: '#DA70D6', // Lavender/Orchid
        paint2: '#39FF14', // Lime Green
        backgroundBase: '#180818' // Deep Purple
    },
     { // Arctic Code: Pale Blue + White, Black BG
         paint1: '#ADD8E6', // Pale Blue
         paint2: '#FFFFFF', // White
         backgroundBase: '#050505' // Near Black
     },
     { // Golden Wire: Gold + Electric Blue, Dark Brown/Purple BG
         paint1: '#FFD700', // Gold
         paint2: '#0FF0FF', // Electric Blue
         backgroundBase: '#1a100a' // Dark Brown/Purple
     }
];

/**
 * Gets a palette based on an index (wrapping around).
 * @param {number} index - The desired index.
 * @returns {object} The selected palette.
 */
export function getPaletteByIndex(index) {
    if (palettes.length === 0) {
        // Fallback palette if none are defined
        return { paint1: '#FF00FF', paint2: '#00FFFF', backgroundBase: '#0a0a1e' };
    }
    const effectiveIndex = index % palettes.length;
    return palettes[effectiveIndex];
}

/**
 * Gets a random palette.
 * @returns {object} A randomly selected palette.
 */
export function getRandomPalette() {
     if (palettes.length === 0) {
         return getPaletteByIndex(0); // Return fallback if empty
     }
     const randomIndex = Math.floor(Math.random() * palettes.length);
     return palettes[randomIndex];
}