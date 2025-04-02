/**
 * paletteData.js
 * Defines predefined color palettes for levels.
 * Each palette has:
 * - paint1: First neon paint color (hex)
 * - paint2: Second neon paint color (hex) - chosen to mix well with paint1
 * - backgroundBase: Base color for background and geometry (hex) - darker, complementary/analogous
 */

// Replaces old palettes with carefully curated neon/cyberpunk-focused options
export const palettes = [
  {
    paint1: '#00FFF7', // Aqua Neon
    paint2: '#FF00EA', // Hot Pink Neon
    backgroundBase: '#050510'  // Deep navy
  },
  {
    paint1: '#39FF14', // Neon Lime
    paint2: '#FF3131', // Neon Red
    backgroundBase: '#0A0A0A'  // Pure dark
  },
  {
    paint1: '#FFFF00', // Vivid Yellow
    paint2: '#00BFFF', // Vivid Blue
    backgroundBase: '#0D1021'  // Bluish-black
  },
  {
    paint1: '#FF66CC', // Cotton Candy
    paint2: '#33FFCC', // Turquoise Neon
    backgroundBase: '#140022'  // Deep purple-black
  },
  {
    paint1: '#F72585', // Fuchsia
    paint2: '#7209B7', // Purple Neon
    backgroundBase: '#0A0015'  // Ink black
  },
  {
    paint1: '#00FFFF', // Cyan
    paint2: '#FF9900', // Neon Orange
    backgroundBase: '#081018'  // Dark steel blue
  },
  {
    paint1: '#FF4F4F', // Neon Coral
    paint2: '#8D00FF', // Electric Purple
    backgroundBase: '#0A0A0D'  // True dark grey
  },
  {
    paint1: '#FFFB00', // Flash Yellow
    paint2: '#00FF9F', // Mint Electric
    backgroundBase: '#121212'  // Deep grey
  },
  {
    paint1: '#FF1493', // Deep Pink
    paint2: '#00CED1', // Dark Turquoise
    backgroundBase: '#0C001F'  // Black violet
  }
];

// Gets a palette based on index
export function getPaletteByIndex(index) {
  if (!palettes.length) return { paint1: '#FF00FF', paint2: '#00FFFF', backgroundBase: '#0a0a1e' };
  return palettes[index % palettes.length];
}

// Gets a random palette
export function getRandomPalette() {
  const i = Math.floor(Math.random() * palettes.length);
  return palettes[i];
}