import { Joint } from '../physics/Joint.js';
import { Stick } from '../physics/Stick.js';
import { GROUND_Y, ARROW_SPEED_MULTIPLIER } from '../constants.js';
import { Arrow } from './Arrow.js';
import { Particle } from './Particle.js';

export class Ragdoll {
    constructor(x, y, isPlayer = false) {
        this.isPlayer = isPlayer;
        this.health = 100;
        this.maxHealth = 100;
        this.dead = false;
        this.deathTimer = 0;
        this.color = isPlayer ? '#4A90E2' : '#E74C3C';
        
        this._createJoints(x, y);
        this._createSticks();
        this._initializeProperties();
    }
    
    _createJoints(x, y) {
        const feetY = Math.min(y + 55, GROUND_Y);
        const baseY = feetY - 55;
        
        this.head = new Joint(x, baseY - 25);
        this.neck = new Joint(x, baseY - 15);
        this.chest = new Joint(x, baseY);
        this.waist = new Joint(x, baseY + 15);
        this.leftShoulder = new Joint(x - 10, baseY - 10);
        this.rightShoulder = new Joint(x + 10, baseY - 10);
        this.leftElbow = new Joint(x - 15, baseY + 5);
        this.rightElbow = new Joint(x + 15, baseY + 5);
        this.leftHand = new Joint(x - 20, baseY + 20);
        this.rightHand = new Joint(x + 20, baseY + 20);
        this.leftHip = new Joint(x - 5, baseY + 25);
        this.rightHip = new Joint(x + 5, baseY + 25);
        this.leftKnee = new Joint(x - 7, baseY + 40);
        this.rightKnee = new Joint(x + 7, baseY + 40);
        this.leftFoot = new Joint(x - 10, feetY);
        this.rightFoot = new Joint(x + 10, feetY);
        
        this.joints = [
            this.head, this.neck, this.chest, this.waist,
            this.leftShoulder, this.rightShoulder, this.leftElbow, this.rightElbow,
            this.leftHand, this.rightHand, this.leftHip, this.rightHip,
            this.leftKnee, this.rightKnee, this.leftFoot, this.rightFoot
        ];
    }
    
    _createSticks() {
        this.sticks = [
            // Spine
            new Stick(this.head, this.neck, 10),
            new Stick(this.neck, this.chest, 15),
            new Stick(this.chest, this.waist, 15),
            // Arms
            new Stick(this.chest, this.leftShoulder, 10),
            new Stick(this.chest, this.rightShoulder, 10),
            new Stick(this.leftShoulder, this.leftElbow, 12),
            new Stick(this.rightShoulder, this.rightElbow, 12),
            new Stick(this.leftElbow, this.leftHand, 15),
            new Stick(this.rightElbow, this.rightHand, 15),
            // Legs
            new Stick(this.waist, this.leftHip, 8),
            new Stick(this.waist, this.rightHip, 8),
            new Stick(this.leftHip, this.leftKnee, 15),
            new Stick(this.rightHip, this.rightKnee, 15),
            new Stick(this.leftKnee, this.leftFoot, 15),
            new Stick(this.rightKnee, this.rightFoot, 15),
            // Cross braces for stability
            new Stick(this.leftHip, this.rightHip, 10),
            new Stick(this.leftShoulder, this.rightShoulder, 20)
        ];
    }
    
    _initializeProperties() {
        if (this.isPlayer) {
            this.bowLength = 35;
            this.aimAngle = 0;
        } else {
            this.shootTimer = 0;
            this.shootCooldown = 180 + Math.random() * 120;
            this.accuracy = 0.7 + Math.random() * 0.3;
        }
    }
    
    update(gameState) {
        if (this.dead) {
            this.deathTimer++;
            if (this.deathTimer > 300) {
                return false;
            }
        }
        
        // Update physics with multiple iterations for stability
        for (let i = 0; i < 4; i++) {
            this.joints.forEach(joint => joint.update(gameState.platforms));
            this.sticks.forEach(stick => stick.update());
        }
        
        // Additional ground constraint to prevent sinking
        this._enforceGroundConstraints();
        
        if (!this.dead) {
            if (this.isPlayer) {
                this._updatePlayerAiming(gameState);
            } else {
                this._updateEnemyAI(gameState);
            }
        }
        
        return true;
    }
    
