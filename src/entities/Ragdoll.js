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
        
        // Rigid body properties
        this.x = x;
        this.y = y;
        this.rotation = 0;
        this.angularVelocity = 0;
        this.velocityX = 0;
        this.velocityY = 0;
        this.grounded = true;
        
        this._createBodyStructure();
        this._initializeProperties();
    }
    
    _createBodyStructure() {
        // Define body parts as relative positions from center
        this.bodyParts = {
            head: { x: 0, y: -25, radius: 8 },
            neck: { x: 0, y: -15, radius: 3 },
            chest: { x: 0, y: 0, radius: 6 },
            waist: { x: 0, y: 15, radius: 5 },
            leftShoulder: { x: -10, y: -10, radius: 4 },
            rightShoulder: { x: 10, y: -10, radius: 4 },
            leftElbow: { x: -15, y: 5, radius: 3 },
            rightElbow: { x: 15, y: 5, radius: 3 },
            leftHand: { x: -20, y: 20, radius: 3 },
            rightHand: { x: 20, y: 20, radius: 3 },
            leftHip: { x: -5, y: 25, radius: 4 },
            rightHip: { x: 5, y: 25, radius: 4 },
            leftKnee: { x: -7, y: 40, radius: 3 },
            rightKnee: { x: 7, y: 40, radius: 3 },
            leftFoot: { x: -10, y: 55, radius: 3 },
            rightFoot: { x: 10, y: 55, radius: 3 }
        };
        
        // Define connections between body parts
        this.connections = [
            ['head', 'neck'],
            ['neck', 'chest'],
            ['chest', 'waist'],
            ['chest', 'leftShoulder'],
            ['chest', 'rightShoulder'],
            ['leftShoulder', 'leftElbow'],
            ['rightShoulder', 'rightElbow'],
            ['leftElbow', 'leftHand'],
            ['rightElbow', 'rightHand'],
            ['waist', 'leftHip'],
            ['waist', 'rightHip'],
            ['leftHip', 'leftKnee'],
            ['rightHip', 'rightKnee'],
            ['leftKnee', 'leftFoot'],
            ['rightKnee', 'rightFoot'],
            ['leftHip', 'rightHip'],
            ['leftShoulder', 'rightShoulder']
        ];
        
        // Ensure ragdoll is on ground
        const feetY = Math.min(this.y + 55, GROUND_Y);
        this.y = feetY - 55;
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
    
    // Get world position of a body part
    getBodyPartPosition(partName) {
        const part = this.bodyParts[partName];
        if (!part) return { x: this.x, y: this.y };
        
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);
        
        return {
            x: this.x + (part.x * cos - part.y * sin),
            y: this.y + (part.x * sin + part.y * cos),
            radius: part.radius
        };
    }
    
    update(gameState) {
        if (this.dead) {
            this.deathTimer++;
            if (this.deathTimer > 300) {
                return false;
            }
        }
        
        // Apply physics to the rigid body
        this._updatePhysics();
        
        if (!this.dead) {
            if (this.isPlayer) {
                this._updatePlayerAiming(gameState);
            } else {
                this._updateEnemyAI(gameState);
            }
        }
        
        return true;
    }
    
    _updatePhysics() {
        // Apply gravity if not grounded
        if (!this.grounded) {
            this.velocityY += 0.5;
        }
        
        // Apply velocities
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.rotation += this.angularVelocity;
        
        // Apply damping
        this.velocityX *= 0.95;
        this.velocityY *= 0.98;
        this.angularVelocity *= 0.95;
        
        // Ground collision
        const leftFoot = this.getBodyPartPosition('leftFoot');
        const rightFoot = this.getBodyPartPosition('rightFoot');
        const lowestY = Math.max(leftFoot.y, rightFoot.y);
        
        if (lowestY >= GROUND_Y) {
            this.y = GROUND_Y - (lowestY - this.y);
            this.velocityY = 0;
            this.grounded = true;
            
            // Reduce angular velocity when grounded
            this.angularVelocity *= 0.8;
        } else {
            this.grounded = false;
        }
        
        // Boundary constraints
        if (this.x < 30) {
            this.x = 30;
            this.velocityX = Math.abs(this.velocityX) * 0.3;
        }
        if (this.x > 570) {
            this.x = 570;
            this.velocityX = -Math.abs(this.velocityX) * 0.3;
        }
    }
    
    _updatePlayerAiming(gameState) {
        const rightHand = this.getBodyPartPosition('rightHand');
        const dx = gameState.mousePos.x - rightHand.x;
        const dy = gameState.mousePos.y - rightHand.y;
        this.aimAngle = Math.atan2(dy, dx);
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
        
        const rightHand = this.getBodyPartPosition('rightHand');
        const playerChest = gameState.player.getBodyPartPosition('chest');
        
        const dx = playerChest.x - rightHand.x;
        const dy = playerChest.y - rightHand.y;
        const baseAngle = Math.atan2(dy, dx);
        const inaccuracy = (Math.random() - 0.5) * (2 - this.accuracy);
        const aimAngle = baseAngle + inaccuracy;
        
        const power = 30 + Math.random() * 20;
        const velocity = power * ARROW_SPEED_MULTIPLIER;
        const vx = Math.cos(aimAngle) * velocity;
        const vy = Math.sin(aimAngle) * velocity;
        
        const arrow = new Arrow(
            rightHand.x + Math.cos(aimAngle) * 15,
            rightHand.y + Math.sin(aimAngle) * 15,
            vx, vy, 'regular', false
        );
        
        gameState.arrows.push(arrow);
    }
    
    takeDamage(damage, impactX, impactY, forceX = 0, forceY = 0, gameState) {
        if (this.dead) return false;
        
        this.health -= damage;
        
        // Apply impact forces to the rigid body
        this._applyImpactForce(impactX, impactY, forceX, forceY);
        this._createBloodParticles(impactX, impactY, forceX, forceY, gameState);
        
        if (this.health <= 0) {
            this.health = 0;
            this.dead = true;
            
            // Apply death forces
            this.velocityX += forceX * 0.5;
            this.velocityY += forceY * 0.5;
            this.angularVelocity += (Math.random() - 0.5) * 0.3;
            
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
        // Calculate impact relative to center of mass
        const dx = impactX - this.x;
        const dy = impactY - this.y;
        
        // Apply linear force
        this.velocityX += forceX * 0.1;
        this.velocityY += forceY * 0.1;
        
        // Apply rotational force based on impact position
        const torque = (dx * forceY - dy * forceX) * 0.001;
        this.angularVelocity += torque;
        
        // Make sure we're not grounded after impact
        this.grounded = false;
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
        
        const rightHand = this.getBodyPartPosition('rightHand');
        const power = gameState.chargePower;
        const velocity = power * ARROW_SPEED_MULTIPLIER;
        const vx = Math.cos(this.aimAngle) * velocity;
        const vy = Math.sin(this.aimAngle) * velocity;
        
        const arrow = new Arrow(
            rightHand.x + Math.cos(this.aimAngle) * 15,
            rightHand.y + Math.sin(this.aimAngle) * 15,
            vx, vy, arrowType, true
        );
        
        gameState.arrows.push(arrow);
        
        gameState.chargePower = 0;
        gameState.isCharging = false;
    }
    
    draw(ctx, gameState) {
        ctx.save();
        
        // Draw connections (bones/sticks)
        ctx.strokeStyle = this.dead ? '#999' : '#8B4513';
        ctx.lineWidth = this.dead ? 2 : 3;
        ctx.lineCap = 'round';
        
        this.connections.forEach(([part1Name, part2Name]) => {
            const part1 = this.getBodyPartPosition(part1Name);
            const part2 = this.getBodyPartPosition(part2Name);
            
            ctx.beginPath();
            ctx.moveTo(part1.x, part1.y);
            ctx.lineTo(part2.x, part2.y);
            ctx.stroke();
        });
        
        // Draw body parts (joints)
        Object.keys(this.bodyParts).forEach(partName => {
            const part = this.getBodyPartPosition(partName);
            
            ctx.fillStyle = this.dead ? '#DDD' : '#FFE4B5';
            ctx.beginPath();
            ctx.arc(part.x, part.y, part.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#DEB887';
            ctx.lineWidth = 1;
            ctx.stroke();
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
        const head = this.getBodyPartPosition('head');
        
        ctx.fillStyle = this.dead ? '#DDD' : '#FFE4B5';
        ctx.beginPath();
        ctx.arc(head.x, head.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#DEB887';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        if (!this.dead) {
            // Draw eyes relative to head rotation
            const eyeOffset = 3;
            const cos = Math.cos(this.rotation);
            const sin = Math.sin(this.rotation);
            
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(
                head.x + (-eyeOffset * cos - (-2) * sin),
                head.y + (-eyeOffset * sin + (-2) * cos),
                1.5, 0, Math.PI * 2
            );
            ctx.arc(
                head.x + (eyeOffset * cos - (-2) * sin),
                head.y + (eyeOffset * sin + (-2) * cos),
                1.5, 0, Math.PI * 2
            );
            ctx.fill();
        }
    }
    
    _drawBow(ctx, gameState) {
        const leftHand = this.getBodyPartPosition('leftHand');
        
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        
        const bowEndX = leftHand.x + Math.cos(this.aimAngle) * this.bowLength;
        const bowEndY = leftHand.y + Math.sin(this.aimAngle) * this.bowLength;
        
        ctx.beginPath();
        ctx.moveTo(leftHand.x, leftHand.y);
        ctx.lineTo(bowEndX, bowEndY);
        ctx.stroke();
        
        if (gameState.isCharging) {
            this._drawBowString(ctx, gameState);
        }
    }
    
    _drawBowString(ctx, gameState) {
        const leftHand = this.getBodyPartPosition('leftHand');
        const rightHand = this.getBodyPartPosition('rightHand');
        
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const perpAngle = this.aimAngle + Math.PI / 2;
        
        ctx.moveTo(
            leftHand.x + Math.cos(perpAngle) * 8,
            leftHand.y + Math.sin(perpAngle) * 8
        );
        ctx.lineTo(rightHand.x, rightHand.y);
        ctx.lineTo(
            leftHand.x - Math.cos(perpAngle) * 8,
            leftHand.y - Math.sin(perpAngle) * 8
        );
        ctx.stroke();
    }
    
    _drawHealthBar(ctx) {
        const head = this.getBodyPartPosition('head');
        const barWidth = 40;
        const barHeight = 6;
        const barX = head.x - barWidth / 2;
        const barY = head.y - 20;
        
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
        
        const rightHand = this.getBodyPartPosition('rightHand');
        const power = gameState.chargePower;
        const velocity = power * ARROW_SPEED_MULTIPLIER;
        const vx = Math.cos(this.aimAngle) * velocity;
        const vy = Math.sin(this.aimAngle) * velocity;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        
        let x = rightHand.x;
        let y = rightHand.y;
        let velX = vx;
        let velY = vy;
        
        ctx.moveTo(x, y);
        
        for (let i = 0; i < 60; i++) {
            velY += 0.3; // GRAVITY
            velX += gameState.wind * 0.02; // WIND_STRENGTH
            x += velX;
            y += velY;
            
            if (x < 0 || x > 600 || y > GROUND_Y) break;
            
            if (i % 3 === 0) {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
    }
}