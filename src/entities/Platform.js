export class Platform {
    constructor(x, y, width, height, isCollapsible = false) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.isCollapsible = isCollapsible;
        this.collapsed = false;
        this.collapseTimer = 0;
        this.maxCollapseTime = 120; // 2 seconds at 60fps
        this.shakeIntensity = 0;
    }
    
    update() {
        if (this.isCollapsible && this.collapseTimer > 0) {
            this.collapseTimer--;
            this.shakeIntensity = Math.sin(this.collapseTimer * 0.5) * 2;
            
            if (this.collapseTimer <= 0) {
                this.collapsed = true;
            }
        }
    }
    
    startCollapse() {
        if (this.isCollapsible && !this.collapsed && this.collapseTimer === 0) {
            this.collapseTimer = this.maxCollapseTime;
        }
    }
    
    draw(ctx) {
        if (this.collapsed) return;
        
        ctx.save();
        
        // Apply shake effect if collapsing
        if (this.shakeIntensity > 0) {
            ctx.translate(
                (Math.random() - 0.5) * this.shakeIntensity,
                (Math.random() - 0.5) * this.shakeIntensity
            );
        }
        
        // Change color based on state
        if (this.isCollapsible && this.collapseTimer > 0) {
            const intensity = this.collapseTimer / this.maxCollapseTime;
            ctx.fillStyle = `rgb(${139 + intensity * 100}, ${69 - intensity * 30}, 19)`;
        } else if (this.isCollapsible) {
            ctx.fillStyle = '#A0522D'; // Slightly different color for collapsible platforms
        } else {
            ctx.fillStyle = '#8B4513'; // Regular platform color
        }
        
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        ctx.strokeStyle = this.isCollapsible ? '#8B4513' : '#654321';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        
        // Draw cracks if collapsing
        if (this.isCollapsible && this.collapseTimer > 0) {
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 1;
            ctx.beginPath();
            
            // Draw some crack lines
            const crackProgress = 1 - (this.collapseTimer / this.maxCollapseTime);
            const numCracks = Math.floor(crackProgress * 5);
            
            for (let i = 0; i < numCracks; i++) {
                const startX = this.x + (this.width / (numCracks + 1)) * (i + 1);
                const startY = this.y;
                const endX = startX + (Math.random() - 0.5) * 20;
                const endY = this.y + this.height;
                
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
            }
            
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    // Check if a point is on this platform (for collision detection)
    isPointOn(x, y) {
        if (this.collapsed) return false;
        
        return x >= this.x && x <= this.x + this.width &&
               y >= this.y - 5 && y <= this.y + this.height + 5;
    }
}