    _enforceGroundConstraints() {
        this.joints.forEach(joint => {
            if (joint.y > GROUND_Y) {
                joint.y = GROUND_Y;
                joint.oldY = joint.y;
            }
        });
    }
    
    _updatePlayerAiming(gameState) {
        const dx = gameState.mousePos.x - this.rightHand.x;
        const dy = gameState.mousePos.y - this.rightHand.y;
        this.aimAngle = Math.atan2(dy, dx);
        
        if (gameState.isCharging) {
            const pullBack = gameState.chargePower * 0.3;
            this.rightHand.x = this.rightShoulder.x + Math.cos(this.aimAngle) * (25 - pullBack);
            this.rightHand.y = this.rightShoulder.y + Math.sin(this.aimAngle) * (25 - pullBack);
        }
    }
    
    _updateEnemyAI(gameState) {
        this.shootTimer++;
        
        if (this.shootTimer > this.shootCooldown) {
            this._shootAtPlayer(gameState);
            this.shootTimer = 0;
            this.shootCooldown = 120 + Math.random() * 180;
        }
    }
    
    _shootAtPlayer(gameState) {
        if (!gameState.player || gameState.player.dead) return;
        
        const dx = gameState.player.chest.x - this.rightHand.x;
        const dy = gameState.player.chest.y - this.rightHand.y;
        const baseAngle = Math.atan2(dy, dx);
        const inaccuracy = (Math.random() - 0.5) * (2 - this.accuracy);
        const aimAngle = baseAngle + inaccuracy;
        
        const power = 30 + Math.random() * 20;
        const velocity = power * ARROW_SPEED_MULTIPLIER;
        const vx = Math.cos(aimAngle) * velocity;
        const vy = Math.sin(aimAngle) * velocity;
        
        const arrow = new Arrow(
            this.rightHand.x + Math.cos(aimAngle) * 15,
            this.rightHand.y + Math.sin(aimAngle) * 15,
            vx, vy, 'regular', false
        );
        
        gameState.arrows.push(arrow);
    }
    
    takeDamage(damage, impactX, impactY, forceX = 0, forceY = 0, gameState) {
        if (this.dead) return false;
        
        this.health -= damage;
        
        this._applyImpactForce(impactX, impactY, forceX, forceY);
        this._createBloodParticles(impactX, impactY, forceX, forceY, gameState);
        
        if (this.health <= 0) {
            this.health = 0;
            this.dead = true;
            
            if (this.isPlayer) {
                gameState.gameOver = true;
            } else {
                gameState.score += 100;
            }
            
            return true;
        }
        
        return false;
    }
    
