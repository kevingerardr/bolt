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
                // Just update UI selection, don't pass gameState
                this._updateArrowSelection(element.dataset.type);
            });
        });
    }
    
    _updateArrowSelection(type) {
        // Remove previous selection
        const currentSelected = document.querySelector('.arrow-type.selected');
        if (currentSelected) {
            currentSelected.classList.remove('selected');
        }
        
        // Add new selection
        const newSelected = document.querySelector(`.arrow-type[data-type="${type}"]`);
        if (newSelected) {
            newSelected.classList.add('selected');
        }
    }
    
    selectArrowType(type, gameState = null) {
        // Check if we have enough arrows (only if gameState is provided)
        if (gameState && type !== 'regular' && gameState.arrowCounts[type] <= 0) {
            return;
        }
        
        // Update game state if provided
        if (gameState) {
            gameState.selectedArrowType = type;
        }
        
        // Update UI selection
        this._updateArrowSelection(type);
    }
    
    updatePowerMeter(chargePower, maxPower) {
        if (this.elements.powerFill) {
            this.elements.powerFill.style.width = (chargePower / maxPower * 100) + '%';
        }
    }
    
    updateHealthBar(health, maxHealth) {
        if (this.elements.playerHealthFill) {
            this.elements.playerHealthFill.style.width = (health / maxHealth * 100) + '%';
        }
    }
    
    updateScore(score) {
        if (this.elements.scoreValue) {
            this.elements.scoreValue.textContent = score;
        }
    }
    
    updateArrowCounts(arrowCounts) {
        if (this.elements.fireCount) this.elements.fireCount.textContent = arrowCounts.fire;
        if (this.elements.heavyCount) this.elements.heavyCount.textContent = arrowCounts.heavy;
        if (this.elements.splitCount) this.elements.splitCount.textContent = arrowCounts.split;
        if (this.elements.fireworkCount) this.elements.fireworkCount.textContent = arrowCounts.firework;
    }
    
    showGameOver(score) {
        if (this.elements.gameOver) {
            this.elements.gameOver.style.display = 'block';
        }
        if (this.elements.finalScore) {
            this.elements.finalScore.textContent = score;
        }
    }
    
    hideGameOver() {
        if (this.elements.gameOver) {
            this.elements.gameOver.style.display = 'none';
        }
    }
}