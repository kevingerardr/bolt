export class UIManager {
    constructor() {
        this.elements = {
            scoreValue: document.getElementById('scoreValue'),
            playerHealthFill: document.getElementById('playerHealthFill'),
            powerFill: document.getElementById('powerFill'),
            fireCount: document.getElementById('fireCount'),
            heavyCount: document.getElementById('heavyCount'),
            splitCount: document.getElementById('splitCount'),
            fireworkCount: document.getElementById('fireworkCount'),
            gameOver: document.getElementById('gameOver'),
            finalScore: document.getElementById('finalScore')
        };
        
        this._setupArrowSelection();
    }
    
    _setupArrowSelection() {
        document.querySelectorAll('.arrow-type').forEach(element => {
            element.addEventListener('click', () => {
                this.selectArrowType(element.dataset.type);
            });
        });
    }
    
    selectArrowType(type, gameState) {
        if (type !== 'regular' && gameState && gameState.arrowCounts[type] <= 0) {
            return;
        }
        
        if (gameState) {
            gameState.selectedArrowType = type;
        }
        
        document.querySelector('.arrow-type.selected').classList.remove('selected');
        document.querySelector(`.arrow-type[data-type="${type}"]`).classList.add('selected');
    }
    
    updatePowerMeter(chargePower, maxPower) {
        this.elements.powerFill.style.width = (chargePower / maxPower * 100) + '%';
    }
    
    updateHealthBar(health, maxHealth) {
        this.elements.playerHealthFill.style.width = (health / maxHealth * 100) + '%';
    }
    
    updateScore(score) {
        this.elements.scoreValue.textContent = score;
    }
    
    updateArrowCounts(arrowCounts) {
        this.elements.fireCount.textContent = arrowCounts.fire;
        this.elements.heavyCount.textContent = arrowCounts.heavy;
        this.elements.splitCount.textContent = arrowCounts.split;
        this.elements.fireworkCount.textContent = arrowCounts.firework;
    }
    
    showGameOver(score) {
        this.elements.gameOver.style.display = 'block';
        this.elements.finalScore.textContent = score;
    }
    
    hideGameOver() {
        this.elements.gameOver.style.display = 'none';
    }
}