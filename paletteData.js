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
        id: 'cyberpunk_neon',
        paint1: '#FF00FF', // Magenta
        paint2: '#00FFFF', // Cyan
        backgroundBase: '#0a0a1e'  // Dark Blue/Indigo
    },
    {
        // Sunset Synthwave: Orange + Pink paint, Deep Purple background
        id: 'sunset_synthwave',
        paint1: '#FF6600', // Orange
        paint2: '#FF00AA', // Hot Pink
        backgroundBase: '#1a0a1a'  // Deep Purple
    },
    {
        // Toxic Waste: Lime Green + Yellow paint, Dark Teal background
        id: 'toxic_waste',
        paint1: '#39FF14', // Neon Lime Green
        paint2: '#FFFF00', // Yellow
        backgroundBase: '#0a1a0e'  // Dark Green/Teal
    },
    {
        // Electric Blue: Bright Blue + Yellow paint, Dark Gray background
        id: 'electric_blue',
        paint1: '#0088FF', // Bright Blue
        paint2: '#FFF000', // Bright Yellow
        backgroundBase: '#18181c'  // Dark Gray
    },
    {
        // Crimson Laser: Red + Cyan paint, Dark Red/Brown background
        id: 'crimson_laser',
        paint1: '#FF0000', // Red
        paint2: '#00FFFF', // Cyan
        backgroundBase: '#1a0a0a' // Dark Red/Brown
    },
    {
         // Purple Haze: Purple + Orange paint, Dark Blue background
         id: 'purple_haze',
         paint1: '#9D00FF', // Purple
         paint2: '#FF8800', // Orange
         backgroundBase: '#0a0f1e' // Dark Blue
    },
    {
         // Mint Chip: Mint Green + Hot Pink paint, Dark Gray-Green background
         id: 'mint_chip',
         paint1: '#66FFBB', // Mint Green
         paint2: '#FF44AA', // Hot Pink
        backgroundBase: '#101a14' // Dark Gray-Green
    },
    {
        // Golden Sun: Yellow + Orange paint, Very Dark Blue background
        id: 'golden_sun',
        paint1: '#FFFF00', // Yellow
        paint2: '#FFA500', // Orange
        backgroundBase: '#050515' // Very Dark Blue
    },
    {
        // Arctic Light: Cyan + White paint, Dark Blue-Gray background
        id: 'arctic_light',
        paint1: '#00FFFF', // Cyan
        paint2: '#F0F0F0', // Bright White/Gray
        backgroundBase: '#151820' // Dark Blue-Gray
    },
    {
        // Pink Flamingo: Hot Pink + Light Blue paint, Dark Purple background
        id: 'pink_flamingo',
        paint1: '#FF69B4', // Hot Pink
        paint2: '#ADD8E6', // Light Blue
        backgroundBase: '#180818' // Dark Purple
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
        return { id: 'fallback', paint1: '#FF00FF', paint2: '#00FFFF', backgroundBase: '#0a0a1e' };
    }
    const effectiveIndex = Math.abs(index) % palettes.length; // Ensure index is valid
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