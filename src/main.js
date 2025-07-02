// Game state
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const GRAVITY = 0.08; // Reduced gravity for longer travel
const WIND_STRENGTH = 0.05;
const MAX_POWER = 50;
const ARROW_SPEED_MULTIPLIER = 0.2; // Increased for longer travel

// Game state
let gameState = {
    player: null,
    platforms: [], // Changed from enemies to platforms
    arrows: [],
    particles: [],
    score: 0,
    gameOver: false,
    wind: Math.random() * 2 - 1, // -1 to 1
    mousePos: { x: 0, y: 0 },
    isCharging: false,
    chargePower: 0,
    selectedArrowType: 'regular',
    arrowCounts: {
        fire: 10,
        heavy: 5,
        split: 3
    },
    keys: {} // Track pressed keys
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
    // Bow draw sound
    sounds.bowDraw = createTone(200, 0.1, 'sawtooth');
    // Arrow release sound
    sounds.arrowRelease = createTone(400, 0.2, 'triangle');
    // Hit sound
    sounds.hit = createTone(150, 0.3, 'square');
    // Fire arrow sound
    sounds.fire = createTone(300, 0.4, 'sawtooth');
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

// Player class
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 48;
        this.health = 100;
        this.maxHealth = 100;
        this.angle = 0;
        this.bowLength = 40;
    }
    
    update() {
        // Calculate angle to mouse
        const dx = gameState.mousePos.x - this.x;
        const dy = gameState.mousePos.y - this.y;
        this.angle = Math.atan2(dy, dx);
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Draw player body
        ctx.fillStyle = '#4A90E2';
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // Draw bow
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        const bowX = Math.cos(this.angle) * 16;
        const bowY = Math.sin(this.angle) * 16;
        
        ctx.moveTo(bowX, bowY);
        ctx.lineTo(bowX + Math.cos(this.angle) * this.bowLength, bowY + Math.sin(this.angle) * this.bowLength);
        ctx.stroke();
        
        // Draw bow string
        if (gameState.isCharging) {
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            const stringOffset = gameState.chargePower * 0.4;
            const perpAngle = this.angle + Math.PI / 2;
            
            ctx.moveTo(bowX + Math.cos(perpAngle) * 12, bowY + Math.sin(perpAngle) * 12);
            ctx.lineTo(bowX - Math.cos(this.angle) * stringOffset, bowY - Math.sin(this.angle) * stringOffset);
            ctx.lineTo(bowX - Math.cos(perpAngle) * 12, bowY - Math.sin(perpAngle) * 12);
            ctx.stroke();
        }
        
        // Draw trajectory prediction
        if (gameState.isCharging) {
            this.drawTrajectoryPrediction();
        }
        
        ctx.restore();
    }
    
    drawTrajectoryPrediction() {
        const power = gameState.chargePower;
        const velocity = power * ARROW_SPEED_MULTIPLIER;
        const vx = Math.cos(this.angle) * velocity;
        const vy = Math.sin(this.angle) * velocity;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        
        let x = this.x;
        let y = this.y;
        let velX = vx;
        let velY = vy;
        
        ctx.moveTo(x, y);
        
        for (let i = 0; i < 80; i++) { // Increased prediction length
            velY += GRAVITY;
            velX += gameState.wind * WIND_STRENGTH;
            x += velX;
            y += velY;
            
            if (x < 0 || x > canvas.width || y > canvas.height) break;
            
            if (i % 3 === 0) {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    takeDamage(damage) {
        this.health -= damage;
        if (this.health <= 0) {
            this.health = 0;
            gameState.gameOver = true;
            document.getElementById('gameOver').style.display = 'block';
            document.getElementById('finalScore').textContent = gameState.score;
        }
        updateHealthBar();
    }
    
    shoot() {
        if (gameState.chargePower < 3) return;
        
        const arrowType = gameState.selectedArrowType;
        
        // Check ammo
        if (arrowType !== 'regular' && gameState.arrowCounts[arrowType] <= 0) {
            return;
        }
        
        // Consume ammo
        if (arrowType !== 'regular') {
            gameState.arrowCounts[arrowType]--;
            updateArrowCounts();
        }
        
        const power = gameState.chargePower;
        const velocity = power * ARROW_SPEED_MULTIPLIER;
        const vx = Math.cos(this.angle) * velocity;
        const vy = Math.sin(this.angle) * velocity;
        
        const arrow = new Arrow(
            this.x + Math.cos(this.angle) * 24,
            this.y + Math.sin(this.angle) * 24,
            vx, vy, arrowType
        );
        
        gameState.arrows.push(arrow);
        playSound('arrowRelease');
        
        gameState.chargePower = 0;
        gameState.isCharging = false;
        updatePowerMeter();
    }
}

// Platform class (replaces Enemy)
class Platform {
    constructor(x, y, type = 'basic') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = this.getWidth();
        this.height = this.getHeight();
        this.health = this.getMaxHealth();
        this.maxHealth = this.getMaxHealth();
        this.color = this.getColor();
        this.points = this.getPoints();
        this.destroyed = false;
        
        // Visual effects
        this.hitFlash = 0;
        this.particles = [];
    }
    
    getWidth() {
        switch (this.type) {
            case 'small': return 40;
            case 'large': return 80;
            case 'moving': return 50;
            default: return 60; // basic
        }
    }
    
    getHeight() {
        switch (this.type) {
            case 'small': return 30;
            case 'large': return 60;
            case 'moving': return 40;
            default: return 40; // basic
        }
    }
    
    getMaxHealth() {
        switch (this.type) {
            case 'small': return 30;
            case 'large': return 100;
            case 'moving': return 60;
            default: return 50; // basic
        }
    }
    
    getColor() {
        switch (this.type) {
            case 'small': return '#E74C3C';
            case 'large': return '#8E44AD';
            case 'moving': return '#F39C12';
            default: return '#E67E22'; // basic
        }
    }
    
    getPoints() {
        switch (this.type) {
            case 'small': return 150;
            case 'large': return 200;
            case 'moving': return 300;
            default: return 100; // basic
        }
    }
    
    update() {
        // Moving platforms oscillate up and down
        if (this.type === 'moving') {
            this.y += Math.sin(Date.now() * 0.003) * 0.8;
        }
        
        // Update hit flash
        if (this.hitFlash > 0) {
            this.hitFlash--;
        }
        
        // Update particles
        this.particles = this.particles.filter(particle => {
            particle.update();
            return !particle.isDead();
        });
    }
    
    draw() {
        if (this.destroyed) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Flash effect when hit
        if (this.hitFlash > 0) {
            ctx.fillStyle = '#FFFFFF';
        } else {
            ctx.fillStyle = this.color;
        }
        
        // Draw platform base
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // Draw platform details based on type
        ctx.fillStyle = this.getDarkerColor();
        
        if (this.type === 'small') {
            // Simple target circle
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'large') {
            // Bullseye target
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = this.getDarkerColor();
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'moving') {
            // Diamond shape
            ctx.beginPath();
            ctx.moveTo(0, -15);
            ctx.lineTo(15, 0);
            ctx.lineTo(0, 15);
            ctx.lineTo(-15, 0);
            ctx.closePath();
            ctx.fill();
        } else {
            // Basic rectangular target
            ctx.fillRect(-15, -10, 30, 20);
        }
        
        // Draw health bar
        const barWidth = this.width - 10;
        const barHeight = 6;
        const barY = -this.height/2 - 12;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-barWidth/2, barY, barWidth, barHeight);
        
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = healthPercent > 0.5 ? '#2ECC71' : healthPercent > 0.25 ? '#F39C12' : '#E74C3C';
        ctx.fillRect(-barWidth/2, barY, barWidth * healthPercent, barHeight);
        
        // Draw particles
        this.particles.forEach(particle => particle.draw());
        
        ctx.restore();
    }
    
    getDarkerColor() {
        switch (this.type) {
            case 'small': return '#C0392B';
            case 'large': return '#6C3483';
            case 'moving': return '#D68910';
            default: return '#D35400'; // basic
        }
    }
    
    takeDamage(damage) {
        this.health -= damage;
        this.hitFlash = 10;
        
        // Create hit particles
        for (let i = 0; i < 5; i++) {
            const particle = new Particle(
                (Math.random() - 0.5) * this.width,
                (Math.random() - 0.5) * this.height,
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4,
                this.color,
                20 + Math.random() * 20
            );
            this.particles.push(particle);
        }
        
        if (this.health <= 0) {
            this.health = 0;
            this.destroyed = true;
            
            // Create destruction particles
            for (let i = 0; i < 15; i++) {
                const particle = new Particle(
                    (Math.random() - 0.5) * this.width,
                    (Math.random() - 0.5) * this.height,
                    (Math.random() - 0.5) * 8,
                    (Math.random() - 0.5) * 8,
                    this.color,
                    40 + Math.random() * 30
                );
                gameState.particles.push(particle);
            }
            
            return true; // Platform is destroyed
        }
        return false;
    }
}

