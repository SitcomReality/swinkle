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
        // Cyberpunk Neon: Magenta + Cyan paint, Dark Blue/Purple background
        paint1: '#FF00FF', // Magenta
        paint2: '#00FFFF', // Cyan
        backgroundBase: '#0a0a1e'  // Dark Blue/Indigo
    },
    {
        // Sunset Synthwave: Orange + Pink paint, Deep Purple background
        paint1: '#FF6600', // Orange
        paint2: '#FF00AA', // Hot Pink
        backgroundBase: '#1a0a1a'  // Deep Purple
    },
    {
        // Toxic Waste: Lime Green + Yellow paint, Dark Teal background
        paint1: '#00FF00', // Lime Green
        paint2: '#FFFF00', // Yellow
        backgroundBase: '#0a1a0e'  // Dark Green/Teal
    },
    {
        // Electric Blue: Bright Blue + Yellow paint, Dark Gray background
        paint1: '#0088FF', // Bright Blue
        paint2: '#FFFF00', // Yellow
        backgroundBase: '#18181c'  // Dark Gray
    },
    {
        // Crimson Laser: Red + Cyan paint, Dark Red/Brown background
        paint1: '#FF0000', // Red
        paint2: '#00FFFF', // Cyan
        backgroundBase: '#1a0a0a' // Dark Red/Brown
    },
    {
         // Purple Haze: Purple + Orange paint, Dark Blue background
         paint1: '#9D00FF', // Purple
         paint2: '#FF8800', // Orange
         backgroundBase: '#0a0f1e' // Dark Blue
    },
    {
         // Mint Chip: Mint Green + Hot Pink paint, Dark Gray-Green background
         paint1: '#66FFBB', // Mint Green
         paint2: '#FF44AA', // Hot Pink
         backgroundBase: '#101a14' // Dark Gray-Green
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
