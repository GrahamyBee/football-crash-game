class BonusRoundScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BonusRoundScene' });
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Get game data
        this.selectedStake = this.registry.get('selectedStake') || 100;
        
        // Background - stretched vertically by 20%
        const bg = this.add.image(width / 2, height / 2, 'penalty_background');
        const bgScale = width / bg.width;
        bg.setScale(bgScale, bgScale * 1.2); // Stretch vertically by 20%
        
        // Goalkeeper at center of goal (35% down screen)
        this.goalkeeper = this.add.image(width / 2, height * 0.35, 'goalkeeper')
            .setScale(0.525)
            .setDepth(1);
        
        // Create 5 clickable zones with cash amounts (in front of goalkeeper)
        this.createGoalZones();
        
        // Football at left or right side (10% padding from edges) - always on top
        const ballX = Math.random() > 0.5 ? width * 0.1 : width * 0.9;
        this.ball = this.add.image(ballX, height * 0.71, 'football')
            .setScale(0.15)
            .setDepth(100);
        
        // Bonus round title
        this.add.text(width / 2, 20, 'BONUS ROUND!', {
            fontSize: '48px',
            fontStyle: 'bold',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Instructions
        this.add.text(width / 2, 80, 'SELECT WHERE TO SHOOT', {
            fontSize: '28px',
            fontStyle: 'bold',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        // Force Goal test button at bottom
        this.forceGoalEnabled = this.registry.get('forceGoal') || false;
        this.createForceGoalButton();
        
        this.shotTaken = false;
    }
    
    createGoalZones() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Goal area is at 33% down, assume goal is about 400px wide and 200px tall
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
        
        // Cash multipliers to randomly assign (5x, 10x, 20x, 50x, 100x stake)
        const cashMultipliers = [5, 10, 20, 50, 100];
        
        // Shuffle cash multipliers
        const shuffled = Phaser.Utils.Array.Shuffle([...cashMultipliers]);
        
        // Create zones with target design
        this.zones = [];
        zoneDefinitions.forEach((zoneDef, index) => {
            // Create target circles (concentric rings) - in front of goalkeeper
            const targetSize = 90;
            
            // Outer ring (gold)
            const outerRing = this.add.circle(zoneDef.x, zoneDef.y, targetSize / 2, 0xFFD700, 0.4).setDepth(10);
            
            // Middle ring (white)
            const middleRing = this.add.circle(zoneDef.x, zoneDef.y, targetSize / 3, 0xffffff, 0.4).setDepth(10);
            
            // Inner ring (gold)
            const innerRing = this.add.circle(zoneDef.x, zoneDef.y, targetSize / 6, 0xFFD700, 0.5).setDepth(10);
            
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
            zone.cashMultiplier = shuffled[index];
            zone.cashAmount = this.selectedStake * shuffled[index]; // Amount in pence
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
                if (!this.shotTaken) {
                    this.takeShot(zone);
                }
            });
            
            this.zones.push(zone);
        });
    }
    
    takeShot(selectedZone) {
        this.shotTaken = true;
        
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
        const cashAmount = selectedZone.cashAmount;
        const targetX = selectedZone.zoneX;
        const targetY = selectedZone.zoneY;
        
        if (isGoal) {
            this.handleGoal(zoneName, cashAmount, targetX, targetY);
        } else {
            this.handleSave(zoneName, targetX, targetY);
        }
    }
    
    handleGoal(zoneName, cashAmount, targetX, targetY) {
        // Ball shoots to target
        this.tweens.add({
            targets: this.ball,
            x: targetX,
            y: targetY,
            scale: 0.1,
            duration: 600,
            ease: 'Power2',
            onComplete: () => {
                // Show goal celebration image
                const isLeft = zoneName.includes('left');
                const goalImage = isLeft ? 'left_goal' : 'right_goal';
                
                this.goalkeeper.setVisible(false);
                
                const celebration = this.add.image(
                    this.cameras.main.width / 2,
                    this.cameras.main.height * 0.33,
                    goalImage
                ).setScale(1.0).setDepth(20);
                
                // Show cash amount on ball
                const amountText = this.add.text(targetX, targetY - 30, `£${(cashAmount / 100).toFixed(2)}`, {
                    fontSize: '40px',
                    fontStyle: 'bold',
                    fill: '#FFD700',
                    stroke: '#000000',
                    strokeThickness: 5
                }).setOrigin(0.5).setDepth(150);
                
                // Show win message
                this.time.delayedCall(1000, () => {
                    this.showWinMessage(cashAmount);
                });
            }
        });
    }
    
    handleSave(zoneName, targetX, targetY) {
        // Determine goalkeeper dive image
        let diveImage;
        const isLeft = zoneName.includes('left');
        const isHigh = zoneName.includes('top');
        
        if (isLeft && isHigh) diveImage = 'left_dive_high';
        else if (isLeft && !isHigh) diveImage = 'left_dive_low';
        else if (!isLeft && isHigh) diveImage = 'right_dive_high';
        else diveImage = 'right_dive_low';
        
        // Ball shoots toward target (ball stays on top with depth 100)
        this.tweens.add({
            targets: this.ball,
            x: targetX,
            y: targetY,
            scale: 0.1,
            duration: 600,
            ease: 'Power2'
        });
        
        // Remove the ready goalkeeper and replace with dive image at target position
        this.goalkeeper.destroy();
        
        // Create dive goalkeeper at target position (scaled to 1.0, depth below ball)
        this.goalkeeper = this.add.image(targetX, targetY, diveImage)
            .setScale(1.0)
            .setDepth(50);
        
        // Show loss message
        this.time.delayedCall(1500, () => {
            this.showLossMessage();
        });
    }
    
    showWinMessage(cashAmount) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Add winnings to wallet
        const currentBalance = this.registry.get('walletBalance') || 0;
        this.registry.set('walletBalance', currentBalance + cashAmount);
        
        // YOU WIN!!! text
        const youWinText = this.add.text(width / 2, height / 2 - 100, 'BONUS WIN!!!', {
            fontSize: '100px',
            fontStyle: 'bold',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 10
        }).setOrigin(0.5).setDepth(150);
        
        // You won text
        const winText = this.add.text(width / 2, height / 2, 'You won:', {
            fontSize: '50px',
            fontStyle: 'bold',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(150);
        
        const amountText = this.add.text(width / 2, height / 2 + 70, `£${(cashAmount / 100).toFixed(2)}`, {
            fontSize: '70px',
            fontStyle: 'bold',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5).setDepth(150);
        
        // Store bonus win amount for potential display
        this.registry.set('bonusWinAmount', cashAmount / 100);
        
        // Wait then return to RunningScene
        this.time.delayedCall(3000, () => {
            this.returnToGame();
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
        }).setOrigin(0.5).setDepth(150);
        
        // No bonus text
        const noBonusText = this.add.text(width / 2, height / 2, 'No bonus this time!', {
            fontSize: '50px',
            fontStyle: 'bold',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(150);
        
        // Wait then return to RunningScene
        this.time.delayedCall(2000, () => {
            this.returnToGame();
        });
    }
    
    returnToGame() {
        // Check if there was a bonus win to display
        const bonusWinAmount = this.registry.get('bonusWinAmount');
        
        if (bonusWinAmount && bonusWinAmount > 0) {
            // Show wallet animation with bonus going into wallet
            this.showWalletAnimation(bonusWinAmount);
        } else {
            // No bonus won, return immediately
            this.finalizeReturn();
        }
    }
    
    showWalletAnimation(bonusAmount) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Get RunningScene and add bonus to its totalBonusWon immediately
        const runningScene = this.scene.get('RunningScene');
        if (runningScene && runningScene.totalBonusWon !== undefined) {
            runningScene.totalBonusWon += bonusAmount;
        }
        
        // Create wallet icon
        const walletContainer = this.add.container(width / 2, height / 2);
        
        // Wallet background (rounded rectangle simulation)
        const walletBg = this.add.rectangle(0, 0, 150, 100, 0x8B4513);
        const walletTop = this.add.rectangle(0, -30, 150, 20, 0x654321);
        
        // Wallet symbol ($)
        const walletSymbol = this.add.text(0, 0, '£', {
            fontSize: '60px',
            fontStyle: 'bold',
            fill: '#FFD700'
        }).setOrigin(0.5);
        
        walletContainer.add([walletBg, walletTop, walletSymbol]);
        walletContainer.setScale(0);
        walletContainer.setDepth(200);
        
        // Bonus amount text floating above
        const bonusText = this.add.text(width / 2, height / 2 - 150, `+£${bonusAmount.toFixed(2)}`, {
            fontSize: '48px',
            fontStyle: 'bold',
            fill: '#00FF00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(200).setAlpha(0);
        
        const addingText = this.add.text(width / 2, height / 2 + 100, 'ADDING TO WALLET...', {
            fontSize: '32px',
            fontStyle: 'bold',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(200).setAlpha(0);
        
        // Animation sequence
        // 1. Scale up wallet
        this.tweens.add({
            targets: walletContainer,
            scale: 1.2,
            duration: 400,
            ease: 'Back.easeOut'
        });
        
        // 2. Fade in bonus text
        this.tweens.add({
            targets: bonusText,
            alpha: 1,
            duration: 300,
            delay: 200,
            ease: 'Power2'
        });
        
        // 3. Move bonus text down into wallet
        this.tweens.add({
            targets: bonusText,
            y: height / 2,
            scale: 0.5,
            alpha: 0,
            duration: 800,
            delay: 800,
            ease: 'Power2.easeIn'
        });
        
        // 4. Pulse wallet
        this.tweens.add({
            targets: walletContainer,
            scale: 1.4,
            duration: 200,
            delay: 1400,
            yoyo: true,
            ease: 'Power2'
        });
        
        // 5. Show "Adding to wallet" text
        this.tweens.add({
            targets: addingText,
            alpha: 1,
            duration: 300,
            delay: 1600,
            ease: 'Power2'
        });
        
        // 6. After 3 seconds, fade everything out, wait 2 more seconds, then return to game
        this.time.delayedCall(3000, () => {
            this.tweens.add({
                targets: [walletContainer, bonusText, addingText],
                alpha: 0,
                duration: 400,
                onComplete: () => {
                    walletContainer.destroy();
                    bonusText.destroy();
                    addingText.destroy();
                    
                    // Add 2-second pause for game pacing before returning
                    this.time.delayedCall(2000, () => {
                        this.finalizeReturn();
                    });
                }
            });
        });
    }
    
    finalizeReturn() {
        // Clear bonus win amount since we already added it to RunningScene's totalBonusWon
        this.registry.set('bonusWinAmount', 0);
        this.scene.stop('BonusRoundScene');
        this.scene.wake('RunningScene');
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
