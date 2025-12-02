// Game configuration
const GameConfig = {
    // Stake options in pence
    STAKES: [5, 10, 25, 50, 100, 200], // 5p, 10p, 25p, 50p, £1, £2
    
    // Cash value multiplier range during running phase
    MIN_MULTIPLIER: 0,
    MAX_MULTIPLIER: 500,
    
    // Running phase settings
    RUNNING_SPEED: 100, // pixels per second
    MULTIPLIER_INCREASE_RATE: 1.5, // multiplier increase per second (increased for visibility)
    
    // Decision intervals (in seconds of running)
    DECISION_INTERVALS: [3, 6, 9, 12, 15], // intervals at 3s, 6s, 9s, etc.
    
    // Crash probability
    CRASH_CHANCE_PER_SECOND: 0.15, // 15% chance per second per player
    
    // Shooting phase
    SHOOTING_MULTIPLIER_RATE: 1.0, // multiplier increase per second during shot
    BALL_SPEED: 300, // pixels per second
    
    // Goal scoring probabilities
    GOAL_HIT_CHANCE: 0.8, // 80% chance to hit target
    GOALKEEPER_SAVE_CHANCE: 0.4, // 40% chance keeper saves if on target
    
    // Visual settings
    PITCH_COLOR: 0x2d8f3d,
    LINE_COLOR: 0xffffff,
    PLAYER_COLORS: [0x2196F3, 0x2196F3, 0x2196F3, 0x2196F3], // All same blue color
    
    // Player names
    PLAYER_NAMES: ['Footballer 1', 'Footballer 2', 'Footballer 3', 'Footballer 4']
};
