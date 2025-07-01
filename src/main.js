// Game state
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const GRAVITY = 0.3;
const WIND_STRENGTH = 0.1;
const MAX_POWER = 100;
const ARROW_SPEED_MULTIPLIER = 0.15;

// Game state
let gameState = {
    player: null,
    enemies: [],
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
    }
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
        this.width = 40;
        this.height = 60;
        this.health = 100;
        this.maxHealth = 100;
        this.angle = 0;
        this.bowLength = 50;
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
        ctx.lineWidth = 4;
        ctx.beginPath();
        
        const bowX = Math.cos(this.angle) * 20;
        const bowY = Math.sin(this.angle) * 20;
        
        ctx.moveTo(bowX, bowY);
        ctx.lineTo(bowX + Math.cos(this.angle) * this.bowLength, bowY + Math.sin(this.angle) * this.bowLength);
        ctx.stroke();
        
        // Draw bow string
        if (gameState.isCharging) {
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            const stringOffset = gameState.chargePower * 0.3;
            const perpAngle = this.angle + Math.PI / 2;
            
            ctx.moveTo(bowX + Math.cos(perpAngle) * 15, bowY + Math.sin(perpAngle) * 15);
            ctx.lineTo(bowX - Math.cos(this.angle) * stringOffset, bowY - Math.sin(this.angle) * stringOffset);
            ctx.lineTo(bowX - Math.cos(perpAngle) * 15, bowY - Math.sin(perpAngle) * 15);
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
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        
        let x = this.x;
        let y = this.y;
        let velX = vx;
        let velY = vy;
        
        ctx.moveTo(x, y);
        
        for (let i = 0; i < 100; i++) {
            velY += GRAVITY;
            velX += gameState.wind * WIND_STRENGTH;
            x += velX;
            y += velY;
            
            if (x < 0 || x > canvas.width || y > canvas.height) break;
            
            if (i % 5 === 0) {
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
        if (gameState.chargePower < 10) return;
        
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
            this.x + Math.cos(this.angle) * 30,
            this.y + Math.sin(this.angle) * 30,
            vx, vy, arrowType
        );
        
        gameState.arrows.push(arrow);
        playSound('arrowRelease');
        
        gameState.chargePower = 0;
        gameState.isCharging = false;
        updatePowerMeter();
    }
}

