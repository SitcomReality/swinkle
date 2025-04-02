export default {
    // World boundaries
    gameAreaWidth: 1200,        // Fixed width of the playable area
    gameAreaHeight: 900,       // Fixed height of the playable area

    defaultPlayerColor: '#FFFFFF', // Default color if presence doesn't specify
    cursorSize: 8, // Radius of the player anchor point
    nameColor: '#DDDDDD', // Color for player names
    nameFont: '12px "Lucida Console", Monaco, monospace', // Font for player names
    playerBodyWidth: 20,  // Width of the character body capsule
    playerBodyHeight: 30, // Height of the character body capsule
    playerEyeRadius: 6,   // Radius of the character's eyes
    playerEyeOffsetX: 6,  // Horizontal offset of eyes from center
    playerEyeOffsetY: -3, // Vertical offset of eyes from body center
    playerBodyColor: '#777777', // Base color for the player body (darker gray, was #AAAAAA)
    playerBodyStrokeColor: '#555555', // Base color for the player body stroke (darker gray, was #888888)

    // Bungee Physics settings (Player -> Cursor)
    bungeeRestLength: 4,        // Natural length of the player's bungee cord
    bungeeSpringConstant: 9,     // Stiffness of the player's bungee cord
    bungeeDampingFactor: 0.98,   // Damping factor for player's bungee (Less damping = more swing)
    gravityAcceleration: 1200,   // Force of gravity pulling the player body down
    playerBodyMass: 0.8,         // Mass affects how forces influence player acceleration
    bungeeCordColor: 'rgba(255, 255, 255, 0.5)', // Color of the player's bungee line
    bungeeCordWidth: 2,         // Width of the player's bungee line
    bungeeMaxLengthMultiplier: 60, // Max stretch factor for player bungee relative to rest length

    // Limb Physics & Appearance Settings
    numberOfLimbs: 2,            // How many limbs the character has
    limbLength: 20,             // Natural resting length of a limb segment
    limbWidth: 3,               // Thickness of the limb line
    limbColor: 'rgba(204, 204, 204, 0.8)', // Light gray, slightly transparent for limbs
    limbSpringConstant: 10,      // Stiffness of the limb's connection
    limbDampingFactor: 0.85,     // How quickly limb oscillations fade
    limbMass: 0.1,               // Mass of the limb (affects gravity/spring)
    limbGravityFactor: 0.5,      // How much gravity affects limbs (0=none, 1=full)
    limbMaxLengthMultiplier: 1.5,// Maximum stretch factor for limbs

    // Player Body Rotation Physics
    playerRotationalInertia: 1.2, // Resistance to angular acceleration (Increased from 0.5 to slow down rotation)
    playerUprightingStrength: 10, // Torque strength pulling player upright (Decreased from 10)
    playerRotationalDamping: 20.0, // Damping torque coefficient (Increased from 5.0 to dampen faster)
    playerBungeeTorqueFactor: 0.2, // Multiplier for torque applied by the main bungee (1.0 = normal)

    // Droplet settings (Formerly Squirt)
    dropletColor: '#00FFFF', // Default color for droplets if not from a can
    dropletSize: 3,       // Radius of the droplet particle
    dropletDuration: 2000, // How long droplets last in milliseconds before fading
    burstSpreadRadius: 30, // How far droplets spread when bursting from charge (Increased from 15)

    // Paint Can settings
    paintCanWidth: 18,      // Visual width
    paintCanHeight: 25,     // Visual height
    paintCanInitialAmount: 100, // Starting paint amount in a new can
    paintCanStrokeColor: '#AAAAAA',
    paintCanStrokeWidth: 1,
    paintCanChargeIndicatorHeight: 6, // Height of the charge bar
    paintCanChargeIndicatorWidth: 20, // Width of the charge bar background
    paintCanChargeIndicatorColor: '#FFFFFF', // Color of the charge bar fill
    initialAvailableCans: 2, // Number of cans to spawn initially
    maxAvailableCans: 3,    // Max number of available cans allowed on map

    // Paint Can Bungee Physics (Player Capsule -> Paint Can)
    paintCanBungeeRestLength: 20, // Let it dangle a bit further
    paintCanBungeeSpringConstant: 6, // Less stiff than player bungee
    paintCanBungeeDampingFactor: 0.95, // More damped, less wild swinging
    paintCanMass: 0.4, // Heavier than limbs, lighter than player
    paintCanGravityFactor: 1.0, // Affected by full gravity
    paintCanBungeeMaxLengthMultiplier: 10, // Max stretch factor
    paintCanBungeeColor: 'rgba(180, 180, 180, 0.6)',
    paintCanBungeeWidth: 1.5,

    // Paint Can Interaction settings
    paintCanChargingSpeed: 50, // Paint units accumulated per second while holding click
    paintCanMaxAccumulatedDroplets: 20, // Max droplets in a single burst charge
    paintCanAutoDropRate: 4, // Droplets per second when not charging (1000ms / 250ms)
    paintCanPickupDistance: 30, // Radius for player capsule to collide with available can center

    // Collision & Loss settings
    paintIncrementPerDroplet: 2, // How much % paint increases per droplet hit
    lossThreshold: 100, // Percentage of paint at which a player loses
    lossMessageColor: '#FFFFFF', // Color of the "painted out" message
    lossMessageFont: '24px "Lucida Console", Monaco, monospace', // Font for loss message
    respawnDelay: 5000, // Time in milliseconds before a player respawns after losing

    // Visual Effects settings
    splatEffectDuration: 500,   // Duration of splat effect in ms
    splatEffectMaxRadius: 15,   // Max radius of splat effect
    stealSparkEffectDuration: 300, // Duration of the steal spark effect
    stealSparkColor: '#FFFF00', // Color of the steal spark
    stealSparkRadius: 20,      // Max radius of the steal spark
    blockSparkEffectDuration: 250, // Duration of the shield block effect
    blockSparkColor: '#FFFFFF', // Color of the block spark
    blockSparkRadius: 15,       // Max radius of the block spark

    // Paint Out Burst Effect settings
    paintOutBurstParticles: 120, // Number of droplets to create when painted out (Increased from 60)
    paintOutBurstSpeed: 300,    // Maximum initial speed for paint burst particles
    paintOutBurstRadius: 200,   // Maximum distance particles can travel

    // Theme & Glow Settings
    neonGlowBlur: 10,           // Intensity of the glow effect for neon elements
    anchorPointGlowColor: 'rgba(255, 255, 255, 0.7)', // Glow color for the anchor point
    paintCanBandGlow: true,     // Whether the paint can color band should glow
    dropletGlow: true,           // Whether droplets should glow

    // Power-up settings
    maxActivePowerUps: 3,         // Maximum number of power-ups active in the world
    powerUpCollectDistance: 30,   // Distance to collect a power-up
    powerUpDuration: 8000,       // Default duration for power-ups (10 seconds)
    powerUpSpawnInterval: 5000,  // Average time between power-up spawns (20 seconds)

    // Power-up effect parameters
    shieldEffectiveness: 100,     // Percentage of paint blocked by shield (Currently binary: block or not block)
    springyBungeeMultiplier: 1.8, // How much springier the bungee gets
    megaCanCapacityMultiplier: 2, // How much larger mega cans are
    megaCanVisualSizeMultiplier: 1.5, // How much bigger mega cans look
    megaCanIndicatorColor: '#FFFF00', // Color for the mega can indicator (e.g., star)
    shortRopeMultiplier: 0.5,     // Bungee length multiplier for short rope (e.g., 0.2 = 20% of normal)
    shortRopeDuration: 7000,      // Duration of short rope effect in milliseconds (matches power-up-data.js)
    bigBurstDropletMultiplier: 2.5, // Multiplier for the number of droplets in a big burst (e.g., 2.5x)
    bigBurstRangeMultiplier: 1.5,  // Multiplier for the spread radius of a big burst (e.g., 1.5x)
    bigBurstDuration: 10000,      // Duration of big burst readiness in ms (matches power-up-data.js)
    powerUpItemLifetime: 15000,    // Time in ms before a power-up item despawns if not collected

    // Level Settings
    levelCycleTime: 60000, // Time in milliseconds between level changes (90 seconds)

    // Spectator Mode Settings
    spectatorAnchorMarginY: 10,   // Y position of the anchor point from the top edge
    spectatorMaxSpeed: 180,       // Maximum horizontal speed of the anchor point
    spectatorForceMagnitude: 3000,// Magnitude of the random force applied
    spectatorDampingFactor: 0.98, // Damping factor for horizontal movement
    idleThreshold: 20000,       // Time in milliseconds before entering spectate mode (20 seconds)
    idleMoveThresholdSq: 25,    // Squared pixel distance threshold to consider movement significant (5*5)
};