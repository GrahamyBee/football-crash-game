class ShootingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShootingScene' });
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Get game data
        this.selectedPlayer = this.registry.get('selectedPlayer');
        this.selectedStake = this.registry.get('selectedStake');
        this.runningMultiplier = this.registry.get('currentMultiplier');
        this.playerPositions = this.registry.get('playerPositions');
        
        // Calculate distance to goal
        const runningScene = this.scene.get('RunningScene');
        const playerPosition = this.playerPositions[this.selectedPlayer];
        
        // Distance determines how long the shot takes
        this.distanceToGoal = Math.max(100, runningScene.pitchHeight - playerPosition - 50);
        this.shootingTime = this.distanceToGoal / GameConfig.BALL_SPEED;
        
        // Background
        this.add.rectangle(0, 0, width, height, 0x1a5f2d).setOrigin(0);
        
        // Create goal
        this.createGoal();
        
        // Create ball
        this.createBall();
        
        // Create UI
        this.createUI();
        
        // Start shooting
        this.startShooting();
    }
    
    createGoal() {
        const width = this.cameras.main.width;
        
        // Goal position (top of screen)
        this.goalY = 100;
        const goalWidth = width * 0.6;
        const goalX = width / 2;
        
        // Goal posts
        this.add.rectangle(goalX - goalWidth / 2, this.goalY, 10, 100, 0xffffff);
        this.add.rectangle(goalX + goalWidth / 2, this.goalY, 10, 100, 0xffffff);
        this.add.rectangle(goalX, this.goalY, goalWidth, 10, 0xffffff);
        
        // Goal net
        const net = this.add.rectangle(goalX, this.goalY + 50, goalWidth, 100, 0x000000, 0.3);
        
        // Goalkeeper
        this.goalkeeper = this.add.circle(goalX, this.goalY + 60, 25, 0xffaa00);
        this.goalkeeper.setStrokeStyle(3, 0x000000);
        
        // Add goalkeeper text
        this.add.text(goalX, this.goalY + 110, 'GK', {
            fontSize: '16px',
            fontStyle: 'bold',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        // Target area (for hit detection)
        this.goalTarget = new Phaser.Geom.Rectangle(
            goalX - goalWidth / 2,
            this.goalY,
            goalWidth,
            100
        );
    }
    
    createBall() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Ball starts at bottom center
        this.ballStartY = height - 150;
        this.ball = this.add.circle(width / 2, this.ballStartY, 15, 0xffffff);
        this.ball.setStrokeStyle(2, 0x000000);
    }
    
    createUI() {
        const width = this.cameras.main.width;
        
        // Shooting multiplier
        this.shootingMultiplier = 0;
        
        this.multiplierText = this.add.text(width / 2, 300, 'SHOOTING MULTIPLIER\nx0.00', {
            fontSize: '32px',
            fontStyle: 'bold',
            fill: '#ffff00',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);
        
        // Running value display
        const runningValue = this.formatCashValue(this.runningMultiplier);
        this.add.text(width / 2, 400, `Running Value: ${runningValue}`, {
            fontSize: '20px',
            fill: '#ffffff'
        }).setOrigin(0.5);
    }
    
    formatCashValue(multiplier) {
        const value = (this.selectedStake / 100) * multiplier;
        return `£${value.toFixed(2)}`;
    }
    
    startShooting() {
        this.isMoving = true;
        this.elapsedTime = 0;
        
        // Animate ball moving toward goal
        this.tweens.add({
            targets: this.ball,
            y: this.goalY + 50,
            duration: this.shootingTime * 1000,
            ease: 'Linear',
            onComplete: () => {
                this.ballReachedGoal();
            }
        });
        
        // Animate goalkeeper moving
        this.tweens.add({
            targets: this.goalkeeper,
            x: this.goalkeeper.x + Phaser.Math.Between(-100, 100),
            duration: 800,
            yoyo: true,
            repeat: Math.ceil(this.shootingTime / 0.8)
        });
    }
    
    update(time, delta) {
        if (!this.isMoving) return;
        
        const deltaSeconds = delta / 1000;
        this.elapsedTime += deltaSeconds;
        
        // Increase shooting multiplier
        this.shootingMultiplier += GameConfig.SHOOTING_MULTIPLIER_RATE * deltaSeconds;
        
        this.multiplierText.setText(`SHOOTING MULTIPLIER\nx${this.shootingMultiplier.toFixed(2)}`);
    }
    
    ballReachedGoal() {
        this.isMoving = false;
        
        // Determine outcome
        const hitTarget = Math.random() < GameConfig.GOAL_HIT_CHANCE;
        
        if (!hitTarget) {
            // Ball missed the target
            this.showOutcome(false, 'MISSED!');
        } else {
            // Ball hit target - check if goalkeeper saves
            const goalkeeperSaves = Math.random() < GameConfig.GOALKEEPER_SAVE_CHANCE;
            
            if (goalkeeperSaves) {
                // Goalkeeper saved it
                this.showOutcome(false, 'SAVED!');
            } else {
                // GOAL!
                this.showOutcome(true, 'GOAL!!!');
            }
        }
    }
    
    showOutcome(isGoal, message) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Flash effect
        const flash = this.add.rectangle(0, 0, width, height, isGoal ? 0x00ff00 : 0xff0000, 0.5)
            .setOrigin(0);
        
        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 500,
            onComplete: () => flash.destroy()
        });
        
        // Outcome message
        const outcomeText = this.add.text(width / 2, height / 2, message, {
            fontSize: '72px',
            fontStyle: 'bold',
            fill: isGoal ? '#00ff00' : '#ff0000',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);
        
        outcomeText.setScale(0);
        this.tweens.add({
            targets: outcomeText,
            scale: 1,
            duration: 500,
            ease: 'Back.easeOut'
        });
        
        // Calculate final outcome
        if (isGoal) {
            const finalMultiplier = this.runningMultiplier * this.shootingMultiplier;
            const finalValue = (this.selectedStake / 100) * finalMultiplier;
            
            this.registry.set('finalMultiplier', finalMultiplier);
            this.registry.set('finalValue', finalValue);
            this.registry.set('won', true);
            this.registry.set('cashedOut', false);
        } else {
            this.registry.set('finalMultiplier', 0);
            this.registry.set('finalValue', 0);
            this.registry.set('won', false);
        }
        
        // Transition to outcome scene
        this.time.delayedCall(2500, () => {
            this.scene.start('OutcomeScene');
        });
    }
}
