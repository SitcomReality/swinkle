// Configuration values for the project
// Use this file to store values that might need tweaking,
// like animation speeds, colors, or API endpoints.

export default {
    // Player settings
    defaultPlayerColor: '#FFFFFF', // Default color if presence doesn't specify
    cursorSize: 8, // Radius of the player anchor point
    nameColor: '#DDDDDD', // Color for player names
    nameFont: '12px "Lucida Console", Monaco, monospace', // Font for player names
    playerBodyRadius: 15, // Size of the player's body circle
    playerBodyColor: '#FFAABB', // Color for the player body
    playerBodyStrokeColor: '#FF88AA', // Color for the player body stroke

    // Bungee Physics settings
    bungeeRestLength: 30,        // The natural length of the bungee cord
    bungeeSpringConstant: 0.2,  // How stiff the spring is (k in F=-kx)
    bungeeDampingFactor: 0.9,   // How much velocity is reduced each frame (0-1)
    gravityAcceleration: 150,    // Pixels per second squared downwards
    playerBodyMass: 1,          // Mass affects how forces influence acceleration (F=ma)
    bungeeCordColor: 'rgba(255, 255, 255, 0.5)', // Color of the bungee line
    bungeeCordWidth: 2,         // Width of the bungee line

    // Squirt settings
    squirtColor: '#00FFFF', // Neon cyan color for squirts
    squirtSize: 4,       // Radius of the squirt particle
    squirtDuration: 500, // How long squirts last in milliseconds
};