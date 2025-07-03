import { Game } from './game/Game.js';

let game;

function init() {
    console.log('Initializing game...');
    
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    if (!canvas || !ctx) {
        console.error('Canvas not found!');
        return;
    }
    
    game = new Game(canvas, ctx);
}

function restartGame() {
    if (game) {
        game.restart();
    }
}

// Make restartGame available globally for the HTML button
window.restartGame = restartGame;

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