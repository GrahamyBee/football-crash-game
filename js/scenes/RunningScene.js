class RunningScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RunningScene' });
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Get game data
        this.selectedPlayer = this.registry.get('selectedPlayer');
        this.selectedStake = this.registry.get('selectedStake');
        this.currentMultiplier = 0;
        this.activePlayers = [true, true, true, true];
        this.playerPositions = [0, 0, 0, 0];
        
        // Game state
        this.gameStartTime = 0;
        this.elapsedTime = 0;
        this.nextDecisionTime = GameConfig.DECISION_INTERVALS[0];
        this.currentDecisionIndex = 0;
        this.isRunning = false;
        this.hasStarted = false;
        
        // Create pitch
        this.createPitch();
        
        // Create players
        this.createPlayers();
        
        // Create UI
        this.createUI();
        
        // Show whistle message
        this.showWhistleMessage();
    }
    
    createPitch() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Horizontal pitch - runs left to right - increased height for larger sprites
        this.pitchWidth = width * 4; // Large scrollable pitch
        this.pitchHeight = height * 0.85; // Increased from 0.7 to 0.85
        this.pitchY = (height - this.pitchHeight) / 2 + 40; // Adjusted Y position
        
        // Pitch background (scrolling)
        this.pitchBg = this.add.rectangle(0, this.pitchY, this.pitchWidth, this.pitchHeight, GameConfig.PITCH_COLOR)
            .setOrigin(0);
        
        // Draw horizontal lanes - more space between lanes
        this.laneHeight = this.pitchHeight / 4;
        for (let i = 1; i < 4; i++) {
            this.add.line(
                0, 0,
                0, this.pitchY + this.laneHeight * i,
                this.pitchWidth, this.pitchY + this.laneHeight * i,
                GameConfig.LINE_COLOR, 0.3
            ).setOrigin(0);
        }
        
        // Draw goal at the right end
        this.goalX = this.pitchWidth - 100;
        const goalHeight = this.pitchHeight * 0.6;
        const goalY = this.pitchY + (this.pitchHeight - goalHeight) / 2;
        
        this.goalMarker = this.add.rectangle(this.goalX, goalY + goalHeight / 2, 15, goalHeight, 0xffffff);
        
        const goalText = this.add.text(this.goalX + 30, this.pitchY + this.pitchHeight / 2, 'GOAL', {
            fontSize: '32px',
            fontStyle: 'bold',
            fill: '#ffffff',
            angle: -90
        }).setOrigin(0.5);
        
        // Camera follows the action
        this.cameraScrollX = 0;
    }
    
    createPlayers() {
        const width = this.cameras.main.width;
        
        this.players = [];
        this.opponents = [];
        
        // Starting position (left side, centered on screen)
        const startX = 200;
        
        for (let i = 0; i < 4; i++) {
            const y = this.pitchY + this.laneHeight * i + this.laneHeight / 2;
            
            // Create animated player sprite or fallback to circle
            // Use different sprite sheet for each footballer
            const spriteKey = `footballer${i + 1}`;
            const animKey = `run${i + 1}`;
            
            let player;
            if (this.textures.exists(spriteKey) && this.anims.exists(animKey)) {
                player = this.add.sprite(startX, y, spriteKey);
                player.setScale(0.5); // Doubled from 0.25 to 0.5 for 256x256 frames = 128x128 display
                player.play(animKey);
            } else {
                // Fallback to circle
                player = this.add.circle(startX, y, 40, GameConfig.PLAYER_COLORS[i]); // Doubled from 20 to 40
                player.setStrokeStyle(2, 0xffffff);
                console.warn(`Using fallback circle for player ${i} in RunningScene`);
            }
            
            // Create player object first
            const playerObj = {
                sprite: player,
                lane: i,
                active: true,
                hasBall: i === this.selectedPlayer,
                fixedY: y,
                ball: null,
                indicator: null
            };
            
            // Add ball to selected player
            if (i === this.selectedPlayer) {
                // Use football image instead of white circle
                // Position at bottom-right of sprite, 1% closer to player (800 * 0.01 = 8px, so 55-8=47)
                const ball = this.add.image(startX + 47, y + 40, 'football');
                ball.setScale(0.08); // Scale down football image to appropriate size
                
                // Store ball reference in BOTH sprite and playerObj
                player.ball = ball;
                playerObj.ball = ball;
                
                // Add continuous rotation animation to simulate rolling
                this.tweens.add({
                    targets: ball,
                    angle: 360,
                    duration: 1000,
                    repeat: -1,
                    ease: 'Linear'
                });
                
                // Add indicator
                const indicator = this.add.text(startX, y - 80, 'YOU', { // Adjusted for larger sprite
                    fontSize: '20px', // Larger font for larger sprites
                    fontStyle: 'bold',
                    fill: '#ffff00'
                }).setOrigin(0.5);
                
                // Store indicator in BOTH sprite and playerObj
                player.indicator = indicator;
                playerObj.indicator = indicator;
            }
            
            this.players.push(playerObj);
            
            // Create opponent pools for this lane
            this.opponents.push([]);
        }
    }
    
    createUI() {
        const width = this.cameras.main.width;
        
        // Cash value display (top center)
        this.cashValueText = this.add.text(width / 2, 20, this.formatCashValue(0), {
            fontSize: '36px',
            fontStyle: 'bold',
            fill: '#ffff00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        // Stake display (top left)
        const stakeLabel = this.selectedStake < 100 
            ? `${this.selectedStake}p` 
            : `£${(this.selectedStake / 100).toFixed(2)}`;
            
        this.add.text(20, 20, `Stake: ${stakeLabel}`, {
            fontSize: '20px',
            fill: '#ffffff'
        });
    }
    
    formatCashValue(multiplier) {
        const value = (this.selectedStake / 100) * multiplier;
        return `£${value.toFixed(2)}`;
    }
    
    showWhistleMessage() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const message = this.add.text(width / 2, height / 2, '🔊 WHISTLE!\nGame Starting...', {
            fontSize: '48px',
            fontStyle: 'bold',
            fill: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Fade out and start game
        this.tweens.add({
            targets: message,
            alpha: 0,
            duration: 2000,
            onComplete: () => {
                message.destroy();
                this.startRunning();
            }
        });
    }
    
    startRunning() {
        this.isRunning = true;
        this.hasStarted = true;
        this.gameStartTime = this.time.now;
    }
    
    update(time, delta) {
        if (!this.isRunning) return;
        
        const deltaSeconds = delta / 1000;
        this.elapsedTime += deltaSeconds;
        
        // Update multiplier - THIS IS THE FIX
        this.currentMultiplier += GameConfig.MULTIPLIER_INCREASE_RATE * deltaSeconds;
        this.currentMultiplier = Math.min(this.currentMultiplier, GameConfig.MAX_MULTIPLIER);
        
        // Update display
        this.cashValueText.setText(this.formatCashValue(this.currentMultiplier));
        
        // Scroll the world (move background and opponents)
        this.scrollWorld(deltaSeconds);
        
        // Spawn and move opponents
        this.updateOpponents(deltaSeconds);
        
        // Check for crashes
        this.checkCrashes();
        
        // Check for decision interval
        if (this.elapsedTime >= this.nextDecisionTime) {
            this.triggerDecisionInterval();
        }
        
        // Check if all players crashed
        const activeCount = this.players.filter(p => p.active).length;
        if (activeCount === 0) {
            this.gameOver();
        }
    }
    
    scrollWorld(deltaSeconds) {
        const moveDistance = GameConfig.RUNNING_SPEED * deltaSeconds;
        
        // Update camera scroll
        this.cameraScrollX += moveDistance;
        
        // Track distance traveled and update ball/indicator positions
        this.players.forEach((player, index) => {
            if (player.active) {
                this.playerPositions[index] += moveDistance;
                
                // Update ball position if this player has it
                // Position at bottom-right of sprite, 1% closer (47 instead of 55)
                if (player.hasBall && player.ball) {
                    player.ball.x = player.sprite.x + 47;
                    player.ball.y = player.sprite.y + 40;
                }
                
                // Update indicator position
                if (player.indicator) {
                    player.indicator.x = player.sprite.x;
                    player.indicator.y = player.sprite.y - 80; // Adjusted for sprite size
                }
            }
        });
        
        // Move pitch background to the left (creates illusion of player moving right)
        this.pitchBg.x -= moveDistance;
        this.goalMarker.x -= moveDistance;
        
        // Keep players centered on screen (they don't actually move horizontally)
        // Players stay at their fixed positions while world scrolls
    }
    
    updateOpponents(deltaSeconds) {
        const spawnChance = GameConfig.CRASH_CHANCE_PER_SECOND * deltaSeconds;
        
        // Spawn opponents
        this.players.forEach((player, index) => {
            if (!player.active) return;
            
            if (Math.random() < spawnChance) {
                this.spawnOpponent(index);
            }
        });
        
        // Move opponents (they scroll left with the world)
        const moveDistance = GameConfig.RUNNING_SPEED * deltaSeconds;
        
        this.opponents.forEach((laneOpponents, laneIndex) => {
            laneOpponents.forEach((opponent, oppIndex) => {
                opponent.x -= moveDistance; // Move left
                
                // Remove if off screen (left side)
                if (opponent.x < -50) {
                    opponent.destroy();
                    laneOpponents.splice(oppIndex, 1);
                }
            });
        });
    }
    
    spawnOpponent(lane) {
        // Don't spawn too many opponents
        if (this.opponents[lane].length >= 2) return;
        
        const width = this.cameras.main.width;
        const x = width + 50; // Spawn off right side of screen
        const y = this.pitchY + this.laneHeight * lane + this.laneHeight / 2;
        
        // Create animated opposition sprite
        const opponent = this.add.sprite(x, y, 'opposition_run');
        opponent.setScale(0.5); // 256x256 -> 128x128 display size
        opponent.play('opposition_run_anim');
        opponent.isAnimated = true; // Track if this is animated or static
        
        this.opponents[lane].push(opponent);
    }
    
    checkCrashes() {
        this.players.forEach((player, playerIndex) => {
            if (!player.active) return;
            
            const playerX = player.sprite.x;
            const playerY = player.sprite.y;
            
            this.opponents[playerIndex].forEach((opponent, oppIndex) => {
                const distance = Phaser.Math.Distance.Between(
                    playerX, playerY,
                    opponent.x, opponent.y
                );
                
                if (distance < 38) {
                    // Determine outcome: 60% tackle, 20% dodge, 20% skill
                    const random = Math.random();
                    let outcome;
                    
                    if (random < 0.6) {
                        outcome = 'tackle';
                    } else if (random < 0.8) {
                        outcome = 'dodge';
                    } else {
                        outcome = 'skill';
                    }
                    
                    if (outcome === 'tackle') {
                        // CRASH! Replace both player and opponent with static images
                        this.crashPlayer(playerIndex, opponent);
                    } else if (outcome === 'dodge') {
                        // Replace opponent with dodge image
                        this.replaceOpponentWithStaticImage(opponent, 'opposition_dodge', playerIndex, oppIndex);
                        this.showDodgeMessage(playerX, playerY, 'DODGED!');
                    } else {
                        // Replace opponent with skill image
                        this.replaceOpponentWithStaticImage(opponent, 'opposition_skill', playerIndex, oppIndex);
                        this.showDodgeMessage(playerX, playerY, 'SKILL!');
                    }
                }
            });
        });
    }
    
    replaceOpponentWithStaticImage(opponent, imageKey, lane, oppIndex) {
        // Store position and create static image
        const x = opponent.x;
        const y = opponent.y;
        
        // Stop animation and destroy animated sprite
        if (opponent.isAnimated) {
            opponent.stop();
        }
        opponent.destroy();
        
        // Create static image at same position
        const staticImage = this.add.image(x, y, imageKey);
        staticImage.setScale(0.5); // Same scale as animated sprite
        staticImage.isAnimated = false; // Mark as static
        
        // Replace in opponents array
        this.opponents[lane][oppIndex] = staticImage;
    }
    
    showDodgeMessage(x, y, message) {
        // Use provided message or pick random
        if (!message) {
            const messages = ['DRIBBLED!', 'DODGED!', 'AVOIDED!', 'SKILL!'];
            message = messages[Math.floor(Math.random() * messages.length)];
        }
        
        const dodgeText = this.add.text(x, y - 40, message, {
            fontSize: '20px',
            fontStyle: 'bold',
            fill: '#00ff00'
        }).setOrigin(0.5);
        
        this.tweens.add({
            targets: dodgeText,
            y: dodgeText.y - 50,
            alpha: 0,
            duration: 1500,
            onComplete: () => dodgeText.destroy()
        });
    }
    
    crashPlayer(playerIndex, opponent) {
        const player = this.players[playerIndex];
        if (!player.active) return;
        
        player.active = false;
        
        // Replace opponent with tackle image
        if (opponent) {
            const oppX = opponent.x;
            const oppY = opponent.y;
            
            // Stop and destroy opponent sprite
            if (opponent.isAnimated) {
                opponent.stop();
            }
            opponent.destroy();
            
            // Create tackle static image
            const tackleImage = this.add.image(oppX, oppY, 'opposition_tackle');
            tackleImage.setScale(0.5);
            tackleImage.isAnimated = false;
            
            // Find and replace in opponents array
            this.opponents[playerIndex].forEach((opp, idx) => {
                if (opp === opponent) {
                    this.opponents[playerIndex][idx] = tackleImage;
                }
            });
        }
        
        // Replace player sprite with dive image
        const playerX = player.sprite.x;
        const playerY = player.sprite.y;
        
        // Stop player animation and destroy sprite
        player.sprite.stop();
        player.sprite.destroy();
        
        // Create dive static image
        const diveImage = this.add.image(playerX, playerY, 'player_dive');
        diveImage.setScale(0.5);
        
        // Replace sprite reference
        player.sprite = diveImage;
        
        // Clean up ball
        if (player.ball) {
            player.ball.destroy();
            player.ball = null;
        }
        
        // Clean up indicator
        if (player.indicator) {
            player.indicator.destroy();
            player.indicator = null;
        }
        
        // Show crash text
        const crashText = this.add.text(
            player.sprite.x,
            player.sprite.y - 40,
            'TACKLED!',
            {
                fontSize: '20px',
                fontStyle: 'bold',
                fill: '#ff0000'
            }
        ).setOrigin(0.5);
        
        this.tweens.add({
            targets: crashText,
            y: crashText.y - 50,
            alpha: 0,
            duration: 1500,
            onComplete: () => crashText.destroy()
        });
        
        // Check if the crashed player had the ball
        if (player.hasBall) {
            // Find another active player to pass to (automatic)
            const activePlayer = this.players.find(p => p.active && p.lane !== playerIndex);
            
            if (activePlayer) {
                this.passBallTo(activePlayer.lane);
            } else {
                // No active players left - game over
                this.gameOver();
            }
        }
    }
    
    handlePassAnimation(targetLane) {
        console.log('╔═══════════════════════════════════════╗');
        console.log('║  handlePassAnimation CALLED          ║');
        console.log('╚═══════════════════════════════════════╝');
        console.log('Target lane:', targetLane);
        console.log('Current selectedPlayer:', this.selectedPlayer);
        console.log('Scene isPaused:', this.scene.isPaused());
        console.log('isRunning:', this.isRunning);
        
        // CRITICAL: Make sure scene is not paused
        if (this.scene.isPaused()) {
            console.warn('⚠️ Scene is still paused! Resuming now...');
            this.scene.resume();
        }
        
        // Force pause
        this.isRunning = false;
        
        // Find players
        console.log('\n--- Finding Players ---');
        const currentPlayer = this.players[this.selectedPlayer];
        const targetPlayer = this.players[targetLane];
        
        console.log('Current player (lane ' + this.selectedPlayer + '):', currentPlayer);
        console.log('Current player has ball:', currentPlayer.hasBall);
        console.log('Current player ball object:', currentPlayer.ball);
        console.log('Target player (lane ' + targetLane + '):', targetPlayer);
        console.log('Target player active:', targetPlayer.active);
        
        if (!currentPlayer.ball) {
            console.error('❌ CRITICAL: Current player has no ball object!');
            console.log('Searching all players for ball...');
            this.players.forEach((p, idx) => {
                console.log(`Player ${idx}: hasBall=${p.hasBall}, ball=${p.ball}`);
            });
            return;
        }
        
        const ball = currentPlayer.ball;
        console.log('\n--- Ball Info ---');
        console.log('Ball position:', ball.x, ball.y);
        console.log('Ball exists:', !!ball);
        
        // Calculate target
        const targetX = targetPlayer.sprite.x + 47;
        const targetY = targetPlayer.sprite.y + 40;
        console.log('Target position:', targetX, targetY);
        console.log('Distance to travel:', Math.sqrt(Math.pow(targetX - ball.x, 2) + Math.pow(targetY - ball.y, 2)));
        
        // Remove all indicators
        console.log('\n--- Removing Indicators ---');
        this.players.forEach((p, idx) => {
            if (p.indicator) {
                console.log('Removing indicator from player', idx);
                p.indicator.destroy();
                p.indicator = null;
            }
        });
        
        // Kill existing tweens
        console.log('\n--- Starting Animation ---');
        this.tweens.killTweensOf(ball);
        console.log('Killed existing ball tweens');
        
        // Create animation
        const tween = this.tweens.add({
            targets: ball,
            x: targetX,
            y: targetY,
            duration: 1000,
            ease: 'Quad.easeOut',
            onStart: () => {
                console.log('✅ TWEEN STARTED - Ball is moving!');
            },
            onUpdate: (tween, target) => {
                if (tween.progress < 0.1 || tween.progress > 0.9) {
                    console.log(`Tween progress: ${(tween.progress * 100).toFixed(0)}% - Ball at: ${ball.x.toFixed(0)}, ${ball.y.toFixed(0)}`);
                }
            },
            onComplete: () => {
                console.log('\n╔═══════════════════════════════════════╗');
                console.log('║  ANIMATION COMPLETE                  ║');
                console.log('╚═══════════════════════════════════════╝');
                
                // Transfer ownership
                currentPlayer.hasBall = false;
                currentPlayer.ball = null;
                targetPlayer.hasBall = true;
                targetPlayer.ball = ball;
                
                // Update selected player
                this.selectedPlayer = targetLane;
                this.registry.set('selectedPlayer', targetLane);
                console.log('New selectedPlayer:', this.selectedPlayer);
                
                // Restart rotation
                this.tweens.add({
                    targets: ball,
                    angle: 360,
                    duration: 1000,
                    repeat: -1,
                    ease: 'Linear'
                });
                
                // Add indicator
                const indicator = this.add.text(
                    targetPlayer.sprite.x,
                    targetPlayer.sprite.y - 80,
                    'YOU',
                    {
                        fontSize: '20px',
                        fontStyle: 'bold',
                        fill: '#ffff00'
                    }
                ).setOrigin(0.5);
                
                targetPlayer.indicator = indicator;
                console.log('Added YOU indicator to new player');
                
                // Resume
                console.log('Resuming game...');
                this.resumeRunning();
                console.log('✅ PASS COMPLETE\n');
            }
        });
        
        console.log('Tween created:', tween);
        console.log('Tween active:', tween.isPlaying());
        
        // Spin during pass
        this.tweens.add({
            targets: ball,
            angle: ball.angle + 720,
            duration: 1000,
            ease: 'Linear'
        });
    }
    
    passBallTo(targetLane) {
        // For automatic passes (when player crashes)
        this.handlePassAnimation(targetLane);
    }
    
    completeBallTransfer(fromPlayer, toPlayer, ball) {
        // Mark old player as not having ball
        fromPlayer.hasBall = false;
        fromPlayer.ball = null;
        if (fromPlayer.sprite.ball) {
            fromPlayer.sprite.ball = null;
        }
        
        // Mark new player as having ball
        toPlayer.hasBall = true;
        toPlayer.ball = ball;
        toPlayer.sprite.ball = ball;
        
        // Restart continuous rotation animation after pass
        this.tweens.add({
            targets: ball,
            angle: 360,
            duration: 1000,
            repeat: -1,
            ease: 'Linear'
        });
        
        // Add new indicator to target player
        const indicator = this.add.text(
            toPlayer.sprite.x,
            toPlayer.sprite.y - 80,
            'YOU',
            {
                fontSize: '20px',
                fontStyle: 'bold',
                fill: '#ffff00'
            }
        ).setOrigin(0.5);
        
        toPlayer.sprite.indicator = indicator;
        toPlayer.indicator = indicator;
    }
    
    createBallForPlayer(player, lane) {
        // Create new ball with football image
        // Position at bottom-right of sprite, 1% closer (47 instead of 55)
        const ball = this.add.image(
            player.sprite.x + 47,
            player.sprite.y + 40,
            'football'
        );
        ball.setScale(0.08);
        
        // Add continuous rotation
        this.tweens.add({
            targets: ball,
            angle: 360,
            duration: 1000,
            repeat: -1,
            ease: 'Linear'
        });
        
        // Mark player as having ball
        player.hasBall = true;
        player.ball = ball;
        player.sprite.ball = ball;
        
        // Add indicator
        const indicator = this.add.text(
            player.sprite.x,
            player.sprite.y - 80,
            'YOU',
            {
                fontSize: '20px',
                fontStyle: 'bold',
                fill: '#ffff00'
            }
        ).setOrigin(0.5);
        
        player.sprite.indicator = indicator;
        player.indicator = indicator;
    }
    
    triggerDecisionInterval() {
        this.isRunning = false;
        
        // Store current state
        this.registry.set('currentMultiplier', this.currentMultiplier);
        this.registry.set('activePlayers', this.players.map(p => p.active));
        this.registry.set('playerPositions', this.playerPositions);
        this.registry.set('elapsedTime', this.elapsedTime);
        this.registry.set('currentDecisionIndex', this.currentDecisionIndex);
        
        // Start decision scene
        this.scene.pause();
        this.scene.launch('DecisionScene');
    }
    
    resumeRunning() {
        this.isRunning = true;
        
        // Set next decision time
        this.currentDecisionIndex++;
        if (this.currentDecisionIndex < GameConfig.DECISION_INTERVALS.length) {
            this.nextDecisionTime = GameConfig.DECISION_INTERVALS[this.currentDecisionIndex];
        } else {
            this.nextDecisionTime = Infinity; // No more intervals
        }
    }
    
    gameOver() {
        this.isRunning = false;
        
        // Game over with no win
        this.registry.set('finalMultiplier', 0);
        this.registry.set('won', false);
        
        this.time.delayedCall(1000, () => {
            this.scene.start('OutcomeScene');
        });
    }
}
