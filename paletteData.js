/**
 * paletteData.js
 * Defines predefined color palettes for levels.
 * Each palette has:
 * - paint1: First neon paint color (hex)
 * - paint2: Second neon paint color (hex) - chosen to mix well with paint1
 * - backgroundBase: Base color for background and geometry (hex) - darker, complementary/analogous
 */

export const palettes = [
    {
        // Cyberpunk Neon: Magenta + Cyan paint, Dark Blue/Indigo background
        paint1: '#FF00FF', // Magenta
        paint2: '#00FFFF', // Cyan
        backgroundBase: '#0a0a1e'  // Dark Blue/Indigo
    },
    {
        // Sunset Synthwave: Hot Pink + Bright Orange paint, Deep Purple background
        paint1: '#FF1493', // Hot Pink (DeepPink)
        paint2: '#FFA500', // Bright Orange (Orange)
        backgroundBase: '#190019'  // Deep Purple/Indigo
    },
    {
        // Toxic Waste: Lime Green + Electric Yellow paint, Dark Teal/Green background
        paint1: '#32CD32', // Lime Green
        paint2: '#FFFF00', // Electric Yellow
        backgroundBase: '#001a0a'  // Dark Teal/Green
    },
    {
        // Electric Blue: Bright Blue + Hot Pink paint, Very Dark Gray/Blue background
        paint1: '#007FFF', // Bright Blue (Azure)
        paint2: '#FF69B4', // Hot Pink
        backgroundBase: '#050510'  // Very Dark Gray/Blue
    },
    {
        // Crimson Laser: Bright Red + Cyan paint, Darkest Red/Brown background
        paint1: '#FF0000', // Bright Red
        paint2: '#00FFFF', // Cyan
        backgroundBase: '#1a0505' // Darkest Red/Brown
    },
    {
         // Purple Haze: Deep Purple + Neon Orange paint, Dark Blue/Gray background
         paint1: '#9400D3', // Deep Purple (DarkViolet)
         paint2: '#FF4500', // Neon Orange (OrangeRed)
         backgroundBase: '#0f0a14' // Dark Blue/Gray
    },
    {
         // Mint Chip: Mint Green + Bright Pink paint, Dark Gray-Green background
         paint1: '#00FFAA', // Mint Green (Aquamarine variant)
         paint2: '#FF1493', // Bright Pink (DeepPink)
         backgroundBase: '#0a1410' // Dark Gray-Green
    },
    {
        // Golden Glitch: Gold/Yellow + Electric Blue, Dark Gray background
        paint1: '#FFD700', // Gold
        paint2: '#00BFFF', // Electric Blue (DeepSkyBlue)
        backgroundBase: '#121212' // Dark Gray
    },
    {
        // Emerald Matrix: Emerald Green + White, Dark Green background
        paint1: '#00FF7F', // Emerald Green (SpringGreen)
        paint2: '#FFFFFF', // White
        backgroundBase: '#001005' // Dark Green
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