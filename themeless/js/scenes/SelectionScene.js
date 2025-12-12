class SelectionScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SelectionScene' });
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Get wallet balance
        this.walletBalance = this.registry.get('walletBalance');
        
        // THEMELESS: Black background
        this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0);
        
        // Title
        this.add.text(width / 2, 40, 'CRASH GAME', {
            fontSize: '48px',
            fontStyle: 'bold',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        // Wallet balance display
        this.walletText = this.add.text(width / 2, 100, `Balance: £${(this.walletBalance / 100).toFixed(2)}`, {
            fontSize: '28px',
            fontStyle: 'bold',
            fill: '#ffff00',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        
        // Instructions
        this.add.text(width / 2, 150, 'Select Your Stake and Crashline', {
            fontSize: '24px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        // Stake selection
        this.createStakeSelection();
        
        // Player selection
        this.createPlayerSelection();
        
        // Confirm button (initially hidden) - centered
        this.confirmButton = this.createButton(
            width / 2,
            height - 80,
            'CONFIRM',
            () => this.showConfirmation(),
            0x4CAF50
        );
        this.confirmButton.setVisible(false);
        
        // Debug button (bottom right corner)
        this.createDebugButton();
        
        // Reset debug panel state when scene is created
        this.debugPanelVisible = false;
        this.debugPanel = null;
        
        // Track selections
        this.selectedStake = null;
        this.selectedPlayer = null;
    }
    
    createStakeSelection() {
        const width = this.cameras.main.width;
        const startY = 200;
        
        this.add.text(width / 2, startY, 'Select Stake:', {
            fontSize: '20px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        const stakes = GameConfig.STAKES;
        const buttonWidth = 100;
        const spacing = 120;
        const totalWidth = stakes.length * spacing - 20;
        const startX = (width - totalWidth) / 2;
        
        this.stakeButtons = [];
        
        stakes.forEach((stake, index) => {
            const x = startX + index * spacing + buttonWidth / 2;
            const y = startY + 50;
            const label = stake < 100 ? `${stake}p` : `£${stake / 100}`;
            
            const button = this.createStakeButton(x, y, label, stake);
            this.stakeButtons.push(button);
        });
    }
    
    createStakeButton(x, y, label, stake) {
        const button = this.add.container(x, y);
        
        // Check if player can afford this stake
        const canAfford = stake <= this.walletBalance;
        const bgColor = canAfford ? 0x2d8f3d : 0x555555;
        const textColor = canAfford ? '#ffffff' : '#999999';
        
        const bg = this.add.rectangle(0, 0, 90, 60, bgColor);
        const text = this.add.text(0, 0, label, {
            fontSize: '24px',
            fontStyle: 'bold',
            fill: textColor
        }).setOrigin(0.5);
        
        button.add([bg, text]);
        
        // Store properties
        button.bg = bg;
        button.text = text;
        button.stakeValue = stake;
        button.canAfford = canAfford;
        
        if (canAfford) {
            // Make container interactive
            button.setSize(90, 60);
            button.setInteractive({ useHandCursor: true });
            
            // Use pointerdown instead of pointerup - more reliable on mobile
            button.on('pointerdown', () => {
                this.selectStake(stake, button);
            });
        }
        
        return button;
    }
    
    selectStake(stake, button) {
        // Deselect all stakes
        this.stakeButtons.forEach(btn => {
            if (btn.canAfford) {
                btn.bg.setFillStyle(0x2d8f3d);
            }
        });
        
        // Select this stake
        button.bg.setFillStyle(0x4CAF50);
        this.selectedStake = stake;
        
        this.checkConfirmButton();
    }
    
    createPlayerSelection() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const startY = 380;
        
        this.add.text(width / 2, startY, 'Select Your Crashline:', {
            fontSize: '24px',
            fontStyle: 'bold',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        // THEMELESS: Create crashline buttons in 2x2 grid - simple squares with labels
        this.playerButtons = [];
        
        const horizontalSpacing = 300;
        const rowHeight = 200;
        const startYPos = startY + 100;
        
        // Grid positions: [row, col]
        const positions = [
            [0, 0], // Crashline 1: top-left
            [0, 1], // Crashline 2: top-right
            [1, 0], // Crashline 3: bottom-left
            [1, 1]  // Crashline 4: bottom-right
        ];
        
        for (let i = 0; i < 4; i++) {
            const [row, col] = positions[i];
            const x = width / 2 - horizontalSpacing / 2 + col * horizontalSpacing;
            const y = startYPos + row * rowHeight;
            
            const button = this.createPlayerButton(x, y, i);
            this.playerButtons.push(button);
        }
    }
    
    createPlayerButton(x, y, playerIndex) {
        const button = this.add.container(x, y);
        
        // THEMELESS: Create blue square
        const squareSize = 100;
        const square = this.add.rectangle(0, 0, squareSize, squareSize, 0x0000FF);
        square.setStrokeStyle(3, 0xFFFFFF);
        
        // Crashline label
        const nameText = this.add.text(0, squareSize / 2 + 30, `CRASHLINE ${playerIndex + 1}`, {
            fontSize: '24px',
            fontStyle: 'bold',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        
        // Add to button
        button.add([square, nameText]);
        
        // Store properties
        button.square = square;
        button.nameText = nameText;
        button.playerIndex = playerIndex;
        
        // Make interactive
        button.setSize(squareSize + 20, squareSize + 60);
        button.setInteractive({ useHandCursor: true });
        
        button.on('pointerdown', () => {
            this.selectPlayer(playerIndex, button);
        });
        
        return button;
    }
    
    selectPlayer(playerIndex, button) {
        // Deselect all players - reset text color and stroke to white/black
        this.playerButtons.forEach(btn => {
            if (btn.nameText) {
                btn.nameText.setFill('#ffffff');
                btn.nameText.setStroke('#000000', 3);
            }
        });
        
        // Select this player - change text color to yellow with thicker green stroke
        if (button.nameText) {
            button.nameText.setFill('#ffff00'); // Yellow text
            button.nameText.setStroke('#00ff00', 6); // Thick green stroke
        }
        
        this.selectedPlayer = playerIndex;
        
        this.checkConfirmButton();
    }
    
    checkConfirmButton() {
        if (this.selectedStake !== null && this.selectedPlayer !== null) {
            this.confirmButton.setVisible(true);
        }
    }
    
    showConfirmation() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Create overlay container for confirmation screen
        const overlay = this.add.container(0, 0);
        overlay.setDepth(1000); // Put on top of everything
        
        // Background overlay (semi-transparent)
        const bgOverlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8).setOrigin(0);
        overlay.add(bgOverlay);
        
        // Confirmation panel
        const panelWidth = Math.min(500, width - 40);
        const panelHeight = 400;
        const panelX = width / 2;
        const panelY = height / 2;
        
        const panel = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x1a1a1a);
        panel.setStrokeStyle(4, 0xffff00);
        overlay.add(panel);
        
        // Title
        const title = this.add.text(panelX, panelY - 140, 'CONFIRM YOUR BET', {
            fontSize: '36px',
            fontStyle: 'bold',
            fill: '#ffff00'
        }).setOrigin(0.5);
        overlay.add(title);
        
        // Stake info
        const stakeLabel = this.selectedStake < 100 
            ? `${this.selectedStake}p` 
            : `£${(this.selectedStake / 100).toFixed(2)}`;
        
        const stakeText = this.add.text(panelX, panelY - 70, `Stake: ${stakeLabel}`, {
            fontSize: '28px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        overlay.add(stakeText);
        
        // Player info
        const playerText = this.add.text(panelX, panelY - 20, `Footballer: ${GameConfig.PLAYER_NAMES[this.selectedPlayer]}`, {
            fontSize: '28px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        overlay.add(playerText);
        
        // New balance after bet
        const newBalance = this.walletBalance - this.selectedStake;
        const balanceText = this.add.text(panelX, panelY + 30, `New Balance: £${(newBalance / 100).toFixed(2)}`, {
            fontSize: '24px',
            fill: '#ffff00'
        }).setOrigin(0.5);
        overlay.add(balanceText);
        
        // Confirm button
        const confirmBtn = this.createConfirmButton(panelX - 100, panelY + 120, 'CONFIRM', () => {
            this.startGame();
        }, 0x4CAF50);
        overlay.add(confirmBtn);
        
        // Cancel button
        const cancelBtn = this.createConfirmButton(panelX + 100, panelY + 120, 'CANCEL', () => {
            this.scene.restart();
        }, 0xff5722);
        overlay.add(cancelBtn);
    }
    
    createConfirmButton(x, y, text, callback, color = 0x4CAF50) {
        const button = this.add.container(x, y);
        
        const bg = this.add.rectangle(0, 0, 180, 60, color);
        
        const label = this.add.text(0, 0, text, {
            fontSize: '24px',
            fontStyle: 'bold',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        button.add([bg, label]);
        
        // Make the container itself interactive
        button.setSize(180, 60);
        button.setInteractive({ useHandCursor: true });
        
        // Use pointerdown for more reliable mobile interaction
        button.on('pointerdown', () => {
            if (callback) callback.call(this);
        });
        
        return button;
    }
    
    createButton(x, y, text, callback, color = 0x4CAF50) {
        const button = this.add.container(x, y);
        
        const bg = this.add.rectangle(0, 0, 250, 60, color);
        
        const label = this.add.text(0, 0, text, {
            fontSize: '24px',
            fontStyle: 'bold',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        button.add([bg, label]);
        
        // Make the container itself interactive
        button.setSize(250, 60);
        button.setInteractive({ useHandCursor: true });
        
        // Use pointerdown for more reliable mobile interaction
        button.on('pointerdown', () => {
            if (callback) callback.call(this);
        });
        
        return button;
    }
    
    startGame() {
        // Deduct stake from wallet
        this.walletBalance -= this.selectedStake;
        this.registry.set('walletBalance', this.walletBalance);
        
        // Store selections in registry
        this.registry.set('selectedPlayer', this.selectedPlayer);
        this.registry.set('selectedStake', this.selectedStake);
        this.registry.set('currentMultiplier', 0);
        this.registry.set('activePlayers', [true, true, true, true]);
        this.registry.set('playerPositions', [0, 0, 0, 0]);
        this.registry.set('testModeEnabled', this.testModeEnabled); // Pass test mode to running scene
        
        // Start running scene
        this.scene.start('RunningScene');
    }
    
    createDebugButton() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const button = this.add.container(width - 80, height - 50);
        
        const bg = this.add.rectangle(0, 0, 140, 50, 0x666666);
        
        const label = this.add.text(0, 0, 'DEBUG', {
            fontSize: '20px',
            fontStyle: 'bold',
            fill: '#FFFFFF'
        }).setOrigin(0.5);
        
        button.add([bg, label]);
        
        button.setSize(140, 50);
        button.setInteractive({ useHandCursor: true });
        button.setDepth(1000);
        
        button.on('pointerdown', () => {
            this.toggleDebugPanel();
        });
        
        this.debugButton = button;
    }
    
    createDebugPanel() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Create panel container with all three debug options
        this.debugPanel = this.add.container(width - 200, height - 250);
        this.debugPanel.setDepth(2000);
        
        // Panel background
        const panelBg = this.add.rectangle(0, 0, 350, 220, 0x000000, 0.9);
        panelBg.setStrokeStyle(3, 0xFFD700);
        
        // Panel title
        const title = this.add.text(0, -90, 'DEBUG PANEL', {
            fontSize: '24px',
            fontStyle: 'bold',
            fill: '#FFD700'
        }).setOrigin(0.5);
        
        this.debugPanel.add([panelBg, title]);
        
        // Get current debug states
        const forceGoal = this.registry.get('forceGoal') || false;
        const forceBonus = this.registry.get('forceBonus') || false;
        const testMode = this.registry.get('testMode') || false;
        
        // Create three toggle buttons
        this.createDebugToggle('Force Goal', forceGoal, -50, (enabled) => {
            this.registry.set('forceGoal', enabled);
        });
        
        this.createDebugToggle('Force Bonus', forceBonus, 0, (enabled) => {
            this.registry.set('forceBonus', enabled);
        });
        
        this.createDebugToggle('Test Mode', testMode, 50, (enabled) => {
            this.registry.set('testMode', enabled);
        });
        
        // Hide initially
        this.debugPanel.setVisible(false);
    }
    
    createDebugToggle(labelText, initialState, yOffset, callback) {
        const toggleContainer = this.add.container(0, yOffset);
        
        const bg = this.add.rectangle(0, 0, 300, 40, initialState ? 0x4CAF50 : 0x666666);
        
        const label = this.add.text(0, 0, `${labelText}: ${initialState ? 'ON' : 'OFF'}`, {
            fontSize: '18px',
            fontStyle: 'bold',
            fill: '#FFFFFF'
        }).setOrigin(0.5);
        
        toggleContainer.add([bg, label]);
        toggleContainer.setSize(300, 40);
        toggleContainer.setInteractive({ useHandCursor: true });
        
        let enabled = initialState;
        
        toggleContainer.on('pointerdown', () => {
            enabled = !enabled;
            bg.setFillStyle(enabled ? 0x4CAF50 : 0x666666);
            label.setText(`${labelText}: ${enabled ? 'ON' : 'OFF'}`);
            callback(enabled);
        });
        
        this.debugPanel.add(toggleContainer);
    }
    
    toggleDebugPanel() {
        // Always recreate the panel to ensure it has the latest registry values
        if (!this.debugPanel || !this.debugPanel.scene) {
            this.createDebugPanel();
        }
        
        this.debugPanelVisible = !this.debugPanelVisible;
        this.debugPanel.setVisible(this.debugPanelVisible);
    }
    
    shutdown() {
        // Clean up event listeners when scene shuts down
        if (this.stakeButtons) {
            this.stakeButtons.forEach(btn => {
                if (btn.input) {
                    btn.removeAllListeners();
                }
            });
        }
        
        if (this.playerButtons) {
            this.playerButtons.forEach(btn => {
                if (btn.input) {
                    btn.removeAllListeners();
                }
            });
        }
        
        if (this.confirmButton && this.confirmButton.input) {
            this.confirmButton.removeAllListeners();
        }
    }
}
