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
        
        // Get breakdown data for display
        this.crashMultiplier = this.registry.get('crashMultiplier') || 0;
        this.shootingMultiplier = this.registry.get('shootingMultiplier') || 0;
        this.crashWinAmount = this.registry.get('crashWinAmount') || 0;
        
        // Note: Wallet is already updated in the scene where the win occurred
        // (RunningScene or PenaltyScene), so we don't add winnings here
        
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
            // Get bonus win amount once for the entire display
            const bonusWinAmount = this.registry.get('bonusWinAmount') || 0;
            const totalWin = this.finalValue + bonusWinAmount;
            
            let currentY = panelY - 90;
            
            // Show crash game amount (without label to save space)
            this.add.text(panelX, currentY, `£${this.crashWinAmount.toFixed(2)}`, {
                fontSize: '32px',
                fontStyle: 'bold',
                fill: '#FFD700',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5);
            
            currentY += 50;
            
            // Show bonus round winnings if any
            if (bonusWinAmount > 0) {
                this.add.text(panelX, currentY, 'Bonus Round:', {
                    fontSize: '22px',
                    fill: '#ffffff'
                }).setOrigin(0.5);
                
                this.add.text(panelX, currentY + 30, `£${bonusWinAmount.toFixed(2)}`, {
                    fontSize: '32px',
                    fontStyle: 'bold',
                    fill: '#FF69B4',
                    stroke: '#000000',
                    strokeThickness: 4
                }).setOrigin(0.5);
                
                currentY += 70;
            }
            
            // Show multiplier (shooting or penalty)
            const multiplierLabel = this.shootingMultiplier === 10.0 ? 'Shooting Multiplier:' : 'Penalty Multiplier:';
            this.add.text(panelX, currentY, multiplierLabel, {
                fontSize: '22px',
                fill: '#ffffff'
            }).setOrigin(0.5);
            
            this.add.text(panelX, currentY + 30, `x${this.shootingMultiplier.toFixed(1)}`, {
                fontSize: '32px',
                fontStyle: 'bold',
                fill: '#00BFFF',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5);
            
            currentY += 70;
            
            // Show total winnings (including bonus if any)
            
            this.add.text(panelX, currentY, 'TOTAL WIN:', {
                fontSize: '26px',
                fontStyle: 'bold',
                fill: '#ffffff'
            }).setOrigin(0.5);
            
            const winAmount = this.add.text(panelX, currentY + 40, `£${totalWin.toFixed(2)}`, {
                fontSize: '48px',
                fontStyle: 'bold',
                fill: '#00ff00',
                stroke: '#000000',
                strokeThickness: 6
            }).setOrigin(0.5);
            
            // Animate total winnings
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
        
        // Buttons - position further down to avoid overlap
        this.createButton(panelX, panelY + 190, 'PLAY AGAIN', () => this.playAgain(), 0x4CAF50);
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
        this.registry.set('bonusWinAmount', 0); // Reset bonus winnings
        
        // Return to selection
        this.scene.start('SelectionScene');
    }
}
