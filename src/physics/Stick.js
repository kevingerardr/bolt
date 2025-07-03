import { JOINT_STIFFNESS } from '../constants.js';

export class Stick {
    constructor(joint1, joint2, length = null) {
        this.joint1 = joint1;
        this.joint2 = joint2;
        this.length = length || this._getDistance();
        this.thickness = 3;
    }
    
    _getDistance() {
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
    
    draw(ctx) {
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = this.thickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.joint1.x, this.joint1.y);
        ctx.lineTo(this.joint2.x, this.joint2.y);
        ctx.stroke();
    }
}