import { GROUND_Y } from '../constants.js';

export class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
    }
    
    draw(gameState) {
        this._clearCanvas();
        this._drawEnvironment(gameState);
        this._drawEntities(gameState);
        this._drawUI(gameState);
        this._drawDebugInfo(gameState);
    }
    
    _clearCanvas() {
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#98FB98');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    _drawEnvironment(gameState) {
        // Draw ground
        this.ctx.fillStyle = '#228B22';
        this.ctx.fillRect(0, GROUND_Y, this.canvas.width, this.canvas.height - GROUND_Y);
        
        // Draw ground line
        this.ctx.strokeStyle = '#1F5F1F';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, GROUND_Y);
        this.ctx.lineTo(this.canvas.width, GROUND_Y);
        this.ctx.stroke();
        
        // Draw platforms
        gameState.platforms.forEach(platform => platform.draw(this.ctx));
    }
    
    _drawEntities(gameState) {
        // Draw particles
        gameState.particles.forEach(particle => particle.draw(this.ctx));
        
        // Draw arrows
        gameState.arrows.forEach(arrow => arrow.draw(this.ctx));
        
        // Draw ragdolls
        if (gameState.player) {
            gameState.player.draw(this.ctx, gameState);
        }
        gameState.enemies.forEach(enemy => enemy.draw(this.ctx, gameState));
    }
    
    _drawUI(gameState) {
        // Draw wind indicator
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.font = '14px Arial';
        this.ctx.fillText(
            `Wind: ${gameState.wind > 0 ? '→' : '←'} ${Math.abs(gameState.wind).toFixed(1)}`,
            this.canvas.width - 100, 25
        );
        
        // Draw controls hint
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.font = '10px Arial';
        this.ctx.fillText(
            'Keys: 1-Regular 2-Fire 3-Heavy 4-Split | Mouse: Aim & Shoot',
            10, this.canvas.height - 8
        );
    }
    
    _drawDebugInfo(gameState) {
        this.ctx.fillStyle = 'white';
        this.ctx.font = '10px Arial';
        this.ctx.fillText(`Player: ${gameState.player ? 'Yes' : 'No'}`, 10, 40);
        this.ctx.fillText(`Enemies: ${gameState.enemies.length}`, 10, 52);
        this.ctx.fillText(`Arrows: ${gameState.arrows.length}`, 10, 64);
        this.ctx.fillText(`Ground: ${GROUND_Y}`, 10, 76);
    }
}