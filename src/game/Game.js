import { MAX_POWER } from '../constants.js';
import { GameState } from './GameState.js';
import { Renderer } from './Renderer.js';
import { InputHandler } from './InputHandler.js';
import { UIManager } from '../ui/UIManager.js';
import { AudioManager } from '../audio/AudioManager.js';

export class Game {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        
        this.gameState = new GameState();
        this.renderer = new Renderer(canvas, ctx);
        this.uiManager = new UIManager();
        this.audioManager = new AudioManager();
        this.inputHandler = new InputHandler(canvas, this.gameState, this.uiManager, this.audioManager);
        
        this._init();
    }
    
    _init() {
        console.log('Initializing game...');
        console.log('Canvas size:', this.canvas.width, 'x', this.canvas.height);
        
        this.gameState.spawnEnemies();
        this._updateUI();
        
        console.log('Game initialized, starting loop...');
        this._gameLoop();
    }
    
    _gameLoop() {
        if (!this.gameState.gameOver) {
            this._update();
        }
        this.renderer.draw(this.gameState);
        requestAnimationFrame(() => this._gameLoop());
    }
    
    _update() {
        this._updateCharging();
        this._updateEntities();
        this._updateWind();
        this._updateUI();
    }
    
    _updateCharging() {
        if (this.gameState.isCharging && this.gameState.player && !this.gameState.player.dead) {
            this.gameState.chargePower = Math.min(this.gameState.chargePower + 1.2, MAX_POWER);
            this.uiManager.updatePowerMeter(this.gameState.chargePower, MAX_POWER);
        }
    }
    
    _updateEntities() {
        // Update player
        if (this.gameState.player) {
            this.gameState.player.update(this.gameState);
        }
        
        // Update enemies - keep them even when dead for visual effect
        this.gameState.enemies.forEach(enemy => enemy.update(this.gameState));
        
        // Update arrows
        this.gameState.arrows = this.gameState.arrows.filter(arrow => {
            arrow.update(this.gameState);
            return arrow.active;
        });
        
        // Update particles
        this.gameState.particles = this.gameState.particles.filter(particle => {
            particle.update();
            return !particle.isDead();
        });
    }
    
    _updateWind() {
        this.gameState.updateWind();
    }
    
    _updateUI() {
        if (this.gameState.player) {
            this.uiManager.updateHealthBar(this.gameState.player.health, this.gameState.player.maxHealth);
        }
        this.uiManager.updateScore(this.gameState.score);
        this.uiManager.updateArrowCounts(this.gameState.arrowCounts);
        
        if (this.gameState.gameOver) {
            this.uiManager.showGameOver(this.gameState.score);
        }
    }
    
    restart() {
        this.gameState.reset();
        this.gameState.spawnEnemies();
        this.uiManager.hideGameOver();
        this._updateUI();
        
        // Reset arrow selection
        document.querySelector('.arrow-type.selected').classList.remove('selected');
        document.querySelector('.arrow-type[data-type="regular"]').classList.add('selected');
    }
}