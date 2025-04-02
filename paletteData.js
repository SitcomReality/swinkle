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
        // Cyberpunk Classic: Magenta + Cyan -> Purple/Blue mixes
        paint1: '#FF00FF', // Magenta
        paint2: '#00FFFF', // Cyan
        backgroundBase: '#0a0a1e'  // Dark Blue/Indigo
    },
    {
        // Synthwave Sunset: Hot Pink + Electric Yellow -> Orange/Red mixes
        paint1: '#FF00AA', // Hot Pink
        paint2: '#FFFF00', // Electric Yellow
        backgroundBase: '#1a0a1a'  // Deep Purple
    },
    {
        // Toxic Neon: Lime Green + Cyan -> Teal/Blue-Green mixes
        paint1: '#00FF00', // Lime Green
        paint2: '#00FFFF', // Cyan
        backgroundBase: '#0a1a0e'  // Dark Green/Teal
    },
    {
        // Electric Blue: Bright Blue + Hot Pink -> Purple mixes
        paint1: '#0088FF', // Bright Blue
        paint2: '#FF00AA', // Hot Pink
        backgroundBase: '#101018'  // Dark Gray-Blue
    },
    {
        // Laser Grid: Bright Red + Electric Yellow -> Orange mixes (Use red carefully)
        paint1: '#FF0000', // Bright Red
        paint2: '#FFFF00', // Electric Yellow
        backgroundBase: '#1a0a0a' // Very Dark Red/Brown
    },
    {
         // Purple Haze: Deep Purple + Lime Green -> Muted Green/Yellow mixes
         paint1: '#9D00FF', // Deep Purple
         paint2: '#00FF00', // Lime Green
         backgroundBase: '#100a18' // Dark Purple/Indigo
    },
    {
         // Emerald Grid: Emerald Green + Pale Yellow -> Light Green mixes
         paint1: '#00FF7F', // Emerald Green (SpringGreen)
         paint2: '#FFFFA0', // Pale Yellow (LightYellow)
         backgroundBase: '#081410' // Dark Charcoal/Green
    },
    {
        // Golden Glitch: Gold + Light Blue -> Greenish mixes
        paint1: '#FFD700', // Gold
        paint2: '#87CEEB', // Light Blue (SkyBlue)
        backgroundBase: '#101020' // Dark Navy/Gray
    },
    {
        // Violet Volt: Deep Violet + Cyan -> Blue/Purple mixes
        paint1: '#8A2BE2', // Deep Violet (BlueViolet)
        paint2: '#00FFFF', // Cyan
        backgroundBase: '#100814' // Dark Violet/Gray
    },
    {
        // Coral Reef: Coral + Turquoise -> Pale Green/Blue mixes
        paint1: '#FF7F50', // Coral
        paint2: '#40E0D0', // Turquoise
        backgroundBase: '#101818' // Dark Teal/Gray
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