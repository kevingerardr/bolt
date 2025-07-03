// Game state
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const GRAVITY = 0.3;
const WIND_STRENGTH = 0.02;
const MAX_POWER = 60;
const ARROW_SPEED_MULTIPLIER = 0.15;
const JOINT_STIFFNESS = 0.8;
const JOINT_DAMPING = 0.95;
const GROUND_Y = 380; // Raised ground level to give more space

// Game state
let gameState = {
    player: null,
    enemies: [],
    arrows: [],
    particles: [],
    score: 0,
    gameOver: false,
    wind: Math.random() * 2 - 1,
    mousePos: { x: 0, y: 0 },
    isCharging: false,
    chargePower: 0,
    selectedArrowType: 'regular',
    arrowCounts: {
        fire: 10,
        heavy: 5,
        split: 3
    },
    keys: {},
    platforms: [] // Ground platforms
};

// Audio context for sound effects
let audioContext;
let sounds = {};

// Initialize audio
function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        createSounds();
    } catch (e) {
        console.log('Audio not supported');
    }
}

function createSounds() {
    sounds.bowDraw = createTone(200, 0.1, 'sawtooth');
    sounds.arrowRelease = createTone(400, 0.2, 'triangle');
    sounds.hit = createTone(150, 0.3, 'square');
    sounds.fire = createTone(300, 0.4, 'sawtooth');
    sounds.death = createTone(100, 0.8, 'square');
}

function createTone(frequency, duration, type = 'sine') {
    return () => {
        if (!audioContext) return;
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    };
}

function playSound(soundName) {
    if (sounds[soundName]) {
        sounds[soundName]();
    }
}

// Ragdoll physics classes
class Joint {
    constructor(x, y, pinned = false) {
        this.x = x;
        this.y = y;
        this.oldX = x;
        this.oldY = y;
        this.pinned = pinned;
        this.radius = 4;
    }
    
    update() {
        if (this.pinned) return;
        
        const velX = (this.x - this.oldX) * JOINT_DAMPING;
        const velY = (this.y - this.oldY) * JOINT_DAMPING;
        
        this.oldX = this.x;
        this.oldY = this.y;
        
        this.x += velX;
        this.y += velY + GRAVITY;
        
        // Ground collision with proper constraint
        if (this.y > GROUND_Y) {
            this.y = GROUND_Y;
            this.oldY = this.y + velY * 0.3; // Reduced bounce
        }
        
        // Platform collisions
        for (let platform of gameState.platforms) {
            if (this.x > platform.x && this.x < platform.x + platform.width &&
                this.y > platform.y - 5 && this.y < platform.y + platform.height + 5) {
                if (this.oldY <= platform.y) {
                    this.y = platform.y;
                    this.oldY = this.y + velY * 0.3;
                }
            }
        }
        
        // Side boundaries
        if (this.x < 0) {
            this.x = 0;
            this.oldX = this.x - velX * 0.5;
        }
        if (this.x > canvas.width) {
            this.x = canvas.width;
            this.oldX = this.x - velX * 0.5;
        }
    }
    
