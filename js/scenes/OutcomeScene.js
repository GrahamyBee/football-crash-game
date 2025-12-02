class OutcomeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'OutcomeScene' });
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Get game data
        this.selectedStake = this.registry.get('selectedStake');
        this.won = this.registry.get('won');
        this.cashedOut = this.registry.get('cashedOut') || false;
        this.finalValue = this.registry.get('finalValue') || 0;
        this.finalMultiplier = this.registry.get('finalMultiplier') || 0;
        
        // Update wallet if won
        if (this.won) {
            const currentBalance = this.registry.get('walletBalance');
            const winnings = Math.round(this.finalValue * 100); // Convert to pence
            this.registry.set('walletBalance', currentBalance + winnings);
        }
        
        // Background
        const bgColor = this.won ? 0x1b5e20 : 0x8b0000;
        this.add.rectangle(0, 0, width, height, bgColor).setOrigin(0);
        
        // Outcome panel
        const panelWidth = Math.min(600, width - 40);
        const panelHeight = 500;
        const panelX = width / 2;
        const panelY = height / 2;
        
        const panel = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x1a1a1a);
        panel.setStrokeStyle(6, this.won ? 0x4CAF50 : 0xff0000);
        
        // Title
        let title = '';
        if (this.won && this.cashedOut) {
            title = 'CASHED OUT!';
        } else if (this.won) {
            title = 'YOU WIN!';
        } else {
            title = 'GAME OVER';
        }
        
        this.add.text(panelX, panelY - 180, title, {
            fontSize: '56px',
            fontStyle: 'bold',
            fill: this.won ? '#00ff00' : '#ff0000'
        }).setOrigin(0.5);
        
        // Stake info
        const stakeLabel = this.selectedStake < 100 
            ? `${this.selectedStake}p` 
            : `£${(this.selectedStake / 100).toFixed(2)}`;
            
        this.add.text(panelX, panelY - 100, `Stake: ${stakeLabel}`, {
            fontSize: '24px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        // Show results
        if (this.won) {
            // Multiplier
            this.add.text(panelX, panelY - 50, `Total Multiplier: ${this.finalMultiplier.toFixed(2)}x`, {
                fontSize: '28px',
                fontStyle: 'bold',
                fill: '#ffff00'
            }).setOrigin(0.5);
            
            // Winnings
            this.add.text(panelX, panelY + 10, `WINNINGS`, {
                fontSize: '24px',
                fill: '#ffffff'
            }).setOrigin(0.5);
            
            const winAmount = this.add.text(panelX, panelY + 60, `£${this.finalValue.toFixed(2)}`, {
                fontSize: '64px',
                fontStyle: 'bold',
                fill: '#00ff00',
                stroke: '#000000',
                strokeThickness: 6
            }).setOrigin(0.5);
            
            // Animate winnings
            winAmount.setScale(0);
            this.tweens.add({
                targets: winAmount,
                scale: 1,
                duration: 800,
                ease: 'Back.easeOut'
            });
        } else {
            // Loss message
            this.add.text(panelX, panelY - 20, 'Better luck next time!', {
                fontSize: '28px',
                fill: '#ffffff'
            }).setOrigin(0.5);
            
            this.add.text(panelX, panelY + 30, `You lost £${(this.selectedStake / 100).toFixed(2)}`, {
                fontSize: '24px',
                fill: '#ff8888'
            }).setOrigin(0.5);
        }
        
        // Buttons
        this.createButton(panelX, panelY + 140, 'PLAY AGAIN', () => this.playAgain(), 0x4CAF50);
    }
    
    createButton(x, y, text, callback, color) {
        const button = this.add.container(x, y);
        
        const bg = this.add.rectangle(0, 0, 300, 60, color);
        
        const label = this.add.text(0, 0, text, {
            fontSize: '24px',
            fontStyle: 'bold',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        button.add([bg, label]);
        button.bg = bg;
        button.originalColor = color;
        
        // Make container interactive
        button.setSize(300, 60);
        button.setInteractive({ useHandCursor: true });
        
        // Use pointerdown for more reliable interaction
        button.on('pointerdown', () => {
            if (callback && typeof callback === 'function') {
                callback.call(this);
            }
        });
        
        return button;
    }
    
    playAgain() {
        // Reset registry
        this.registry.set('selectedPlayer', null);
        this.registry.set('selectedStake', null);
        this.registry.set('currentMultiplier', 0);
        this.registry.set('activePlayers', [true, true, true, true]);
        this.registry.set('playerPositions', [0, 0, 0, 0]);
        this.registry.set('won', false);
        this.registry.set('cashedOut', false);
        
        // Return to selection
        this.scene.start('SelectionScene');
    }
}