// Enemy class
class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 35;
        this.height = 55;
        this.health = 50;
        this.maxHealth = 50;
        this.angle = 0;
        this.bowLength = 40;
        this.shootTimer = 0;
        this.shootCooldown = 120 + Math.random() * 120; // 2-4 seconds at 60fps
        this.moveTimer = 0;
        this.moveDirection = Math.random() * Math.PI * 2;
        this.speed = 0.5 + Math.random() * 0.5;
        this.chargePower = 0;
        this.isCharging = false;
    }
    
    update() {
        // AI movement
        this.moveTimer++;
        if (this.moveTimer > 180) { // Change direction every 3 seconds
            this.moveDirection = Math.random() * Math.PI * 2;
            this.moveTimer = 0;
        }
        
        // Move within bounds
        const newX = this.x + Math.cos(this.moveDirection) * this.speed;
        const newY = this.y + Math.sin(this.moveDirection) * this.speed;
        
        if (newX > 50 && newX < canvas.width - 50) {
            this.x = newX;
        }
        if (newY > 50 && newY < canvas.height - 50) {
            this.y = newY;
        }
        
        // Aim at player
        const dx = gameState.player.x - this.x;
        const dy = gameState.player.y - this.y;
        this.angle = Math.atan2(dy, dx);
        
        // Shooting AI
        this.shootTimer++;
        if (this.shootTimer > this.shootCooldown) {
            this.startCharging();
        }
        
        if (this.isCharging) {
            this.chargePower += 2;
            if (this.chargePower >= 60 + Math.random() * 40) {
                this.shoot();
            }
        }
    }
    
    startCharging() {
        this.isCharging = true;
        this.chargePower = 0;
    }
    
    shoot() {
        const power = this.chargePower;
        const velocity = power * ARROW_SPEED_MULTIPLIER * 0.8; // Enemies shoot slightly weaker
        const vx = Math.cos(this.angle) * velocity;
        const vy = Math.sin(this.angle) * velocity;
        
        const arrow = new Arrow(
            this.x + Math.cos(this.angle) * 25,
            this.y + Math.sin(this.angle) * 25,
            vx, vy, 'enemy'
        );
        
        gameState.arrows.push(arrow);
        
        this.chargePower = 0;
        this.isCharging = false;
        this.shootTimer = 0;
        this.shootCooldown = 120 + Math.random() * 120;
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Draw enemy body
        ctx.fillStyle = '#E74C3C';
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // Draw bow
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        const bowX = Math.cos(this.angle) * 15;
        const bowY = Math.sin(this.angle) * 15;
        
        ctx.moveTo(bowX, bowY);
        ctx.lineTo(bowX + Math.cos(this.angle) * this.bowLength, bowY + Math.sin(this.angle) * this.bowLength);
        ctx.stroke();
        
        // Draw health bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-25, -35, 50, 8);
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(-25, -35, (this.health / this.maxHealth) * 50, 8);
        
        ctx.restore();
    }
    
    takeDamage(damage) {
        this.health -= damage;
        if (this.health <= 0) {
            this.health = 0;
            return true; // Enemy is dead
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
    }
    
    getLength() {
        switch (this.type) {
            case 'heavy': return 25;
            case 'split': return 20;
            default: return 20;
        }
    }
    
    getDamage() {
        switch (this.type) {
            case 'fire': return 25;
            case 'heavy': return 35;
            case 'split': return 15;
            case 'enemy': return 20;
            default: return 20;
        }
    }
    
    update() {
        if (!this.active) return;
        
        // Store trail
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 8) {
            this.trail.shift();
        }
        
        // Apply physics
        this.vy += GRAVITY;
        
        // Apply wind (less effect on heavy arrows)
        const windEffect = this.type === 'heavy' ? 0.5 : 1;
        this.vx += gameState.wind * WIND_STRENGTH * windEffect;
        
        // Update position
        this.x += this.vx;
        this.y += this.vy;
        
        // Update angle
        this.angle = Math.atan2(this.vy, this.vx);
        
        // Split arrow logic
        if (this.type === 'split' && !this.hasSplit) {
            this.splitTimer++;
            if (this.splitTimer > 30) { // Split after 0.5 seconds
                this.split();
            }
        }
        
        // Check bounds
        if (this.x < 0 || this.x > canvas.width || this.y > canvas.height) {
            this.active = false;
        }
        
        // Check collisions
        this.checkCollisions();
    }
    
    split() {
        this.hasSplit = true;
        
        // Create two additional arrows
        const spreadAngle = 0.3;
        
        for (let i = 0; i < 2; i++) {
            const newAngle = this.angle + (i === 0 ? -spreadAngle : spreadAngle);
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy) * 0.8;
            
            const newArrow = new Arrow(
                this.x, this.y,
                Math.cos(newAngle) * speed,
                Math.sin(newAngle) * speed,
                'split'
            );
            newArrow.hasSplit = true; // Prevent infinite splitting
            
            gameState.arrows.push(newArrow);
        }
    }
    
    checkCollisions() {
        // Check collision with player (if enemy arrow)
        if (this.type === 'enemy') {
            const player = gameState.player;
            if (this.x > player.x - player.width/2 && this.x < player.x + player.width/2 &&
                this.y > player.y - player.height/2 && this.y < player.y + player.height/2) {
                player.takeDamage(this.damage);
                this.createImpactEffect();
                this.active = false;
                playSound('hit');
            }
        } else {
            // Check collision with enemies (if player arrow)
            for (let i = gameState.enemies.length - 1; i >= 0; i--) {
                const enemy = gameState.enemies[i];
                if (this.x > enemy.x - enemy.width/2 && this.x < enemy.x + enemy.width/2 &&
                    this.y > enemy.y - enemy.height/2 && this.y < enemy.y + enemy.height/2) {
                    
                    const isDead = enemy.takeDamage(this.damage);
                    this.createImpactEffect();
                    this.active = false;
                    playSound('hit');
                    
                    if (isDead) {
                        gameState.enemies.splice(i, 1);
                        gameState.score += 100;
                        updateScore();
                        
                        // Spawn new enemy
                        setTimeout(() => {
                            spawnEnemy();
                        }, 2000);
                    }
                    
                    break;
                }
            }
        }
    }
    
    createImpactEffect() {
        // Create particles
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
        
        // Fire arrow creates fire particles
        if (this.type === 'fire') {
            for (let i = 0; i < 15; i++) {
                const particle = new Particle(
                    this.x + (Math.random() - 0.5) * 20,
                    this.y + (Math.random() - 0.5) * 20,
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
            ctx.fillRect(this.trail[i].x - 1, this.trail[i].y - 1, 2, 2);
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
        ctx.lineTo(this.length/2 - 8, -4);
        ctx.lineTo(this.length/2 - 8, 4);
        ctx.closePath();
        ctx.fill();
        
        // Draw fletching
        ctx.fillStyle = '#654321';
        ctx.fillRect(-this.length/2, -3, 6, 6);
        
        // Special effects
        if (this.type === 'fire') {
            // Fire trail
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#ff6600';
            ctx.fillRect(-this.length/2, -1, this.length, 2);
        }
        
        ctx.restore();
    }
    
    getArrowColor() {
        switch (this.type) {
            case 'fire': return '#ff4444';
            case 'heavy': return '#444444';
            case 'split': return '#4444ff';
            case 'enemy': return '#cc2222';
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
        this.vy += 0.1; // Gravity
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

// Game functions
function init() {
    initAudio();
    
    // Create player
    gameState.player = new Player(100, canvas.height / 2);
    
    // Create initial enemies
    for (let i = 0; i < 3; i++) {
        spawnEnemy();
    }
    
    // Event listeners
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    
    // Arrow type selection
    document.querySelectorAll('.arrow-type').forEach(element => {
        element.addEventListener('click', () => {
            document.querySelector('.arrow-type.selected').classList.remove('selected');
            element.classList.add('selected');
            gameState.selectedArrowType = element.dataset.type;
        });
    });
    
    // Start game loop
    gameLoop();
}

function spawnEnemy() {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const x = side === 'left' ? canvas.width - 100 : canvas.width - 200 - Math.random() * 400;
    const y = 100 + Math.random() * (canvas.height - 200);
    
    gameState.enemies.push(new Enemy(x, y));
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
        gameState.chargePower = Math.min(gameState.chargePower + 2, MAX_POWER);
        updatePowerMeter();
    }
    
    // Update game objects
    gameState.player.update();
    
    gameState.enemies.forEach(enemy => enemy.update());
    
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
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw ground
    ctx.fillStyle = '#228B22';
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
    
    // Draw wind indicator
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '16px Arial';
    ctx.fillText(`Wind: ${gameState.wind > 0 ? '→' : '←'} ${Math.abs(gameState.wind).toFixed(1)}`, canvas.width - 150, 30);
    
    // Draw game objects
    gameState.particles.forEach(particle => particle.draw());
    gameState.arrows.forEach(arrow => arrow.draw());
    gameState.player.draw();
    gameState.enemies.forEach(enemy => enemy.draw());
}

function restartGame() {
    gameState = {
        player: new Player(100, canvas.height / 2),
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
        }
    };
    
    // Spawn initial enemies
    for (let i = 0; i < 3; i++) {
        spawnEnemy();
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