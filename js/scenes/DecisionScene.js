class DecisionScene extends Phaser.Scene {
    constructor() {
        super({ key: 'DecisionScene' });
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Get game data
        this.selectedPlayer = this.registry.get('selectedPlayer');
        this.selectedStake = this.registry.get('selectedStake');
        this.currentMultiplier = this.registry.get('currentMultiplier');
        this.activePlayers = this.registry.get('activePlayers');
        
        // Semi-transparent overlay
        this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0);
        
        // Decision panel
        const panelWidth = Math.min(500, width - 40);
        const panelHeight = 400;
        const panelX = width / 2;
        const panelY = height / 2;
        
        const panel = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x1a1a1a);
        panel.setStrokeStyle(4, 0x4CAF50);
        
        // Title
        this.add.text(panelX, panelY - 160, 'DECISION TIME!', {
            fontSize: '32px',
            fontStyle: 'bold',
            fill: '#ffff00'
        }).setOrigin(0.5);
        
        // Cash value
        const cashValue = this.formatCashValue(this.currentMultiplier);
        this.add.text(panelX, panelY - 110, `Current Value: ${cashValue}`, {
            fontSize: '24px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        // Available options
        const buttonY = panelY - 40;
        const buttonSpacing = 80;
        
        // Continue button
        this.createButton(panelX, buttonY, 'CONTINUE', () => this.continue(), 0x2196F3);
        
        // Pass button (if other players are active)
        const otherActivePlayers = this.activePlayers.filter((active, index) => 
            active && index !== this.selectedPlayer
        );
        
        if (otherActivePlayers.length > 0) {
            this.createButton(panelX, buttonY + buttonSpacing, 'PASS', () => this.showPassOptions(), 0x9C27B0);
        }
        
        // Shoot button
        this.createButton(panelX, buttonY + buttonSpacing * 2, 'SHOOT', () => this.shoot(), 0xFF5722);
        
        // Cash out button
        this.createButton(panelX, buttonY + buttonSpacing * 3, 'CASH OUT', () => this.cashOut(), 0x4CAF50);
    }
    
    formatCashValue(multiplier) {
        const value = (this.selectedStake / 100) * multiplier;
        return `£${value.toFixed(2)}`;
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
    
    continue() {
        // Resume the running scene
        this.scene.stop();
        const runningScene = this.scene.get('RunningScene');
        runningScene.resumeRunning();
        this.scene.resume('RunningScene');
    }
    
    showPassOptions() {
        // Clear current UI
        this.children.removeAll();
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Overlay
        this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0);
        
        // Panel
        const panelWidth = Math.min(500, width - 40);
        const panelHeight = 400;
        const panelX = width / 2;
        const panelY = height / 2;
        
        const panel = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x1a1a1a);
        panel.setStrokeStyle(4, 0x9C27B0);
        
        // Title
        this.add.text(panelX, panelY - 160, 'PASS TO:', {
            fontSize: '32px',
            fontStyle: 'bold',
            fill: '#ffff00'
        }).setOrigin(0.5);
        
        // Show active players
        let buttonY = panelY - 80;
        
        this.activePlayers.forEach((active, index) => {
            if (active && index !== this.selectedPlayer) {
                const playerName = GameConfig.PLAYER_NAMES[index];
                this.createButton(panelX, buttonY, playerName, () => this.passTo(index), GameConfig.PLAYER_COLORS[index]);
                buttonY += 80;
            }
        });
        
        // Back button
        this.createButton(panelX, panelY + 140, 'BACK', () => {
            this.scene.restart();
        }, 0x666666);
    }
    
    passTo(playerIndex) {
        console.log('╔═══════════════════════════════════════╗');
        console.log('║  PASS BUTTON CLICKED - START         ║');
        console.log('╚═══════════════════════════════════════╝');
        console.log('Target player index:', playerIndex);
        console.log('Current selected player:', this.registry.get('selectedPlayer'));
        
        // Get running scene reference FIRST (before stopping anything)
        const runningScene = this.scene.get('RunningScene');
        console.log('Running scene found:', !!runningScene);
        console.log('Running scene paused?', runningScene.scene.isPaused());
        
        // Update registry
        this.registry.set('selectedPlayer', playerIndex);
        
        // Resume running scene FIRST
        console.log('Resuming running scene...');
        this.scene.resume('RunningScene');
        
        // Give scene one frame to resume properly
        setTimeout(() => {
            console.log('Calling handlePassAnimation after timeout...');
            runningScene.handlePassAnimation(playerIndex);
        }, 100);
        
        // Stop decision scene LAST
        console.log('Stopping decision scene...');
        this.scene.stop();
    }
    
    shoot() {
        // Transition to shooting scene
        this.scene.stop();
        this.scene.stop('RunningScene');
        this.scene.start('ShootingScene');
    }
    
    cashOut() {
        // Cash out - end game with current value
        const finalValue = (this.selectedStake / 100) * this.currentMultiplier;
        
        this.registry.set('finalMultiplier', this.currentMultiplier);
        this.registry.set('finalValue', finalValue);
        this.registry.set('won', true);
        this.registry.set('cashedOut', true);
        
        this.scene.stop();
        this.scene.stop('RunningScene');
        this.scene.start('OutcomeScene');
    }
}
