import { INITIAL_ARROW_COUNTS, GROUND_Y } from '../constants.js';
import { Ragdoll } from '../entities/Ragdoll.js';
import { Platform } from '../entities/Platform.js';

export class GameState {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.player = new Ragdoll(80, GROUND_Y - 80, true);
        this.enemies = [];
        this.arrows = [];
        this.particles = [];
        this.score = 0;
        this.gameOver = false;
        this.wind = Math.random() * 2 - 1;
        this.mousePos = { x: 0, y: 0 };
        this.isCharging = false;
        this.chargePower = 0;
        this.selectedArrowType = 'regular';
        this.arrowCounts = { ...INITIAL_ARROW_COUNTS };
        this.keys = {};
        this.platforms = this._createPlatforms();
    }
    
    _createPlatforms() {
        return [
            new Platform(150, GROUND_Y - 40, 100, 30),
            new Platform(350, GROUND_Y - 70, 80, 40),
            new Platform(550, GROUND_Y - 30, 100, 20)
        ];
    }
    
    spawnEnemies() {
        this.enemies = [];
        
        const enemyPositions = [
            { x: 200, y: GROUND_Y - 80 },
            { x: 390, y: GROUND_Y - 150 },
            { x: 600, y: GROUND_Y - 80 },
        ];
        
        enemyPositions.forEach(pos => {
            const enemy = new Ragdoll(pos.x, pos.y, false);
            this.enemies.push(enemy);
        });
    }
    
    updateWind() {
        if (Math.random() < 0.01) {
            this.wind += (Math.random() - 0.5) * 0.1;
            this.wind = Math.max(-1, Math.min(1, this.wind));
        }
    }
}