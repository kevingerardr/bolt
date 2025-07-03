import { ARROW_TYPES } from '../constants.js';

export class InputHandler {
    constructor(canvas, gameState, uiManager, audioManager) {
        this.canvas = canvas;
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.audioManager = audioManager;
        
        this._setupEventListeners();
    }
    
    _setupEventListeners() {
        this.canvas.addEventListener('mousemove', this._handleMouseMove.bind(this));
        this.canvas.addEventListener('mousedown', this._handleMouseDown.bind(this));
        this.canvas.addEventListener('mouseup', this._handleMouseUp.bind(this));
        
        document.addEventListener('keydown', this._handleKeyDown.bind(this));
        document.addEventListener('keyup', this._handleKeyUp.bind(this));
    }
    
    _handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.gameState.mousePos.x = event.clientX - rect.left;
        this.gameState.mousePos.y = event.clientY - rect.top;
    }
    
    _handleMouseDown(event) {
        if (this.gameState.gameOver || !this.gameState.player || this.gameState.player.dead) return;
        
        this.gameState.isCharging = true;
        this.gameState.chargePower = 0;
        this.audioManager.play('bowDraw');
    }
    
    _handleMouseUp(event) {
        if (this.gameState.gameOver || !this.gameState.player || this.gameState.player.dead) return;
        
        if (this.gameState.isCharging) {
            this.gameState.player.shoot(this.gameState);
            this.audioManager.play('arrowRelease');
        }
    }
    
    _handleKeyDown(event) {
        this.gameState.keys[event.key] = true;
        
        switch(event.key) {
            case '1':
                this.uiManager.selectArrowType(ARROW_TYPES.REGULAR, this.gameState);
                break;
            case '2':
                this.uiManager.selectArrowType(ARROW_TYPES.FIRE, this.gameState);
                break;
            case '3':
                this.uiManager.selectArrowType(ARROW_TYPES.HEAVY, this.gameState);
                break;
            case '4':
                this.uiManager.selectArrowType(ARROW_TYPES.SPLIT, this.gameState);
                break;
            case '5':
                this.uiManager.selectArrowType(ARROW_TYPES.FIREWORK, this.gameState);
                break;
        }
    }
    
    _handleKeyUp(event) {
        this.gameState.keys[event.key] = false;
    }
}