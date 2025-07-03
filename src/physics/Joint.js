import { GRAVITY, JOINT_DAMPING, GROUND_Y } from '../constants.js';

export class Joint {
    constructor(x, y, pinned = false) {
        this.x = x;
        this.y = y;
        this.oldX = x;
        this.oldY = y;
        this.pinned = pinned;
        this.radius = 4;
    }
    
    update(platforms = []) {
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
            this.oldY = this.y + velY * 0.3;
        }
        
        // Platform collisions
        this._handlePlatformCollisions(platforms, velY);
        
        // Side boundaries
        this._handleBoundaryCollisions(velX);
    }
    
    _handlePlatformCollisions(platforms, velY) {
        for (let platform of platforms) {
            if (this.x > platform.x && this.x < platform.x + platform.width &&
                this.y > platform.y - 5 && this.y < platform.y + platform.height + 5) {
                if (this.oldY <= platform.y) {
                    this.y = platform.y;
                    this.oldY = this.y + velY * 0.3;
                }
            }
        }
    }
    
    _handleBoundaryCollisions(velX) {
        if (this.x < 0) {
            this.x = 0;
            this.oldX = this.x - velX * 0.5;
        }
        if (this.x > 600) { // Updated canvas width
            this.x = 600;
            this.oldX = this.x - velX * 0.5;
        }
    }
    
    draw(ctx) {
        ctx.fillStyle = '#FFE4B5';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#DEB887';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}