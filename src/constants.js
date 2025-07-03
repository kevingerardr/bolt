// Game constants
export const GRAVITY = 0.3;
export const WIND_STRENGTH = 0.02;
export const MAX_POWER = 60;
export const ARROW_SPEED_MULTIPLIER = 0.15;
export const JOINT_STIFFNESS = 0.98; // Increased even more for maximum stiffness
export const JOINT_DAMPING = 0.99; // Increased for maximum stiffness
export const GROUND_Y = 330;

export const ARROW_TYPES = {
    REGULAR: 'regular',
    FIRE: 'fire',
    HEAVY: 'heavy',
    SPLIT: 'split',
    FIREWORK: 'firework'
};

export const DAMAGE_VALUES = {
    [ARROW_TYPES.REGULAR]: 30,
    [ARROW_TYPES.FIRE]: 35,
    [ARROW_TYPES.HEAVY]: 50,
    [ARROW_TYPES.SPLIT]: 25,
    [ARROW_TYPES.FIREWORK]: 40
};

export const INITIAL_ARROW_COUNTS = {
    [ARROW_TYPES.FIRE]: 10,
    [ARROW_TYPES.HEAVY]: 5,
    [ARROW_TYPES.SPLIT]: 3,
    [ARROW_TYPES.FIREWORK]: 2
};