    _applyImpactForce(impactX, impactY, forceX, forceY) {
        this.joints.forEach(joint => {
            const dx = joint.x - impactX;
            const dy = joint.y - impactY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 50) {
                const force = (50 - distance) / 50;
                joint.x += forceX * force * 0.5;
                joint.y += forceY * force * 0.5;
                joint.oldX = joint.x - forceX * force * 0.3;
                joint.oldY = joint.y - forceY * force * 0.3;
            }
        });
    }
    
    _createBloodParticles(impactX, impactY, forceX, forceY, gameState) {
        for (let i = 0; i < 8; i++) {
            const particle = new Particle(
                impactX + (Math.random() - 0.5) * 10,
                impactY + (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 6 + forceX * 0.1,
                (Math.random() - 0.5) * 6 + forceY * 0.1,
                '#8B0000',
                30 + Math.random() * 20
            );
            gameState.particles.push(particle);
        }
    }
    
    shoot(gameState) {
        if (gameState.chargePower < 3 || this.dead) return;
        
        const arrowType = gameState.selectedArrowType;
        
        if (arrowType !== 'regular' && gameState.arrowCounts[arrowType] <= 0) {
            return;
        }
        
        if (arrowType !== 'regular') {
            gameState.arrowCounts[arrowType]--;
        }
        
        const power = gameState.chargePower;
        const velocity = power * ARROW_SPEED_MULTIPLIER;
        const vx = Math.cos(this.aimAngle) * velocity;
        const vy = Math.sin(this.aimAngle) * velocity;
        
        const arrow = new Arrow(
            this.rightHand.x + Math.cos(this.aimAngle) * 15,
            this.rightHand.y + Math.sin(this.aimAngle) * 15,
            vx, vy, arrowType, true
        );
        
        gameState.arrows.push(arrow);
        
        gameState.chargePower = 0;
        gameState.isCharging = false;
    }
    
    draw(ctx, gameState) {
        ctx.save();
        
        // Draw sticks first
        this.sticks.forEach(stick => {
            stick.thickness = this.dead ? 2 : 3;
            stick.draw(ctx);
        });
        
        // Draw joints
        this.joints.forEach(joint => {
            joint.radius = this.dead ? 3 : 4;
            joint.draw(ctx);
        });
        
        this._drawHead(ctx);
        
        if (this.isPlayer && !this.dead) {
            this._drawBow(ctx, gameState);
            this._drawTrajectoryPrediction(ctx, gameState);
        }
        
        if (!this.dead) {
            this._drawHealthBar(ctx);
        }
        
        ctx.restore();
    }
    
    _drawHead(ctx) {
        ctx.fillStyle = this.dead ? '#DDD' : '#FFE4B5';
        ctx.beginPath();
        ctx.arc(this.head.x, this.head.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#DEB887';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        if (!this.dead) {
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(this.head.x - 3, this.head.y - 2, 1.5, 0, Math.PI * 2);
            ctx.arc(this.head.x + 3, this.head.y - 2, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    _drawBow(ctx, gameState) {
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        
        const bowStartX = this.leftHand.x;
        const bowStartY = this.leftHand.y;
        const bowEndX = bowStartX + Math.cos(this.aimAngle) * this.bowLength;
        const bowEndY = bowStartY + Math.sin(this.aimAngle) * this.bowLength;
        
        ctx.beginPath();
        ctx.moveTo(bowStartX, bowStartY);
        ctx.lineTo(bowEndX, bowEndY);
        ctx.stroke();
        
        if (gameState.isCharging) {
            this._drawBowString(ctx);
        }
    }
    
    _drawBowString(ctx) {
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const perpAngle = this.aimAngle + Math.PI / 2;
        
        ctx.moveTo(
            this.leftHand.x + Math.cos(perpAngle) * 8,
            this.leftHand.y + Math.sin(perpAngle) * 8
        );
        ctx.lineTo(this.rightHand.x, this.rightHand.y);
        ctx.lineTo(
            this.leftHand.x - Math.cos(perpAngle) * 8,
            this.leftHand.y - Math.sin(perpAngle) * 8
        );
        ctx.stroke();
    }
    
    _drawHealthBar(ctx) {
        const barWidth = 40;
        const barHeight = 6;
        const barX = this.head.x - barWidth / 2;
        const barY = this.head.y - 20;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = healthPercent > 0.5 ? '#2ECC71' : healthPercent > 0.25 ? '#F39C12' : '#E74C3C';
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
        
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
    
    _drawTrajectoryPrediction(ctx, gameState) {
        if (!gameState.isCharging || this.dead) return;
        
        const power = gameState.chargePower;
        const velocity = power * ARROW_SPEED_MULTIPLIER;
        const vx = Math.cos(this.aimAngle) * velocity;
        const vy = Math.sin(this.aimAngle) * velocity;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        
        let x = this.rightHand.x;
        let y = this.rightHand.y;
        let velX = vx;
        let velY = vy;
        
        ctx.moveTo(x, y);
        
        for (let i = 0; i < 60; i++) {
            velY += 0.3; // GRAVITY
            velX += gameState.wind * 0.02; // WIND_STRENGTH
            x += velX;
            y += velY;
            
            if (x < 0 || x > 700 || y > GROUND_Y) break;
            
            if (i % 3 === 0) {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
    }
}