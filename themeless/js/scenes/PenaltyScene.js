class PenaltyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PenaltyScene' });
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Get game data
        this.currentPrize = this.registry.get('currentPrize') || 0;
        this.selectedStake = this.registry.get('selectedStake') || 100;
        
        // THEMELESS: Black background
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000);
        
        // Create 5 clickable zones with random multipliers
        this.createGoalZones();
        
        // Current prize display
        this.add.text(width / 2, 20, `Current Prize: £${(this.currentPrize / 100).toFixed(2)}`, {
            fontSize: '32px',
            fontStyle: 'bold',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        // Instructions
        this.add.text(width / 2, 70, 'PENALTY SHOOTOUT - SELECT A TARGET', {
            fontSize: '28px',
            fontStyle: 'bold',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        // Force Goal test button at bottom
        this.forceGoalEnabled = this.registry.get('forceGoal') || false;
        this.createForceGoalButton();
        
        this.penaltyTaken = false;
    }
    
    createGoalZones() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Goal area is at 33% down (moved up 2% from 35%), assume goal is about 400px wide and 200px tall
        const goalCenterX = width / 2;
        const goalCenterY = height * 0.33;
        const goalWidth = 500;
        const goalHeight = 250;
        
        // Define 5 zones: top-left, top-right, center, bottom-left, bottom-right
        const zoneDefinitions = [
            { name: 'top-left', x: goalCenterX - goalWidth * 0.25, y: goalCenterY - goalHeight * 0.25 },
            { name: 'top-right', x: goalCenterX + goalWidth * 0.25, y: goalCenterY - goalHeight * 0.25 },
            { name: 'center', x: goalCenterX, y: goalCenterY },
            { name: 'bottom-left', x: goalCenterX - goalWidth * 0.25, y: goalCenterY + goalHeight * 0.25 },
            { name: 'bottom-right', x: goalCenterX + goalWidth * 0.25, y: goalCenterY + goalHeight * 0.25 }
        ];
        
        // Multipliers to randomly assign (of the stake, not current prize)
        const multipliers = [1, 2, 5, 10, 25];
        
        // Shuffle multipliers
        const shuffled = Phaser.Utils.Array.Shuffle([...multipliers]);
        
        // Create zones with target design
        this.zones = [];
        zoneDefinitions.forEach((zoneDef, index) => {
            // Create target circles (concentric rings) - in front of goalkeeper
            const targetSize = 90;
            
            // Outer ring (red)
            const outerRing = this.add.circle(zoneDef.x, zoneDef.y, targetSize / 2, 0xff0000, 0.4).setDepth(10);
            
            // Middle ring (white)
            const middleRing = this.add.circle(zoneDef.x, zoneDef.y, targetSize / 3, 0xffffff, 0.4).setDepth(10);
            
            // Inner ring (red)
            const innerRing = this.add.circle(zoneDef.x, zoneDef.y, targetSize / 6, 0xff0000, 0.5).setDepth(10);
            
            // Invisible interactive zone on top
            const zone = this.add.rectangle(
                zoneDef.x,
                zoneDef.y,
                targetSize,
                targetSize,
                0x000000,
                0
            ).setInteractive({ useHandCursor: true }).setDepth(10);
            
            zone.zoneName = zoneDef.name;
            zone.multiplier = shuffled[index];
            zone.zoneX = zoneDef.x;
            zone.zoneY = zoneDef.y;
            zone.targetGraphics = [outerRing, middleRing, innerRing];
            
            // Hover effect - brighten all rings
            zone.on('pointerover', () => {
                outerRing.setAlpha(0.6);
                middleRing.setAlpha(0.6);
                innerRing.setAlpha(0.7);
            });
            
            zone.on('pointerout', () => {
                outerRing.setAlpha(0.4);
                middleRing.setAlpha(0.4);
                innerRing.setAlpha(0.5);
            });
            
            // Click to shoot
            zone.on('pointerdown', () => {
                if (!this.penaltyTaken) {
                    this.takePenalty(zone);
                }
            });
            
            this.zones.push(zone);
        });
    }
    
    takePenalty(selectedZone) {
        this.penaltyTaken = true;
        
        // Hide all zones and their graphics
        this.zones.forEach(zone => {
            zone.setVisible(false);
            zone.disableInteractive();
            zone.targetGraphics.forEach(graphic => graphic.setVisible(false));
        });
        
        // Determine if it's a goal or save
        const forceGoal = this.registry.get('forceGoal') || false;
        const isGoal = forceGoal ? true : (Math.random() > 0.5);
        
        // Get zone details
        const zoneName = selectedZone.zoneName;
        const multiplier = selectedZone.multiplier;
        const targetX = selectedZone.zoneX;
        const targetY = selectedZone.zoneY;
        
        if (isGoal) {
            this.handleGoal(zoneName, multiplier, targetX, targetY);
        } else {
            this.handleSave(zoneName, targetX, targetY);
        }
    }
    
    handleGoal(zoneName, multiplier, targetX, targetY) {
        // THEMELESS: Show GOAL text immediately
        const goalText = this.add.text(targetX, targetY, 'GOAL!', {
            fontSize: '80px',
            fontStyle: 'bold',
            fill: '#00FF00',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5).setDepth(150);
        
        // Calculate total win - multiplier is of the STAKE, not current prize
        const penaltyWin = this.selectedStake * multiplier;
        const totalWin = this.currentPrize + penaltyWin;
        
        // Store breakdown for OutcomeScene
        const crashMultiplier = this.currentPrize / this.selectedStake; // Crash game multiplier
        this.registry.set('crashMultiplier', crashMultiplier);
        this.registry.set('shootingMultiplier', multiplier); // Penalty multiplier (of stake)
        this.registry.set('crashWinAmount', this.currentPrize / 100); // Crash game winnings in pounds
        this.registry.set('penaltyWinAmount', penaltyWin / 100); // Penalty winnings in pounds
        this.registry.set('finalMultiplier', totalWin / this.selectedStake); // Total multiplier
        
        // Show multiplier below goal text
        const multiplierText = this.add.text(targetX, targetY + 80, `x${multiplier}`, {
            fontSize: '50px',
            fontStyle: 'bold',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(150);
        
        // Show win message
        this.time.delayedCall(1500, () => {
            this.showWinMessage(totalWin);
        });
    }
    
    handleSave(zoneName, targetX, targetY) {
        // THEMELESS: Show SAVED text immediately
        const savedText = this.add.text(targetX, targetY, 'SAVED!', {
            fontSize: '80px',
            fontStyle: 'bold',
            fill: '#FF0000',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5).setDepth(150);
        
        // Show loss message
        this.time.delayedCall(1500, () => {
            this.showLossMessage();
        });
    }
    
    showWinMessage(totalWin) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Add winnings to wallet
        const currentBalance = this.registry.get('walletBalance') || 0;
        this.registry.set('walletBalance', currentBalance + totalWin);
        
        // YOU WIN!!! text
        const youWinText = this.add.text(width / 2, height / 2 - 100, 'YOU WIN!!!', {
            fontSize: '100px',
            fontStyle: 'bold',
            fill: '#00FF00',
            stroke: '#000000',
            strokeThickness: 10
        }).setOrigin(0.5).setDepth(20);
        
        // You won text
        const winText = this.add.text(width / 2, height / 2, 'You won:', {
            fontSize: '50px',
            fontStyle: 'bold',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(20);
        
        const amountText = this.add.text(width / 2, height / 2 + 70, `£${(totalWin / 100).toFixed(2)}`, {
            fontSize: '70px',
            fontStyle: 'bold',
            fill: '#00FF00',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5).setDepth(20);
        
        // Wait then go to outcome scene
        this.time.delayedCall(3000, () => {
            console.log('THEMELESS: PenaltyScene - Goal scored, transitioning to OutcomeScene');
            
            // Stop all tweens and clear timers
            this.tweens.killAll();
            this.time.removeAllEvents();
            
            // Set registry values for OutcomeScene
            this.registry.set('won', true);
            this.registry.set('finalValue', totalWin / 100); // Convert to pounds
            this.registry.set('outcomeType', 'goal');
            
            // Add small delay before transition
            this.time.delayedCall(100, () => {
                this.scene.start('OutcomeScene');
            });
        });
    }
    
    showLossMessage() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // SAVED text
        const savedText = this.add.text(width / 2, height / 2 - 100, 'SAVED!', {
            fontSize: '80px',
            fontStyle: 'bold',
            fill: '#FF0000',
            stroke: '#000000',
            strokeThickness: 10
        }).setOrigin(0.5).setDepth(20);
        
        // Game over
        const gameOverText = this.add.text(width / 2, height / 2, 'GAME OVER', {
            fontSize: '60px',
            fontStyle: 'bold',
            fill: '#FF0000',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5).setDepth(20);
        
        const lostText = this.add.text(width / 2, height / 2 + 70, `You have lost £${(this.selectedStake / 100).toFixed(2)}`, {
            fontSize: '35px',
            fontStyle: 'bold',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(20);
        
        // Wait then go to outcome scene
        this.time.delayedCall(3000, () => {
            console.log('THEMELESS: PenaltyScene - Miss, transitioning to OutcomeScene');
            
            // Stop all tweens and clear timers
            this.tweens.killAll();
            this.time.removeAllEvents();
            
            // Set registry values for OutcomeScene
            this.registry.set('won', false);
            this.registry.set('finalValue', 0);
            this.registry.set('finalMultiplier', 0);
            this.registry.set('outcomeType', 'miss');
            
            // Add small delay before transition
            this.time.delayedCall(100, () => {
                this.scene.start('OutcomeScene');
            });
        });
    }
    
    createForceGoalButton() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const button = this.add.container(width / 2, height - 50);
        
        const bg = this.add.rectangle(0, 0, 250, 50, this.forceGoalEnabled ? 0xFFD700 : 0x666666);
        
        const label = this.add.text(0, 0, this.forceGoalEnabled ? 'FORCE GOAL: ON' : 'FORCE GOAL: OFF', {
            fontSize: '18px',
            fontStyle: 'bold',
            fill: '#000000'
        }).setOrigin(0.5);
        
        button.add([bg, label]);
        
        button.setSize(250, 50);
        button.setInteractive({ useHandCursor: true });
        
        button.on('pointerdown', () => {
            this.forceGoalEnabled = !this.forceGoalEnabled;
            this.registry.set('forceGoal', this.forceGoalEnabled);
            
            bg.setFillStyle(this.forceGoalEnabled ? 0xFFD700 : 0x666666);
            label.setText(this.forceGoalEnabled ? 'FORCE GOAL: ON' : 'FORCE GOAL: OFF');
        });
    }
}
