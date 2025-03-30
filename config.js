// Configuration values for the project
// Use this file to store values that might need tweaking,
// like animation speeds, colors, or API endpoints.

export default {
    // Player settings
    defaultPlayerColor: '#FFFFFF', // Default color if presence doesn't specify
    cursorSize: 8, // Radius of the player anchor point
    nameColor: '#DDDDDD', // Color for player names
    nameFont: '12px "Lucida Console", Monaco, monospace', // Font for player names
    playerBodyWidth: 20,  // Width of the character body capsule
    playerBodyHeight: 30, // Height of the character body capsule
    playerEyeRadius: 4,   // Radius of the character's eyes
    playerEyeOffsetX: 6,  // Horizontal offset of eyes from center
    playerEyeOffsetY: -3, // Vertical offset of eyes from body center
    playerBodyColor: '#FFAABB', // Color for the player body
    playerBodyStrokeColor: '#FF88AA', // Color for the player body stroke

    // Bungee Physics settings - TUNED VALUES
    bungeeRestLength: 50,        // Increased natural length slightly
    bungeeSpringConstant: 8,    // Increased stiffness significantly (k in F=-kx)
    bungeeDampingFactor: 0.92,  // Slightly increased damping to prevent excessive oscillation
    gravityAcceleration: 1200,   // Increased gravity force (counteracted by stiffer spring)
    playerBodyMass: 1,          // Mass affects how forces influence acceleration (F=ma)
    bungeeCordColor: 'rgba(255, 255, 255, 0.5)', // Color of the bungee line
    bungeeCordWidth: 2,         // Width of the bungee line

    // Squirt settings
    squirtColor: '#00FFFF', // Neon cyan color for squirts
    squirtSize: 4,       // Radius of the squirt particle
    squirtDuration: 500, // How long squirts last in milliseconds
};