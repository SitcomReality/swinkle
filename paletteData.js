/**
 * paletteData.js
 * Defines predefined color palettes for levels, focusing on neon/cyberpunk themes.
 * Each palette has:
 * - paint1: First vibrant neon paint color (hex)
 * - paint2: Second vibrant neon paint color (hex) - chosen to mix well with paint1
 * - backgroundBase: Base color for background and geometry (hex) - very dark, complementary/analogous
 */

// Overhauled palettes with more distinct neon combinations
export const palettes = [
    // --- Classic Cyberpunk ---
    {
        name: "Cyberpunk Classic",
        paint1: '#FF00FF', // Magenta
        paint2: '#00FFFF', // Cyan
        backgroundBase: '#0a0a1e'  // Very Dark Blue/Indigo
    },
    {
        name: "Glitch City",
        paint1: '#00FF00', // Lime Green
        paint2: '#0088FF', // Bright Blue
        backgroundBase: '#101015'  // Dark Gray-Purple
    },
    {
        name: "Synthwave Sunset",
        paint1: '#FF10F0', // Hot Pink
        paint2: '#FFD700', // Gold/Yellow
        backgroundBase: '#1a0a1f' // Deep Indigo/Purple
    },
    // --- High Contrast ---
    {
        name: "Data Stream",
        paint1: '#FFFFFF', // White
        paint2: '#00FF00', // Lime Green
        backgroundBase: '#050510' // Very Dark Blue/Almost Black
    },
    {
        name: "Plasma Core",
        paint1: '#FFA500', // Orange (Use carefully - make it vibrant)
        paint2: '#00FFFF', // Cyan
        backgroundBase: '#150500' // Very Dark Brown/Red
    },
    // --- Cooler Tones ---
    {
        name: "Arctic Code",
        paint1: '#60CFFF', // Light Blue
        paint2: '#FFFFFF', // White
        backgroundBase: '#081018' // Dark Cool Gray-Blue
    },
    {
        name: "Emerald Grid",
        paint1: '#39FF14', // Bright Lime
        paint2: '#0FF0FF', // Electric Blue
        backgroundBase: '#051a0a'  // Dark Emerald Green
    },
    // --- Intense & Vibrant ---
    {
        name: "Laser Grid",
        paint1: '#FF0000', // Bright Red (Use carefully)
        paint2: '#00FFFF', // Cyan
        backgroundBase: '#180505' // Very Dark Red/Brown
    },
    {
        name: "Toxic Spill",
        paint1: '#ADFF2F', // GreenYellow
        paint2: '#FF00FF', // Magenta
        backgroundBase: '#100510' // Dark Purple/Gray
    },
     {
        name: "Violet Void",
        paint1: '#9D00FF', // Deep Purple
        paint2: '#39FF14', // Lime Green
        backgroundBase: '#150a15'  // Dark Purple/Gray
    },
    {
        name: "Electric Eel",
        paint1: '#FFFF00', // Yellow
        paint2: '#0088FF', // Bright Blue
        backgroundBase: '#101005'  // Very Dark Yellow/Brown
    },
     {
        name: "Crimson Circuit",
        paint1: '#DC143C', // Crimson Red
        paint2: '#FFFFFF', // White
        backgroundBase: '#1C0A0A' // Dark Reddish-Brown
    }
];

/**
 * Gets a palette based on an index (wrapping around).
 * @param {number} index - The desired index.
 * @returns {object} The selected palette.
 */
export function getPaletteByIndex(index) {
    if (!palettes || palettes.length === 0) {
        console.warn("No palettes defined in paletteData.js. Returning fallback.");
        return { name: "Fallback", paint1: '#FF00FF', paint2: '#00FFFF', backgroundBase: '#0a0a1e' };
    }
    const effectiveIndex = Math.abs(index) % palettes.length;
    return palettes[effectiveIndex];
}

/**
 * Gets a random palette.
 * @returns {object} A randomly selected palette.
 */
export function getRandomPalette() {
     if (!palettes || palettes.length === 0) {
         return getPaletteByIndex(0); // Return fallback if empty
     }
     const randomIndex = Math.floor(Math.random() * palettes.length);
     return palettes[randomIndex];
}