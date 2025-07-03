export class AudioManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.init();
    }
    
    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this._createSounds();
        } catch (e) {
            console.log('Audio not supported');
        }
    }
    
    _createSounds() {
        this.sounds.bowDraw = this._createTone(200, 0.1, 'sawtooth');
        this.sounds.arrowRelease = this._createTone(400, 0.2, 'triangle');
        this.sounds.hit = this._createTone(150, 0.3, 'square');
        this.sounds.fire = this._createTone(300, 0.4, 'sawtooth');
        this.sounds.death = this._createTone(100, 0.8, 'square');
    }
    
    _createTone(frequency, duration, type = 'sine') {
        return () => {
            if (!this.audioContext) return;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = type;
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        };
    }
    
    play(soundName) {
        if (this.sounds[soundName]) {
            this.sounds[soundName]();
        }
    }
}