// Arrow class
class Arrow {
    constructor(x, y, vx, vy, type = 'regular') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.type = type;
        this.angle = Math.atan2(vy, vx);
        this.length = this.getLength();
        this.damage = this.getDamage();
        this.trail = [];
        this.active = true;
        this.splitTimer = 0;
        this.hasSplit = false;
        this.bounceCount = 0; // For ground bouncing
    }
    
    getLength() {
        switch (this.type) {
            case 'heavy': return 24;
            case 'split': return 18;
            default: return 18;
        }
    }
    
    getDamage() {
        switch (this.type) {
            case 'fire': return 30;
            case 'heavy': return 45;
            case 'split': return 20;
            default: return 25;
        }
    }
    
    update() {
        if (!this.active) return;
        
        // Store trail
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 12) {
            this.trail.shift();
        }
        
        // Apply physics
        this.vy += GRAVITY;
        
        // Apply wind (less effect on heavy arrows)
        const windEffect = this.type === 'heavy' ? 0.3 : 1;
        this.vx += gameState.wind * WIND_STRENGTH * windEffect;
        
        // Update position
        this.x += this.vx;
        this.y += this.vy;
        
        // Update angle
        this.angle = Math.atan2(this.vy, this.vx);
        
        // Split arrow logic - Fixed to work properly
        if (this.type === 'split' && !this.hasSplit) {
            this.splitTimer++;
            if (this.splitTimer > 20) { // Split after a bit of travel
                this.split();
            }
        }
        
        // Ground bounce for arrows (optional - makes them travel further)
        if (this.y > canvas.height - 40 && this.vy > 0 && this.bounceCount < 2) {
            this.vy = -this.vy * 0.6; // Bounce with energy loss
            this.y = canvas.height - 40;
            this.bounceCount++;
        }
        
        // Check bounds - arrows now travel much further
        if (this.x < -100 || this.x > canvas.width + 100 || this.y > canvas.height + 100) {
            this.active = false;
        }
        
        // Check collisions
        this.checkCollisions();
    }
    
    split() {
        if (this.hasSplit) return; // Prevent multiple splits
        
        this.hasSplit = true;
        
        // Create two additional arrows with proper spread
        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const spreadAngle = 0.5; // Wider spread
        
        // Left arrow
        const leftAngle = this.angle - spreadAngle;
        const leftArrow = new Arrow(
            this.x, this.y,
            Math.cos(leftAngle) * currentSpeed * 0.9,
            Math.sin(leftAngle) * currentSpeed * 0.9,
            'split'
        );
        leftArrow.hasSplit = true; // Prevent infinite splitting
        
        // Right arrow
        const rightAngle = this.angle + spreadAngle;
        const rightArrow = new Arrow(
            this.x, this.y,
            Math.cos(rightAngle) * currentSpeed * 0.9,
            Math.sin(rightAngle) * currentSpeed * 0.9,
            'split'
        );
        rightArrow.hasSplit = true; // Prevent infinite splitting
        
        gameState.arrows.push(leftArrow, rightArrow);
    }
    
    checkCollisions() {
        // Check collision with platforms
        for (let i = gameState.platforms.length - 1; i >= 0; i--) {
            const platform = gameState.platforms[i];
            if (platform.destroyed) continue;
            
            if (this.x > platform.x - platform.width/2 && this.x < platform.x + platform.width/2 &&
                this.y > platform.y - platform.height/2 && this.y < platform.y + platform.height/2) {
                
                const isDestroyed = platform.takeDamage(this.damage);
                this.createImpactEffect();
                this.active = false;
                playSound('hit');
                
                if (isDestroyed) {
                    gameState.score += platform.points;
                    updateScore();
                    
                    // Remove destroyed platform
                    gameState.platforms.splice(i, 1);
                    
                    // Spawn new platform after delay
                    setTimeout(() => {
                        spawnPlatform();
                    }, 2000);
                }
                
                break;
            }
        }
    }
    
    createImpactEffect() {
        // Create particles
        for (let i = 0; i < 12; i++) {
            const particle = new Particle(
                this.x, this.y,
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8,
                this.getParticleColor(),
                40 + Math.random() * 30
            );
            gameState.particles.push(particle);
        }
        
        // Fire arrow creates fire particles
        if (this.type === 'fire') {
            for (let i = 0; i < 20; i++) {
                const particle = new Particle(
                    this.x + (Math.random() - 0.5) * 20,
                    this.y + (Math.random() - 0.5) * 20,
                    (Math.random() - 0.5) * 6,
                    -Math.random() * 4,
                    `hsl(${Math.random() * 60}, 100%, 50%)`,
                    80 + Math.random() * 60
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
            const alpha = i / this.trail.length * 0.7;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = this.getArrowColor();
            const size = 2 + (i / this.trail.length) * 2;
            ctx.fillRect(this.trail[i].x - size/2, this.trail[i].y - size/2, size, size);
        }
        
        ctx.globalAlpha = 1;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Draw arrow shaft
        ctx.fillStyle = this.getArrowColor();
        ctx.fillRect(-this.length/2, -2, this.length, 4);
        
        // Draw arrow head
        ctx.beginPath();
        ctx.moveTo(this.length/2, 0);
        ctx.lineTo(this.length/2 - 8, -5);
        ctx.lineTo(this.length/2 - 8, 5);
        ctx.closePath();
        ctx.fill();
        
        // Draw fletching
        ctx.fillStyle = '#654321';
        ctx.fillRect(-this.length/2, -4, 6, 8);
        
        // Special effects
        if (this.type === 'fire') {
            // Fire trail
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 15;
            ctx.fillStyle = '#ff6600';
            ctx.fillRect(-this.length/2, -2, this.length, 4);
        }
        
        ctx.restore();
    }
    
    getArrowColor() {
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
        this.vy += 0.05; // Gravity
        this.vx *= 0.98; // Air resistance
        this.life--;
    }
    
    draw() {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
        ctx.globalAlpha = 1;
    }
    
    isDead() {
        return this.life <= 0;
    }
}

// Arrow selection functions
function selectArrowType(type) {
    // Check if we have ammo for this arrow type
    if (type !== 'regular' && gameState.arrowCounts[type] <= 0) {
        return; // Can't select if no ammo
    }
    
    gameState.selectedArrowType = type;
    
    // Update UI
    document.querySelector('.arrow-type.selected').classList.remove('selected');
    document.querySelector(`.arrow-type[data-type="${type}"]`).classList.add('selected');
}

// Game functions
function init() {
    initAudio();
    
    // Create player
    gameState.player = new Player(80, canvas.height / 2);
    
    // Create initial platforms
    for (let i = 0; i < 4; i++) {
        spawnPlatform();
    }
    
    // Event listeners
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    
    // Keyboard event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Arrow type selection
    document.querySelectorAll('.arrow-type').forEach(element => {
        element.addEventListener('click', () => {
            selectArrowType(element.dataset.type);
        });
    });
    
    // Start game loop
    gameLoop();
}

function spawnPlatform() {
    const types = ['basic', 'small', 'large', 'moving'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    // Spawn on the right side of the screen
    const x = canvas.width - 100 - Math.random() * 300;
    const y = 80 + Math.random() * (canvas.height - 200);
    
    gameState.platforms.push(new Platform(x, y, type));
}

function handleMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    gameState.mousePos.x = event.clientX - rect.left;
    gameState.mousePos.y = event.clientY - rect.top;
}

function handleMouseDown(event) {
    if (gameState.gameOver) return;
    
    gameState.isCharging = true;
    gameState.chargePower = 0;
    
    // Start charging sound
    playSound('bowDraw');
}

function handleMouseUp(event) {
    if (gameState.gameOver) return;
    
    if (gameState.isCharging) {
        gameState.player.shoot();
    }
}

function handleKeyDown(event) {
    gameState.keys[event.key] = true;
    
    // Arrow selection with number keys
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
    healthFill.style.width = (gameState.player.health / gameState.player.maxHealth * 100) + '%';
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
    if (gameState.isCharging) {
        gameState.chargePower = Math.min(gameState.chargePower + 1.5, MAX_POWER);
        updatePowerMeter();
    }
    
    // Update game objects
    gameState.player.update();
    
    gameState.platforms.forEach(platform => platform.update());
    
    gameState.arrows = gameState.arrows.filter(arrow => {
        arrow.update();
        return arrow.active;
    });
    
    gameState.particles = gameState.particles.filter(particle => {
        particle.update();
        return !particle.isDead();
    });
    
    // Update wind occasionally
    if (Math.random() < 0.01) {
        gameState.wind += (Math.random() - 0.5) * 0.1;
        gameState.wind = Math.max(-1, Math.min(1, gameState.wind));
    }
    
    // Check if we need more platforms
    const activePlatforms = gameState.platforms.filter(p => !p.destroyed).length;
    if (activePlatforms < 2) {
        spawnPlatform();
    }
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw ground
    ctx.fillStyle = '#228B22';
    ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
    
    // Draw wind indicator
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '16px Arial';
    ctx.fillText(`Wind: ${gameState.wind > 0 ? '→' : '←'} ${Math.abs(gameState.wind).toFixed(1)}`, canvas.width - 120, 30);
    
    // Draw keyboard controls hint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '12px Arial';
    ctx.fillText('Keys: 1-Regular 2-Fire 3-Heavy 4-Split', 10, canvas.height - 10);
    
    // Draw game objects
    gameState.particles.forEach(particle => particle.draw());
    gameState.arrows.forEach(arrow => arrow.draw());
    gameState.player.draw();
    gameState.platforms.forEach(platform => platform.draw());
}

function restartGame() {
    gameState = {
        player: new Player(80, canvas.height / 2),
        platforms: [],
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
        keys: {}
    };
    
    // Spawn initial platforms
    for (let i = 0; i < 4; i++) {
        spawnPlatform();
    }
    
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

// Start the game
init();