    draw() {
        ctx.fillStyle = '#FFE4B5';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#DEB887';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

class Stick {
    constructor(joint1, joint2, length = null) {
        this.joint1 = joint1;
        this.joint2 = joint2;
        this.length = length || this.getDistance();
        this.thickness = 3;
    }
    
    getDistance() {
        const dx = this.joint1.x - this.joint2.x;
        const dy = this.joint1.y - this.joint2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    update() {
        const dx = this.joint1.x - this.joint2.x;
        const dy = this.joint1.y - this.joint2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const difference = this.length - distance;
        const percent = difference / distance / 2;
        const offsetX = dx * percent * JOINT_STIFFNESS;
        const offsetY = dy * percent * JOINT_STIFFNESS;
        
        if (!this.joint1.pinned) {
            this.joint1.x += offsetX;
            this.joint1.y += offsetY;
        }
        if (!this.joint2.pinned) {
            this.joint2.x -= offsetX;
            this.joint2.y -= offsetY;
        }
    }
    
    draw() {
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = this.thickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.joint1.x, this.joint1.y);
        ctx.lineTo(this.joint2.x, this.joint2.y);
        ctx.stroke();
    }
}

class Ragdoll {
    constructor(x, y, isPlayer = false) {
        this.isPlayer = isPlayer;
        this.health = 100;
        this.maxHealth = 100;
        this.dead = false;
        this.deathTimer = 0;
        this.color = isPlayer ? '#4A90E2' : '#E74C3C';
        
        // Create joints (body parts) - positioned properly above ground
        // Character height is about 80 pixels, so feet should be at y + 55
        const feetY = Math.min(y + 55, GROUND_Y); // Ensure feet don't go below ground
        const baseY = feetY - 55; // Work backwards from feet position
        
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
        
        // Create sticks (bones/limbs) - simple structure
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
        
        // Player-specific properties
        if (isPlayer) {
            this.bowLength = 35;
            this.aimAngle = 0;
        } else {
            // Enemy AI properties
            this.shootTimer = 0;
            this.shootCooldown = 180 + Math.random() * 120;
            this.accuracy = 0.7 + Math.random() * 0.3;
        }
    }
    
    update() {
        if (this.dead) {
            this.deathTimer++;
            if (this.deathTimer > 300) { // Remove after 5 seconds
                return false;
            }
        }
        
        // Update physics with multiple iterations for stability
        for (let i = 0; i < 4; i++) { // Increased iterations for better stability
            this.joints.forEach(joint => joint.update());
            this.sticks.forEach(stick => stick.update());
        }
        
        // Additional ground constraint to prevent sinking
        this.joints.forEach(joint => {
            if (joint.y > GROUND_Y) {
                joint.y = GROUND_Y;
                joint.oldY = joint.y;
            }
        });
        
        // Player-specific updates
        if (this.isPlayer && !this.dead) {
            this.updatePlayerAiming();
        }
        
        // Enemy AI
        if (!this.isPlayer && !this.dead) {
            this.updateEnemyAI();
        }
        
        return true;
    }
    
    updatePlayerAiming() {
        const dx = gameState.mousePos.x - this.rightHand.x;
        const dy = gameState.mousePos.y - this.rightHand.y;
        this.aimAngle = Math.atan2(dy, dx);
        
        // Position bow hand
        if (gameState.isCharging) {
            const pullBack = gameState.chargePower * 0.3;
            this.rightHand.x = this.rightShoulder.x + Math.cos(this.aimAngle) * (25 - pullBack);
            this.rightHand.y = this.rightShoulder.y + Math.sin(this.aimAngle) * (25 - pullBack);
        }
    }
    
    updateEnemyAI() {
        this.shootTimer++;
        
        if (this.shootTimer > this.shootCooldown) {
            this.shootAtPlayer();
            this.shootTimer = 0;
            this.shootCooldown = 120 + Math.random() * 180;
        }
    }
    
    shootAtPlayer() {
        if (!gameState.player || gameState.player.dead) return;
        
        // Calculate aim towards player with some inaccuracy
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
            vx, vy, 'regular', false // false = enemy arrow
        );
        
        gameState.arrows.push(arrow);
        playSound('arrowRelease');
    }
    
    takeDamage(damage, impactX, impactY, forceX = 0, forceY = 0) {
        if (this.dead) return false;
        
        this.health -= damage;
        
        // Apply impact force to nearby joints
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
        
        // Create blood particles
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
        
        if (this.health <= 0) {
            this.health = 0;
            this.dead = true;
            playSound('death');
            
            if (this.isPlayer) {
                gameState.gameOver = true;
                document.getElementById('gameOver').style.display = 'block';
                document.getElementById('finalScore').textContent = gameState.score;
            } else {
                gameState.score += 100;
                updateScore();
            }
            
            return true;
        }
        
        return false;
    }
    
    draw() {
        ctx.save();
        
        // Draw sticks (limbs) first
        this.sticks.forEach(stick => {
            stick.thickness = this.dead ? 2 : 3;
            stick.draw();
        });
        
        // Draw joints (body parts)
        this.joints.forEach(joint => {
            joint.radius = this.dead ? 3 : 4;
            joint.draw();
        });
        
        // Draw head
        ctx.fillStyle = this.dead ? '#DDD' : '#FFE4B5';
        ctx.beginPath();
        ctx.arc(this.head.x, this.head.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#DEB887';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw eyes if alive
        if (!this.dead) {
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(this.head.x - 3, this.head.y - 2, 1.5, 0, Math.PI * 2);
            ctx.arc(this.head.x + 3, this.head.y - 2, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw bow for player
        if (this.isPlayer && !this.dead) {
            this.drawBow();
        }
        
        // Draw health bar
        if (!this.dead) {
            this.drawHealthBar();
        }
        
        // Draw trajectory prediction for player
        if (this.isPlayer && gameState.isCharging && !this.dead) {
            this.drawTrajectoryPrediction();
        }
        
        ctx.restore();
    }
    
    drawBow() {
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
        
        // Draw bow string
        if (gameState.isCharging) {
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            const stringPull = gameState.chargePower * 0.4;
            const perpAngle = this.aimAngle + Math.PI / 2;
            
            ctx.moveTo(bowStartX + Math.cos(perpAngle) * 8, bowStartY + Math.sin(perpAngle) * 8);
            ctx.lineTo(this.rightHand.x, this.rightHand.y);
            ctx.lineTo(bowStartX - Math.cos(perpAngle) * 8, bowStartY - Math.sin(perpAngle) * 8);
            ctx.stroke();
        }
    }
    
    drawHealthBar() {
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
    
    drawTrajectoryPrediction() {
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
            velY += GRAVITY;
            velX += gameState.wind * WIND_STRENGTH;
            x += velX;
            y += velY;
            
            if (x < 0 || x > canvas.width || y > GROUND_Y) break;
            
            if (i % 3 === 0) {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    shoot() {
        if (gameState.chargePower < 3 || this.dead) return;
        
        const arrowType = gameState.selectedArrowType;
        
        if (arrowType !== 'regular' && gameState.arrowCounts[arrowType] <= 0) {
            return;
        }
        
        if (arrowType !== 'regular') {
            gameState.arrowCounts[arrowType]--;
            updateArrowCounts();
        }
        
        const power = gameState.chargePower;
        const velocity = power * ARROW_SPEED_MULTIPLIER;
        const vx = Math.cos(this.aimAngle) * velocity;
        const vy = Math.sin(this.aimAngle) * velocity;
        
        const arrow = new Arrow(
            this.rightHand.x + Math.cos(this.aimAngle) * 15,
            this.rightHand.y + Math.sin(this.aimAngle) * 15,
            vx, vy, arrowType, true // true = player arrow
        );
        
        gameState.arrows.push(arrow);
        playSound('arrowRelease');
        
        gameState.chargePower = 0;
        gameState.isCharging = false;
        updatePowerMeter();
    }
}

// Arrow class
class Arrow {
    constructor(x, y, vx, vy, type = 'regular', isPlayerArrow = true) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.type = type;
        this.isPlayerArrow = isPlayerArrow;
        this.angle = Math.atan2(vy, vx);
        this.length = 18;
        this.damage = this.getDamage();
        this.trail = [];
        this.active = true;
        this.splitTimer = 0;
        this.hasSplit = false;
        this.stuck = false;
        this.stuckTarget = null;
        this.stuckOffsetX = 0;
        this.stuckOffsetY = 0;
    }
    
    getDamage() {
        switch (this.type) {
            case 'fire': return 35;
            case 'heavy': return 50;
            case 'split': return 25;
            default: return 30;
        }
    }
    
    update() {
        if (!this.active) return;
        
        if (this.stuck && this.stuckTarget) {
            // Follow the stuck target
            this.x = this.stuckTarget.x + this.stuckOffsetX;
            this.y = this.stuckTarget.y + this.stuckOffsetY;
            return;
        }
        
        // Store trail
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 8) {
            this.trail.shift();
        }
        
        // Apply physics
        this.vy += GRAVITY;
        this.vx += gameState.wind * WIND_STRENGTH;
        
        // Update position
        this.x += this.vx;
        this.y += this.vy;
        
        // Update angle
        this.angle = Math.atan2(this.vy, this.vx);
        
        // Split arrow logic
        if (this.type === 'split' && !this.hasSplit && this.isPlayerArrow) {
            this.splitTimer++;
            if (this.splitTimer > 15) {
                this.split();
            }
        }
        
        // Ground collision
        if (this.y > GROUND_Y) {
            this.y = GROUND_Y;
            this.vy = -this.vy * 0.3;
            this.vx *= 0.8;
            
            if (Math.abs(this.vy) < 1) {
                this.active = false;
            }
        }
        
        // Check bounds
        if (this.x < -50 || this.x > canvas.width + 50 || this.y > canvas.height + 50) {
            this.active = false;
        }
        
        // Check collisions
        this.checkCollisions();
    }
    
    split() {
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
    
    checkCollisions() {
        const targets = this.isPlayerArrow ? gameState.enemies : [gameState.player];
        
        for (let target of targets) {
            if (!target || target.dead) continue;
            
            // Check collision with each joint
            for (let joint of target.joints) {
                const dx = this.x - joint.x;
                const dy = this.y - joint.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < joint.radius + 3) {
                    // Calculate impact force
                    const forceX = this.vx * 0.3;
                    const forceY = this.vy * 0.3;
                    
                    target.takeDamage(this.damage, this.x, this.y, forceX, forceY);
                    this.createImpactEffect();
                    
                    // Stick arrow to target
                    this.stuck = true;
                    this.stuckTarget = joint;
                    this.stuckOffsetX = this.x - joint.x;
                    this.stuckOffsetY = this.y - joint.y;
                    this.vx = 0;
                    this.vy = 0;
                    
                    playSound('hit');
                    return;
                }
            }
        }
    }
    
    createImpactEffect() {
        for (let i = 0; i < 8; i++) {
            const particle = new Particle(
                this.x, this.y,
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 6,
                this.getParticleColor(),
                30 + Math.random() * 20
            );
            gameState.particles.push(particle);
        }
        
        if (this.type === 'fire') {
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
            playSound('fire');
        }
    }
    
    getParticleColor() {
        switch (this.type) {
            case 'fire': return '#ff6600';
            case 'heavy': return '#666666';
            case 'split': return '#4444ff';
            default: return '#8B4513';
        }
    }
    
    draw() {
        if (!this.active) return;
        
        ctx.save();
        
        // Draw trail
        for (let i = 0; i < this.trail.length; i++) {
            const alpha = i / this.trail.length * 0.5;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = this.getArrowColor();
            const size = 1 + (i / this.trail.length) * 2;
            ctx.fillRect(this.trail[i].x - size/2, this.trail[i].y - size/2, size, size);
        }
        
        ctx.globalAlpha = 1;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Draw arrow shaft
        ctx.fillStyle = this.getArrowColor();
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
        
        ctx.restore();
    }
    
    getArrowColor() {
        if (!this.isPlayerArrow) return '#8B0000'; // Enemy arrows are dark red
        
        switch (this.type) {
            case 'fire': return '#ff4444';
            case 'heavy': return '#444444';
            case 'split': return '#4444ff';
            default: return '#8B4513';
        }
    }
}

// Particle class
class Particle {
    constructor(x, y, vx, vy, color, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1;
        this.vx *= 0.98;
        this.life--;
    }
    
    draw() {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - 1, this.y - 1, 2, 2);
        ctx.globalAlpha = 1;
    }
    
    isDead() {
        return this.life <= 0;
    }
}

// Platform class for ground structures
class Platform {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    
    draw() {
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
}

// Arrow selection functions
function selectArrowType(type) {
    if (type !== 'regular' && gameState.arrowCounts[type] <= 0) {
        return;
    }
    
    gameState.selectedArrowType = type;
    
    document.querySelector('.arrow-type.selected').classList.remove('selected');
    document.querySelector(`.arrow-type[data-type="${type}"]`).classList.add('selected');
}

// Game functions
function init() {
    console.log('Initializing game...');
    
    // Ensure canvas is ready
    if (!canvas || !ctx) {
        console.error('Canvas not found!');
        return;
    }
    
    console.log('Canvas size:', canvas.width, 'x', canvas.height);
    console.log('Ground level:', GROUND_Y);
    
    initAudio();
    
    // Create player at safe position above ground
    gameState.player = new Ragdoll(80, GROUND_Y - 80, true);
    console.log('Player created at:', gameState.player.head.x, gameState.player.head.y);
    console.log('Player feet at:', gameState.player.leftFoot.y, gameState.player.rightFoot.y);
    
    // Create enemies at safe positions
    spawnEnemies();
    
    // Create platforms - positioned above ground
    gameState.platforms = [
        new Platform(150, GROUND_Y - 40, 100, 30),  // Platform 1
        new Platform(350, GROUND_Y - 70, 80, 40),   // Platform 2 (higher)
        new Platform(550, GROUND_Y - 30, 100, 20)   // Platform 3
    ];
    
    // Event listeners
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Arrow type selection
    document.querySelectorAll('.arrow-type').forEach(element => {
        element.addEventListener('click', () => {
            selectArrowType(element.dataset.type);
        });
    });
    
    console.log('Game initialized, starting loop...');
    
    // Start game loop
    gameLoop();
}

function spawnEnemies() {
    // Clear existing enemies
    gameState.enemies = [];
    
    // Spawn enemies at safe positions - on platforms and ground
    const enemyPositions = [
        { x: 200, y: GROUND_Y - 80 },        // On platform 1
        { x: 390, y: GROUND_Y - 150 },       // On platform 2 (higher)
        { x: 600, y: GROUND_Y - 80 },        // On platform 3
    ];
    
    enemyPositions.forEach((pos, index) => {
        const enemy = new Ragdoll(pos.x, pos.y, false);
        gameState.enemies.push(enemy);
        console.log(`Enemy ${index + 1} created at:`, enemy.head.x, enemy.head.y);
        console.log(`Enemy ${index + 1} feet at:`, enemy.leftFoot.y, enemy.rightFoot.y);
    });
}

function handleMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    gameState.mousePos.x = event.clientX - rect.left;
    gameState.mousePos.y = event.clientY - rect.top;
}

function handleMouseDown(event) {
    if (gameState.gameOver || !gameState.player || gameState.player.dead) return;
    
    gameState.isCharging = true;
    gameState.chargePower = 0;
    playSound('bowDraw');
}

function handleMouseUp(event) {
    if (gameState.gameOver || !gameState.player || gameState.player.dead) return;
    
    if (gameState.isCharging) {
        gameState.player.shoot();
    }
}

function handleKeyDown(event) {
    gameState.keys[event.key] = true;
    
    switch(event.key) {
        case '1':
            selectArrowType('regular');
            break;
        case '2':
            selectArrowType('fire');
            break;
        case '3':
            selectArrowType('heavy');
            break;
        case '4':
            selectArrowType('split');
            break;
    }
}

function handleKeyUp(event) {
    gameState.keys[event.key] = false;
}

function updatePowerMeter() {
    const powerFill = document.getElementById('powerFill');
    powerFill.style.width = (gameState.chargePower / MAX_POWER * 100) + '%';
}

function updateHealthBar() {
    const healthFill = document.getElementById('playerHealthFill');
    if (gameState.player) {
        healthFill.style.width = (gameState.player.health / gameState.player.maxHealth * 100) + '%';
    }
}

function updateScore() {
    document.getElementById('scoreValue').textContent = gameState.score;
}

function updateArrowCounts() {
    document.getElementById('fireCount').textContent = gameState.arrowCounts.fire;
    document.getElementById('heavyCount').textContent = gameState.arrowCounts.heavy;
    document.getElementById('splitCount').textContent = gameState.arrowCounts.split;
}

function gameLoop() {
    if (!gameState.gameOver) {
        update();
    }
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    // Update charging
    if (gameState.isCharging && gameState.player && !gameState.player.dead) {
        gameState.chargePower = Math.min(gameState.chargePower + 1.2, MAX_POWER);
        updatePowerMeter();
    }
    
    // Update player
    if (gameState.player) {
        if (!gameState.player.update()) {
            gameState.player = null;
        }
    }
    
    // Update enemies
    gameState.enemies = gameState.enemies.filter(enemy => enemy.update());
    
    // Update arrows
    gameState.arrows = gameState.arrows.filter(arrow => {
        arrow.update();
        return arrow.active;
    });
    
    // Update particles
    gameState.particles = gameState.particles.filter(particle => {
        particle.update();
        return !particle.isDead();
    });
    
    // Update wind
    if (Math.random() < 0.01) {
        gameState.wind += (Math.random() - 0.5) * 0.1;
        gameState.wind = Math.max(-1, Math.min(1, gameState.wind));
    }
    
    // Spawn new enemies if needed
    if (gameState.enemies.length === 0 && !gameState.gameOver) {
        setTimeout(() => {
            spawnEnemies();
        }, 3000);
    }
    
    // Update UI
    updateHealthBar();
}

function draw() {
    // Clear canvas with sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#98FB98');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw ground
    ctx.fillStyle = '#228B22';
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
    
    // Draw ground line
    ctx.strokeStyle = '#1F5F1F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(canvas.width, GROUND_Y);
    ctx.stroke();
    
    // Draw platforms
    gameState.platforms.forEach(platform => platform.draw());
    
    // Draw wind indicator
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '14px Arial';
    ctx.fillText(`Wind: ${gameState.wind > 0 ? '→' : '←'} ${Math.abs(gameState.wind).toFixed(1)}`, canvas.width - 100, 25);
    
    // Draw controls hint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '10px Arial';
    ctx.fillText('Keys: 1-Regular 2-Fire 3-Heavy 4-Split | Mouse: Aim & Shoot', 10, canvas.height - 8);
    
    // Draw particles
    gameState.particles.forEach(particle => particle.draw());
    
    // Draw arrows
    gameState.arrows.forEach(arrow => arrow.draw());
    
    // Draw ragdolls
    if (gameState.player) {
        gameState.player.draw();
    }
    gameState.enemies.forEach(enemy => enemy.draw());
    
    // Debug info
    ctx.fillStyle = 'white';
    ctx.font = '10px Arial';
    ctx.fillText(`Player: ${gameState.player ? 'Yes' : 'No'}`, 10, 40);
    ctx.fillText(`Enemies: ${gameState.enemies.length}`, 10, 52);
    ctx.fillText(`Arrows: ${gameState.arrows.length}`, 10, 64);
    ctx.fillText(`Ground: ${GROUND_Y}`, 10, 76);
}

function restartGame() {
    gameState = {
        player: new Ragdoll(80, GROUND_Y - 80, true),
        enemies: [],
        arrows: [],
        particles: [],
        score: 0,
        gameOver: false,
        wind: Math.random() * 2 - 1,
        mousePos: { x: 0, y: 0 },
        isCharging: false,
        chargePower: 0,
        selectedArrowType: 'regular',
        arrowCounts: {
            fire: 10,
            heavy: 5,
            split: 3
        },
        keys: {},
        platforms: [
            new Platform(150, GROUND_Y - 40, 100, 30),
            new Platform(350, GROUND_Y - 70, 80, 40),
            new Platform(550, GROUND_Y - 30, 100, 20)
        ]
    };
    
    spawnEnemies();
    
    // Reset UI
    document.getElementById('gameOver').style.display = 'none';
    updateScore();
    updateHealthBar();
    updateArrowCounts();
    updatePowerMeter();
    
    // Reset arrow selection
    document.querySelector('.arrow-type.selected').classList.remove('selected');
    document.querySelector('.arrow-type[data-type="regular"]').classList.add('selected');
}

// Start the game when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, starting game...');
    init();
});

// Also start immediately in case DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}