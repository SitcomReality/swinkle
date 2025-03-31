/**
 * colorUtils.js
 * Utility functions for color manipulation.
 */

/**
 * Converts a hex color string to an RGB object.
 * Handles 3-digit (#RGB) and 6-digit (#RRGGBB) formats.
 * @param {string} hex - The hex color string (e.g., "#FFF", "#FF88AA").
 * @returns {{r: number, g: number, b: number} | null} RGB object or null if invalid.
 */
export function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return null;
    let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Blends colors based on percentages.
 * @param {string} baseHex - The base color hex string.
 * @param {object} paintedData - Object mapping paint hex colors to percentages (e.g., {'#FF0000': 10}).
 * @returns {string} The resulting CSS color string (e.g., "rgb(r,g,b)").
 */
export function calculateBlendedColor(baseHex, paintedData = {}) {
    const baseRgb = hexToRgb(baseHex);
    if (!baseRgb) return baseHex; // Return base if invalid

    let totalPaintPercent = 0;
    const paintRgbs = [];

    for (const [colorHex, percent] of Object.entries(paintedData)) {
        const paintRgb = hexToRgb(colorHex);
        if (paintRgb && percent > 0) {
            const clampedPercent = Math.max(0, percent); // Ensure percent is non-negative
            paintRgbs.push({ ...paintRgb, percent: clampedPercent });
            totalPaintPercent += clampedPercent;
        }
    }

    // Clamp total paint percentage to a maximum of 100
    totalPaintPercent = Math.min(100, totalPaintPercent);
    const basePercent = 100 - totalPaintPercent;

    let finalR = baseRgb.r * basePercent;
    let finalG = baseRgb.g * basePercent;
    let finalB = baseRgb.b * basePercent;

    let accumulatedPaintPercent = 0; // Track how much paint percentage has been added

    for (const paint of paintRgbs) {
        // Calculate how much of this paint's percentage can actually be applied
        const remainingCapacity = totalPaintPercent - accumulatedPaintPercent;
        const effectivePercent = Math.min(paint.percent, remainingCapacity);

        if (effectivePercent > 0) {
            finalR += paint.r * effectivePercent;
            finalG += paint.g * effectivePercent;
            finalB += paint.b * effectivePercent;
            accumulatedPaintPercent += effectivePercent; // Update accumulated percentage
        }
    }


    // Average the colors by dividing by the total percentage (should be 100, unless base was invalid)
    const divisor = basePercent + accumulatedPaintPercent; // More robust divisor
    if (divisor > 0) {
        finalR = Math.round(finalR / divisor);
        finalG = Math.round(finalG / divisor);
        finalB = Math.round(finalB / divisor);
    } else { // Handle edge case where divisor is 0 (e.g. invalid base color, no paint)
         finalR = baseRgb.r;
         finalG = baseRgb.g;
         finalB = baseRgb.b;
    }


    // Clamp final values to 0-255
    finalR = Math.max(0, Math.min(255, finalR));
    finalG = Math.max(0, Math.min(255, finalG));
    finalB = Math.max(0, Math.min(255, finalB));

    return `rgb(${finalR}, ${finalG}, ${finalB})`;
}