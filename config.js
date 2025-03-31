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
    playerBodyColor: '#FFAABB', // Color for the player body (Now mostly covered by paint visual)
    playerBodyStrokeColor: '#FF88AA', // Base color for the player body stroke (gets blended with paint)

    // Bungee Physics settings (Player -> Cursor)
    bungeeRestLength: 20,        // Natural length of the player's bungee cord
    bungeeSpringConstant: 5,     // Stiffness of the player's bungee cord
    bungeeDampingFactor: 0.98,   // Damping factor for player's bungee (Less damping = more swing)
    gravityAcceleration: 1200,   // Force of gravity pulling the player body down
    playerBodyMass: 0.8,         // Mass affects how forces influence player acceleration
    bungeeCordColor: 'rgba(255, 255, 255, 0.5)', // Color of the player's bungee line
    bungeeCordWidth: 2,         // Width of the player's bungee line
    bungeeMaxLengthMultiplier: 30, // Max stretch factor for player bungee relative to rest length

    // Limb Physics & Appearance Settings
    numberOfLimbs: 4,            // How many limbs the character has
    limbLength: 20,             // Natural resting length of a limb segment
    limbWidth: 3,               // Thickness of the limb line
    limbColor: 'rgba(255, 170, 187, 0.8)', // Slightly transparent body color
    limbSpringConstant: 10,      // Stiffness of the limb's connection
    limbDampingFactor: 0.85,     // How quickly limb oscillations fade
    limbMass: 0.1,               // Mass of the limb (affects gravity/spring)
    limbGravityFactor: 0.5,      // How much gravity affects limbs (0=none, 1=full)
    limbMaxLengthMultiplier: 1.5,// Maximum stretch factor for limbs

    // Droplet settings (Formerly Squirt)
    dropletColor: '#00FFFF', // Default color for droplets if not from a can (e.g., initial click)
    dropletSize: 3,       // Radius of the droplet particle
    dropletDuration: 2000, // How long droplets last in milliseconds before fading

    // Paint Can settings
    paintCanColors: [ // Predefined list of possible paint colors
        '#FF00FF', // Magenta
        '#00FFFF', // Cyan
        '#FFFF00', // Yellow
        '#FF6600', // Orange
        '#00FF00', // Lime Green
        '#FF0000', // Red
        '#9D00FF', // Purple
    ],
    paintCanWidth: 15,
    paintCanHeight: 20,
    paintCanInitialAmount: 100, // Starting paint amount in a new can

    // Paint Can Bungee Physics (Player Capsule -> Paint Can)
    paintCanBungeeRestLength: 15,
    paintCanBungeeSpringConstant: 8,
    paintCanBungeeDampingFactor: 0.92,
    paintCanMass: 0.3,
    paintCanBungeeMaxLengthMultiplier: 5,

    // Paint Can Interaction settings
    paintCanChargingSpeed: 10, // Droplets accumulated per second while holding click
    paintCanMaxAccumulatedDroplets: 20, // Max droplets in a burst
};