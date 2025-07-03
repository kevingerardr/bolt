import { GRAVITY, WIND_STRENGTH, ARROW_SPEED_MULTIPLIER, DAMAGE_VALUES, GROUND_Y } from '../constants.js';
import { Particle } from './Particle.js';

export class Arrow {
    constructor(x, y, vx, vy, type = 'regular', isPlayerArrow = true) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.type = type;
        this.isPlayerArrow = isPlayerArrow;
        this.angle = Math.atan2(vy, vx);
        this.length = 18;
        this.damage = DAMAGE_VALUES[type] || 30;
        this.trail = [];
        this.active = true;
        this.splitTimer = 0;
        this.hasSplit = false;
        this.stuck = false;
        this.stuckTarget = null;
        this.stuckOffsetX = 0;
        this.stuckOffsetY = 0;
    }
    
    update(gameState) {
        if (!this.active) return;
        
        if (this.stuck && this.stuckTarget) {
            this.x = this.stuckTarget.x + this.stuckOffsetX;
            this.y = this.stuckTarget.y + this.stuckOffsetY;
            return;
        }
        
        this._updateTrail();
        this._applyPhysics(gameState);
        this._updateAngle();
        this._handleSplitArrow(gameState);
        this._checkGroundCollision();
        this._checkBounds();
        this._checkCollisions(gameState);
    }
    
    _updateTrail() {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 8) {
            this.trail.shift();
        }
    }
    
    _applyPhysics(gameState) {
        this.vy += GRAVITY;
        this.vx += gameState.wind * WIND_STRENGTH;
        this.x += this.vx;
        this.y += this.vy;
    }
    
    _updateAngle() {
        this.angle = Math.atan2(this.vy, this.vx);
    }
    
    _handleSplitArrow(gameState) {
        if (this.type === 'split' && !this.hasSplit && this.isPlayerArrow) {
            this.splitTimer++;
            if (this.splitTimer > 15) {
                this._split(gameState);
            }
        }
    }
    
    _checkGroundCollision() {
        if (this.y > GROUND_Y) {
            this.y = GROUND_Y;
            this.vy = -this.vy * 0.3;
            this.vx *= 0.8;
            
            if (Math.abs(this.vy) < 1) {
                this.active = false;
            }
        }
    }
    
    _checkBounds() {
        if (this.x < -50 || this.x > 750 || this.y > 500) {
            this.active = false;
        }
    }
    
    _split(gameState) {
        if (this.hasSplit) return;
        
        this.hasSplit = true;
        
        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const spreadAngle = 0.4;
        
        const leftArrow = new Arrow(
            this.x, this.y,
            Math.cos(this.angle - spreadAngle) * currentSpeed * 0.8,
            Math.sin(this.angle - spreadAngle) * currentSpeed * 0.8,
            'split', this.isPlayerArrow
        );
        leftArrow.hasSplit = true;
        
        const rightArrow = new Arrow(
            this.x, this.y,
            Math.cos(this.angle + spreadAngle) * currentSpeed * 0.8,
            Math.sin(this.angle + spreadAngle) * currentSpeed * 0.8,
            'split', this.isPlayerArrow
        );
        rightArrow.hasSplit = true;
        
        gameState.arrows.push(leftArrow, rightArrow);
    }
    
    _checkCollisions(gameState) {
        const targets = this.isPlayerArrow ? gameState.enemies : [gameState.player];
        
        for (let target of targets) {
            if (!target || target.dead) continue;
            
            for (let joint of target.joints) {
                const dx = this.x - joint.x;
                const dy = this.y - joint.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < joint.radius + 3) {
                    this._handleHit(target, joint, gameState);
                    return;
                }
            }
        }
    }
    
    _handleHit(target, joint, gameState) {
        const forceX = this.vx * 0.3;
        const forceY = this.vy * 0.3;
        
        target.takeDamage(this.damage, this.x, this.y, forceX, forceY, gameState);
        this._createImpactEffect(gameState);
        
        this.stuck = true;
        this.stuckTarget = joint;
        this.stuckOffsetX = this.x - joint.x;
        this.stuckOffsetY = this.y - joint.y;
        this.vx = 0;
        this.vy = 0;
    }
    
    _createImpactEffect(gameState) {
        for (let i = 0; i < 8; i++) {
            const particle = new Particle(
                this.x, this.y,
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 6,
                this._getParticleColor(),
                30 + Math.random() * 20
            );
            gameState.particles.push(particle);
        }
        
        if (this.type === 'fire') {
            this._createFireParticles(gameState);
        }
    }
    
    _createFireParticles(gameState) {
        for (let i = 0; i < 15; i++) {
            const particle = new Particle(
                this.x + (Math.random() - 0.5) * 15,
                this.y + (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 4,
                -Math.random() * 3,
                `hsl(${Math.random() * 60}, 100%, 50%)`,
                60 + Math.random() * 40
            );
            gameState.particles.push(particle);
        }
    }
    
    _getParticleColor() {
        switch (this.type) {
            case 'fire': return '#ff6600';
            case 'heavy': return '#666666';
            case 'split': return '#4444ff';
            default: return '#8B4513';
        }
    }
    
    draw(ctx) {
        if (!this.active) return;
        
        ctx.save();
        
        this._drawTrail(ctx);
        this._drawArrow(ctx);
        
        ctx.restore();
    }
    
    _drawTrail(ctx) {
        for (let i = 0; i < this.trail.length; i++) {
            const alpha = i / this.trail.length * 0.5;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = this._getArrowColor();
            const size = 1 + (i / this.trail.length) * 2;
            ctx.fillRect(this.trail[i].x - size/2, this.trail[i].y - size/2, size, size);
        }
        ctx.globalAlpha = 1;
    }
    
    _drawArrow(ctx) {
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Draw arrow shaft
        ctx.fillStyle = this._getArrowColor();
        ctx.fillRect(-this.length/2, -1.5, this.length, 3);
        
        // Draw arrow head
        ctx.beginPath();
        ctx.moveTo(this.length/2, 0);
        ctx.lineTo(this.length/2 - 6, -3);
        ctx.lineTo(this.length/2 - 6, 3);
        ctx.closePath();
        ctx.fill();
        
        // Draw fletching
        ctx.fillStyle = '#654321';
        ctx.fillRect(-this.length/2, -3, 4, 6);
        
        // Special effects
        if (this.type === 'fire') {
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 10;
        }
    }
    
    _getArrowColor() {
        if (!this.isPlayerArrow) return '#8B0000';
        
        switch (this.type) {
            case 'fire': return '#ff4444';
            case 'heavy': return '#444444';
            case 'split': return '#4444ff';
            default: return '#8B4513';
        }
    }
}