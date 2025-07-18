import { WIND_STRENGTH, ARROW_SPEED_MULTIPLIER, DAMAGE_VALUES, GROUND_Y } from '../constants.js';
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
        this.stuckPartName = '';
        this.stuckOffsetX = 0;
        this.stuckOffsetY = 0;
        
        // Firework arrow specific properties
        this.explosionTimer = 0;
        this.maxExplosionTime = 180; // 3 seconds at 60fps
        this.hasExploded = false;
        
        // Fire arrow specific properties
        this.fireParticleTimer = 0;
    }
    
    update(gameState) {
        if (!this.active) return;
        
        if (this.stuck && this.stuckTarget) {
            // For rigid ragdolls, update position based on target's rigid body
            const targetPos = this.stuckTarget.getBodyPartPosition(this.stuckPartName);
            this.x = targetPos.x + this.stuckOffsetX;
            this.y = targetPos.y + this.stuckOffsetY;
            
            // Continue firework timer even when stuck
            if (this.type === 'firework' && !this.hasExploded) {
                this.explosionTimer++;
                if (this.explosionTimer >= this.maxExplosionTime) {
                    this._explode(gameState);
                }
            }
            
            // Create fire particles for stuck fire arrows
            if (this.type === 'fire') {
                this.fireParticleTimer++;
                if (this.fireParticleTimer % 5 === 0) {
                    this._createFireParticles(gameState);
                }
            }
            
            return;
        }
        
        this._updateTrail();
        this._applyPhysics(gameState);
        this._updateAngle();
        this._handleSplitArrow(gameState);
        this._handleFireworkArrow(gameState);
        this._handleFireArrow(gameState);
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
        // NO GRAVITY - arrows travel in straight lines
        // Only apply wind effect
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
    
    _handleFireworkArrow(gameState) {
        if (this.type === 'firework' && !this.hasExploded) {
            this.explosionTimer++;
            if (this.explosionTimer >= this.maxExplosionTime) {
                this._explode(gameState);
            }
        }
    }
    
    _handleFireArrow(gameState) {
        if (this.type === 'fire') {
            this.fireParticleTimer++;
            if (this.fireParticleTimer % 3 === 0) {
                // Create trailing fire particles
                const particle = new Particle(
                    this.x + (Math.random() - 0.5) * 8,
                    this.y + (Math.random() - 0.5) * 8,
                    (Math.random() - 0.5) * 2,
                    -Math.random() * 2,
                    `hsl(${Math.random() * 60}, 100%, 50%)`,
                    20 + Math.random() * 20
                );
                gameState.particles.push(particle);
            }
        }
    }
    
    _checkGroundCollision() {
        if (this.y > GROUND_Y) {
            this.active = false;
        }
    }
    
    _checkBounds() {
        if (this.x < -50 || this.x > 650 || this.y > 450) {
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
    
    _explode(gameState) {
        if (this.hasExploded) return;
        
        this.hasExploded = true;
        
        // Create explosion particles
        for (let i = 0; i < 30; i++) {
            const angle = (i / 30) * Math.PI * 2;
            const speed = 3 + Math.random() * 4;
            const particle = new Particle(
                this.x, this.y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                `hsl(${Math.random() * 60 + 10}, 100%, ${50 + Math.random() * 30}%)`,
                80 + Math.random() * 40
            );
            gameState.particles.push(particle);
        }
        
        // Damage all nearby entities
        const explosionRadius = 80;
        const targets = this.isPlayerArrow ? gameState.enemies : [gameState.player];
        
        for (let target of targets) {
            if (!target || target.dead) continue;
            
            const targetCenter = target.getBodyPartPosition('chest');
            const dx = targetCenter.x - this.x;
            const dy = targetCenter.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < explosionRadius) {
                const damage = this.damage * (1 - distance / explosionRadius);
                const forceMultiplier = (1 - distance / explosionRadius) * 8;
                const forceX = (dx / distance) * forceMultiplier;
                const forceY = (dy / distance) * forceMultiplier;
                
                target.takeDamage(damage, this.x, this.y, forceX, forceY, gameState);
            }
        }
        
        this.active = false;
    }
    
    _checkCollisions(gameState) {
        const targets = this.isPlayerArrow ? gameState.enemies : [gameState.player];
        
        for (let target of targets) {
            if (!target || target.dead) continue;
            
            // Check collision with each body part
            for (let partName of Object.keys(target.bodyParts)) {
                const part = target.getBodyPartPosition(partName);
                const dx = this.x - part.x;
                const dy = this.y - part.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < part.radius + 3) {
                    this._handleHit(target, partName, part, gameState);
                    return;
                }
            }
        }
    }
    
    _handleHit(target, partName, part, gameState) {
        const forceX = this.vx * 0.3;
        const forceY = this.vy * 0.3;
        
        // For firework arrows, don't deal damage on hit, only on explosion
        if (this.type !== 'firework') {
            target.takeDamage(this.damage, this.x, this.y, forceX, forceY, gameState);
        }
        
        this._createImpactEffect(gameState);
        
        this.stuck = true;
        this.stuckTarget = target;
        this.stuckPartName = partName;
        this.stuckOffsetX = this.x - part.x;
        this.stuckOffsetY = this.y - part.y;
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
            case 'firework': return '#ffaa00';
            default: return '#8B4513';
        }
    }
    
    draw(ctx) {
        if (!this.active) return;
        
        ctx.save();
        
        this._drawTrail(ctx);
        this._drawArrow(ctx);
        
        // Draw firework timer indicator
        if (this.type === 'firework' && !this.hasExploded) {
            this._drawFireworkTimer(ctx);
        }
        
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
        } else if (this.type === 'firework') {
            ctx.shadowColor = '#ffaa00';
            ctx.shadowBlur = 8;
        }
    }
    
    _drawFireworkTimer(ctx) {
        const progress = this.explosionTimer / this.maxExplosionTime;
        const radius = 8;
        
        // Reset transformation for timer
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Draw timer circle
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 15, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw progress arc
        ctx.strokeStyle = progress > 0.7 ? '#ff4444' : '#ffaa00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 15, radius, -Math.PI/2, -Math.PI/2 + (progress * Math.PI * 2));
        ctx.stroke();
    }
    
    _getArrowColor() {
        if (!this.isPlayerArrow) return '#8B0000';
        
        switch (this.type) {
            case 'fire': return '#ff4444';
            case 'heavy': return '#444444';
            case 'split': return '#4444ff';
            case 'firework': return '#ffaa00';
            default: return '#8B4513';
        }
    }
}