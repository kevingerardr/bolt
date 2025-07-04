import { INITIAL_ARROW_COUNTS, GROUND_Y } from '../constants.js';
import { Ragdoll } from '../entities/Ragdoll.js';
import { Platform } from '../entities/Platform.js';

export class GameState {
    constructor() {
        this.reset();
    }
    
    reset() {
        // Place player in a tower on the left side
        this.player = new Ragdoll(80, GROUND_Y - 150, true);
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
        this.enemiesKilled = 0;
        this.waveNumber = 1;
    }
    
    _createPlatforms() {
        return [
            // Player tower (permanent)
            new Platform(30, GROUND_Y - 120, 100, 120, false),
            
            // Enemy platforms (collapsible)
            new Platform(200, GROUND_Y - 60, 80, 60, true),
            new Platform(320, GROUND_Y - 90, 70, 90, true),
            new Platform(450, GROUND_Y - 50, 80, 50, true),
            new Platform(550, GROUND_Y - 80, 70, 80, true)
        ];
    }
    
    spawnEnemies() {
        this.enemies = [];
        
        // Reset all collapsible platforms
        this.platforms.forEach(platform => {
            if (platform.isCollapsible) {
                platform.collapsed = false;
                platform.collapseTimer = 0;
                platform.shakeIntensity = 0;
            }
        });
        
        const enemyPositions = [
            { x: 240, y: GROUND_Y - 120, platformIndex: 1 },
            { x: 355, y: GROUND_Y - 150, platformIndex: 2 },
            { x: 490, y: GROUND_Y - 110, platformIndex: 3 },
            { x: 585, y: GROUND_Y - 140, platformIndex: 4 }
        ];
        
        // Add enemies based on wave number
        const enemyCount = Math.min(2 + Math.floor(this.waveNumber / 2), 4);
        
        for (let i = 0; i < enemyCount; i++) {
            const pos = enemyPositions[i % enemyPositions.length];
            const enemy = new Ragdoll(pos.x, pos.y, false);
            enemy.platformIndex = pos.platformIndex; // Track which platform this enemy is on
            this.enemies.push(enemy);
        }
    }
    
    updateWind() {
        if (Math.random() < 0.01) {
            this.wind += (Math.random() - 0.5) * 0.1;
            this.wind = Math.max(-1, Math.min(1, this.wind));
        }
    }
    
    onEnemyKilled(enemy) {
        this.enemiesKilled++;
        this.score += 100;
        
        // Start collapsing the platform this enemy was on
        if (enemy.platformIndex && this.platforms[enemy.platformIndex]) {
            this.platforms[enemy.platformIndex].startCollapse();
        }
        
        // Check if all enemies in current wave are dead
        if (this.enemies.filter(e => !e.dead).length === 0) {
            this.waveNumber++;
            // Respawn enemies after a delay
            setTimeout(() => {
                if (!this.gameOver) {
                    this.spawnEnemies();
                }
            }, 3000);
        }
    }
}