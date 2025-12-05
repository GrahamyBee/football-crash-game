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
        this.testModeEnabled = this.registry.get('testModeEnabled') || false;
        
        // Decision thresholds based on MULTIPLES of stake
        // 3x (3s), 8x (+5x/5s), 13x (+5x/5s), 20x (+7x/7s)
        const stakeInPounds = this.selectedStake / 100;
        this.decisionMultipliers = [
            3,    // First decision at 3x stake (3 seconds)
            8,    // Second decision at 8x stake (+5x over 5 seconds)
            13,   // Third decision at 13x stake (+5x over 5 seconds)
            20    // Fourth decision at 20x stake (+7x over 7 seconds)
        ];
        
        // Calculate actual cash values for display
        this.decisionCashValues = this.decisionMultipliers.map(mult => mult * stakeInPounds);
        
        // Game state
        this.gameStartTime = 0;
        this.elapsedTime = 0;
        this.currentDecisionIndex = 0;
        this.isRunning = false;
        this.hasStarted = false;
        
        // Wave system state
        this.isPreFirstDecision = true; // Before first decision point
        this.preDecisionOpponentsSpawned = false; // Track if pre-decision opponents spawned
        this.preDecisionOpponentCount = 0; // How many pre-decision opponents
        this.preDecisionInteractionsRemaining = 0; // Track remaining interactions
        this.preDecisionAllInteractionsComplete = false; // All interactions done
        this.multiplierPaused = false; // Pause multiplier at decision point
        this.waitingForDecision = false; // Block spawning when decision window ready
        this.decisionTriggered = false; // Prevent duplicate decision triggers
        this.currentWaveActive = false; // Is a wave currently spawning/active
        this.currentWaveCount = 0; // Number of opponents in current wave
        this.waveOpponentsSpawned = 0; // How many spawned so far
        this.allWaveOpponentsGone = false; // All wave opponents off screen or destroyed
        this.waveSpawnedThisSection = false; // Flag: has a wave been spawned for current decision section
        
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
        
        // Pitch background (scrolling image) - store tiles for scrolling
        this.backgroundTiles = [];
        
        // Create first background tile
        this.pitchBg = this.add.image(0, this.pitchY, 'pitch_background')
            .setOrigin(0, 0);
        
        // Scale the background to fit the pitch height
        const bgHeight = this.pitchBg.height;
        const scaleY = this.pitchHeight / bgHeight;
        this.pitchBg.setScale(scaleY);
        this.backgroundTiles.push(this.pitchBg);
        
        // Calculate scaled width and tile if needed
        const bgWidth = this.pitchBg.width * scaleY;
        const numTiles = Math.ceil(this.pitchWidth / bgWidth);
        
        // Create additional tiles to cover the full pitch width
        for (let i = 1; i < numTiles; i++) {
            const tile = this.add.image(bgWidth * i, this.pitchY, 'pitch_background')
                .setOrigin(0, 0)
                .setScale(scaleY);
            this.backgroundTiles.push(tile);
        }
        
        // Add goal overlay with same height scaling as background
        // Position so RIGHT edge of goal aligns with RIGHT edge of background
        this.goalOverlay = this.add.image(0, this.pitchY, 'goal_overlay')
            .setOrigin(0, 0);
        
        // Scale the goal overlay to match background height
        const goalHeight = this.goalOverlay.height;
        const goalScaleY = this.pitchHeight / goalHeight;
        this.goalOverlay.setScale(goalScaleY);
        
        // Now position it so right edge aligns with background right edge
        const goalWidth = this.goalOverlay.width * goalScaleY;
        this.goalOverlay.x = this.pitchWidth - goalWidth;
        
        // Set high z-index/depth to ensure it's on top
        this.goalOverlay.setDepth(1000);
        
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
        
        // Camera follows the action
        this.cameraScrollX = 0;
    }
    
    createPlayers() {
        const width = this.cameras.main.width;
        
        this.players = [];
        this.opponents = [];
        
        // Starting position (left side, with horizontal staggering)
        const baseX = 200;
        const horizontalStagger = [240, 160, 80, 0]; // Lane 1 furthest back, Lane 4 most forward (80px gaps each)
        
        // Vertical position adjustments: Custom per lane
        const verticalAdjustments = [0.30, -0.40, -0.60, -0.55]; // Lane 1: +30% down, Lane 2: -40% up, Lane 3: -60% up, Lane 4: -55% up
        
        // Perspective scaling: top = 1.0, +33%, +66%, bottom = 2.0 (100% increase)
        const perspectiveScales = [1.0, 1.33, 1.66, 2.0];
        
        for (let i = 0; i < 4; i++) {
            const baseY = this.pitchY + this.laneHeight * i + this.laneHeight / 2;
            const yAdjustment = this.laneHeight * verticalAdjustments[i];
            const y = baseY + yAdjustment;
            
            const x = baseX + horizontalStagger[i];
            const perspectiveScale = perspectiveScales[i];
            
            // Create animated player sprite or fallback to circle
            // Use different sprite sheet for each footballer
            const spriteKey = `footballer${i + 1}`;
            const animKey = `run${i + 1}`;
            
            let player;
            if (this.textures.exists(spriteKey) && this.anims.exists(animKey)) {
                player = this.add.sprite(x, y, spriteKey);
                player.setScale(0.5 * perspectiveScale); // Base 0.5 scale with perspective multiplier
                player.play(animKey);
                player.anims.pause(); // Pause animation until game starts
            } else {
                // Fallback to circle
                player = this.add.circle(x, y, 40 * perspectiveScale, GameConfig.PLAYER_COLORS[i]);
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
                indicator: null,
                perspectiveScale: perspectiveScale // Store scale for ball and opposition
            };
            
            // Add ball to selected player
            if (i === this.selectedPlayer) {
                // Use football image instead of white circle
                // Position at bottom-right of sprite, scaled with perspective
                const ballOffsetX = 47 * perspectiveScale;
                const ballOffsetY = 40 * perspectiveScale;
                const ball = this.add.image(x + ballOffsetX, y + ballOffsetY, 'football');
                ball.setScale(0.08 * perspectiveScale); // Scale ball to match player perspective
                
                // Store ball reference in BOTH sprite and playerObj
                player.ball = ball;
                playerObj.ball = ball;
                
                // Add continuous rotation animation to simulate rolling
                // Store the tween so we can pause it initially
                const ballTween = this.tweens.add({
                    targets: ball,
                    angle: 360,
                    duration: 1000,
                    repeat: -1,
                    ease: 'Linear',
                    paused: true // Start paused, will resume when game starts
                });
                
                // Store the tween reference
                playerObj.ballTween = ballTween;
                
                // Add indicator
                const indicatorOffsetY = 80 * perspectiveScale;
                const indicatorFontSize = Math.floor(20 * perspectiveScale);
                const indicator = this.add.text(x, y - indicatorOffsetY, 'YOU', {
                    fontSize: `${indicatorFontSize}px`,
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
        
        // Resume all player animations
        this.players.forEach(player => {
            if (player.sprite && player.sprite.anims) {
                player.sprite.anims.resume();
            }
            // Resume ball rotation animation
            if (player.ballTween) {
                player.ballTween.resume();
            }
        });
    }
    
    update(time, delta) {
        // Don't skip update entirely - we need it for tweens and timers to work
        if (!this.isRunning && !this.isShooting) return;
        
        // Log occasionally to see if update is running
        if (this.isShooting && Math.random() < 0.02) {
            console.log('UPDATE RUNNING during shooting - isRunning:', this.isRunning, 'isShooting:', this.isShooting);
        }
        
        // If shooting, skip game logic but let the method continue
        // (Phaser processes tweens/timers during update, so we can't return early)
        if (!this.isShooting) {
            // Only run normal game logic when not shooting
            const deltaSeconds = delta / 1000;
            this.elapsedTime += deltaSeconds;
            
            // Update multiplier (unless paused waiting for interactions)
            if (!this.multiplierPaused) {
                this.currentMultiplier += GameConfig.MULTIPLIER_INCREASE_RATE * deltaSeconds;
                this.currentMultiplier = Math.min(this.currentMultiplier, GameConfig.MAX_MULTIPLIER);
            }
            
            // Calculate actual cash value
            const currentCashValue = (this.currentMultiplier * this.selectedStake) / 100;
            
            
            // Update display
            this.cashValueText.setText(this.formatCashValue(this.currentMultiplier));
            
            // Scroll the world (move background and opponents)
            this.scrollWorld(deltaSeconds);
            
            // Spawn and move opponents
            this.updateOpponents(deltaSeconds);
            
            // Check for crashes
            this.checkCrashes();
        }
        
        // Check for decision points based on cash value (multiplier)
        if (this.currentDecisionIndex < this.decisionMultipliers.length && !this.waitingForDecision && !this.decisionTriggered) {
            const targetMultiplier = this.decisionMultipliers[this.currentDecisionIndex];
            
            if (this.currentMultiplier >= targetMultiplier) {
                // PAUSE MULTIPLIER at target
                if (!this.multiplierPaused) {
                    this.multiplierPaused = true;
                    this.currentMultiplier = targetMultiplier; // Clamp to exact target
                }
                
                // For first decision, check if all pre-decision interactions complete
                if (this.isPreFirstDecision) {
                    // If opponents spawned, wait for all interactions to complete
                    if (this.preDecisionOpponentCount > 0 && !this.preDecisionAllInteractionsComplete) {
                        // Still waiting for interactions...
                    } else {
                        this.isPreFirstDecision = false;
                        this.waitingForDecision = true;
                        this.decisionTriggered = true;
                        this.triggerDecisionInterval();
                    }
                } else {
                    // For subsequent decisions, trigger immediately
                    // Opposition will be cleared in triggerDecisionInterval
                    this.waitingForDecision = true;
                    this.decisionTriggered = true;
                    this.triggerDecisionInterval();
                }
            }
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
        
        // Track distance traveled and update ball/indicator positions (unless shooting)
        if (!this.isShooting) {
            this.players.forEach((player, index) => {
                if (player.active) {
                    this.playerPositions[index] += moveDistance;
                    
                    // Update ball position if this player has it (with perspective scaling)
                    if (player.hasBall && player.ball) {
                        const scale = player.perspectiveScale || 1.0;
                        player.ball.x = player.sprite.x + (47 * scale);
                        player.ball.y = player.sprite.y + (40 * scale);
                    }
                    
                    // Update indicator position (with perspective scaling)
                    if (player.indicator) {
                        const scale = player.perspectiveScale || 1.0;
                        player.indicator.x = player.sprite.x;
                        player.indicator.y = player.sprite.y - (80 * scale);
                    }
                }
            });
        }
        
        // Move pitch background tiles to the left (creates illusion of player moving right)
        this.backgroundTiles.forEach(tile => {
            tile.x -= moveDistance;
        });
        
        // Move goal overlay with the world
        this.goalOverlay.x -= moveDistance;
        
        // Keep players centered on screen (they don't actually move horizontally)
        // Players stay at their fixed positions while world scrolls
    }
    
    updateOpponents(deltaSeconds) {
        // Block all spawning if test mode is enabled
        if (this.testModeEnabled) {
            return; // Skip all opposition spawning in test mode
        }
        
        // Block all spawning if waiting for decision
        if (this.waitingForDecision) {
            // Don't spawn anything while decision window is ready
        } else if (this.isPreFirstDecision && !this.preDecisionOpponentsSpawned) {
            // PRE-FIRST DECISION: Spawn 0-4 opponents (random), one per lane max
            const opponentCount = Math.floor(Math.random() * 5); // 0, 1, 2, 3, or 4
            
            if (opponentCount > 0) {
                // Select random lanes (shuffle and take first N)
                const allLanes = [0, 1, 2, 3];
                const shuffledLanes = allLanes.sort(() => Math.random() - 0.5);
                const selectedLanes = shuffledLanes.slice(0, opponentCount);
                
                // Spawn all opponents at the same time
                selectedLanes.forEach((lane, index) => {
                    if (this.players[lane] && this.players[lane].active) {
                        this.spawnOpponent(lane);
                    }
                });
                
                this.preDecisionOpponentCount = opponentCount;
            } else {
                this.preDecisionOpponentCount = 0;
            }
            
            this.preDecisionOpponentsSpawned = true;
        } else if (!this.isPreFirstDecision && !this.currentWaveActive && !this.waveSpawnedThisSection) {
            // WAVE SYSTEM: After first decision
            // Only start new wave if no wave has been spawned for this decision section yet
            this.startNewWave();
            this.waveSpawnedThisSection = true; // Mark that a wave has been spawned for this section
        } else if (this.currentWaveActive && this.waveOpponentsSpawned < this.currentWaveCount) {
            // Spawn wave opponents with spacing
            if (!this.lastOpponentSpawnTime || this.elapsedTime - this.lastOpponentSpawnTime > 0.8) {
                this.spawnWaveOpponent();
                this.lastOpponentSpawnTime = this.elapsedTime;
            }
        }
        
        // Move opponents (they scroll left with the world, but 1.5x faster)
        const moveDistance = GameConfig.RUNNING_SPEED * deltaSeconds * 1.5; // 1.5x world speed
        
        this.opponents.forEach((laneOpponents, laneIndex) => {
            laneOpponents.forEach((opponent, oppIndex) => {
                opponent.x -= moveDistance; // Move left faster than world scroll
                
                // Remove if off screen (left side)
                if (opponent.x < -50) {
                    opponent.destroy();
                    laneOpponents.splice(oppIndex, 1);
                }
            });
        });
        
        // Check if wave is complete (all opponents gone)
        if (this.currentWaveActive && this.waveOpponentsSpawned === this.currentWaveCount) {
            const totalOpponents = this.opponents.reduce((sum, lane) => sum + lane.length, 0);
            if (totalOpponents === 0) {
                this.currentWaveActive = false;
                this.allWaveOpponentsGone = true;
            }
        }
    }
    
    startNewWave() {
        // Random wave size: 0-3 opponents
        this.currentWaveCount = Math.floor(Math.random() * 4); // 0, 1, 2, or 3
        this.waveOpponentsSpawned = 0;
        this.currentWaveActive = true;
        this.allWaveOpponentsGone = false;
        this.lastOpponentSpawnTime = this.elapsedTime;
        
        // If wave is 0, immediately mark as complete
        if (this.currentWaveCount === 0) {
            this.currentWaveActive = false;
            this.allWaveOpponentsGone = true;
        }
    }
    
    spawnWaveOpponent() {
        // Pick a random lane with an active player
        const activeLanes = [];
        this.players.forEach((player, index) => {
            if (player.active) activeLanes.push(index);
        });
        
        if (activeLanes.length === 0) return;
        
        const randomLane = activeLanes[Math.floor(Math.random() * activeLanes.length)];
        this.spawnOpponent(randomLane);
        this.waveOpponentsSpawned++;
    }
    
    spawnOpponent(lane) {
        // Don't spawn too many opponents
        if (this.opponents[lane].length >= 2) return;
        
        const width = this.cameras.main.width;
        
        // Horizontal stagger matching player positions
        const horizontalStagger = [240, 160, 80, 0]; // Lane 1 furthest back, Lane 4 most forward (80px gaps each)
        
        // For pre-decision opponents, spawn so all interactions happen within 3 seconds
        // Player is at x=200, opponents move at 150px/s (1.5x world speed)
        // Spawn at various distances: 375px = 2.5s, 300px = 2.0s, 225px = 1.5s travel time
        let x;
        if (this.isPreFirstDecision && !this.preDecisionAllInteractionsComplete) {
            // Random spawn distance 225-375 pixels from player (1.5-2.5 seconds at 150px/s)
            const distance = 225 + Math.random() * 150;
            x = 200 + horizontalStagger[lane] + distance;
        } else {
            x = width - 50 + horizontalStagger[lane]; // Normal spawn at right edge of screen
        }
        
        // Apply same vertical adjustments as players
        const verticalAdjustments = [0.30, -0.40, -0.60, -0.55]; // Lane 1: +30% down, Lane 2: -40% up, Lane 3: -60% up, Lane 4: -55% up
        const baseY = this.pitchY + this.laneHeight * lane + this.laneHeight / 2;
        const yAdjustment = this.laneHeight * verticalAdjustments[lane];
        const y = baseY + yAdjustment;
        
        // Get perspective scale for this lane
        const perspectiveScales = [1.0, 1.33, 1.66, 2.0];
        const perspectiveScale = perspectiveScales[lane];
        
        // Create animated opposition sprite with perspective scaling
        const opponent = this.add.sprite(x, y, 'opposition_run');
        opponent.setScale(0.5 * perspectiveScale); // Match player scale in this lane
        opponent.play('opposition_run_anim');
        opponent.isAnimated = true; // Track if this is animated or static
        opponent.collisionFlag = 0; // 0 = can collide, 1 = already collided
        opponent.perspectiveScale = perspectiveScale; // Store for later use
        
        this.opponents[lane].push(opponent);
    }
    
    checkCrashes() {
        this.players.forEach((player, playerIndex) => {
            if (!player.active) return;
            
            const playerX = player.sprite.x;
            const playerY = player.sprite.y;
            
            this.opponents[playerIndex].forEach((opponent, oppIndex) => {
                // Only process collision if flag is 0 (not yet collided)
                if (opponent.collisionFlag !== 0) return;
                
                const distance = Phaser.Math.Distance.Between(
                    playerX, playerY,
                    opponent.x, opponent.y
                );
                
                // Scale collision distance based on perspective (larger players = larger collision)
                const perspectiveScale = player.perspectiveScale || 1.0;
                const collisionDistance = 38 * perspectiveScale;
                
                if (distance < collisionDistance) {
                    // IMMEDIATELY set flag to 1 to prevent any re-processing
                    opponent.collisionFlag = 1;
                    
                    // Determine outcome: 25% skill, 25% dodge, 50% tackle
                    const outcomeRandom = Math.floor(Math.random() * 4) + 1;
                    let outcome;
                    
                    if (outcomeRandom === 1) {
                        outcome = 'skill';
                    } else if (outcomeRandom === 2) {
                        outcome = 'dodge';
                    } else {
                        outcome = 'tackle'; // 3 or 4
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
                    
                    // Track pre-decision interactions
                    if (this.isPreFirstDecision && this.preDecisionOpponentsSpawned) {
                        if (this.preDecisionInteractionsRemaining === 0) {
                            // First interaction - set counter
                            this.preDecisionInteractionsRemaining = this.preDecisionOpponentCount;
                        }
                        
                        // Decrement interaction counter
                        this.preDecisionInteractionsRemaining--;
                        
                        // If all interactions complete, wait 2 seconds
                        if (this.preDecisionInteractionsRemaining === 0) {
                            this.time.delayedCall(2000, () => {
                                this.preDecisionAllInteractionsComplete = true;
                            });
                        }
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
        
        // Preserve perspective scale
        const perspectiveScale = opponent.perspectiveScale || 1.0;
        opponent.destroy();
        
        // Create static image at same position with same scale
        const staticImage = this.add.image(x, y, imageKey);
        staticImage.setScale(0.5 * perspectiveScale); // Match opponent scale
        staticImage.isAnimated = false; // Mark as static
        staticImage.collisionFlag = 1; // Already collided, prevent re-collision
        staticImage.perspectiveScale = perspectiveScale; // Preserve scale
        
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
        
        // Get perspective scale for this lane
        const perspectiveScale = player.perspectiveScale || 1.0;
        
        // Replace opponent with tackle image
        if (opponent) {
            const oppX = opponent.x;
            const oppY = opponent.y;
            const oppScale = opponent.perspectiveScale || perspectiveScale;
            
            // Stop and destroy opponent sprite
            if (opponent.isAnimated) {
                opponent.stop();
            }
            opponent.destroy();
            
            // Create tackle static image with perspective scaling
            const tackleImage = this.add.image(oppX, oppY, 'opposition_tackle');
            tackleImage.setScale(0.5 * oppScale);
            tackleImage.isAnimated = false;
            tackleImage.collisionFlag = 1; // Already collided, prevent re-collision
            tackleImage.perspectiveScale = oppScale;
            
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
        
        // Create dive static image with perspective scaling
        const diveImage = this.add.image(playerX, playerY, 'player_dive');
        diveImage.setScale(0.5 * perspectiveScale);
        
        // Replace sprite reference
        player.sprite = diveImage;
        
        // Remove dive image after 1 second
        this.time.delayedCall(1000, () => {
            if (diveImage && diveImage.active) {
                diveImage.destroy();
            }
        });
        
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
        
        // Check if the crashed player had the ball - if so, GAME OVER
        if (player.hasBall) {
            player.hasBall = false;
            player.ball = null;
            
            // Game over - player with ball was tackled
            this.time.delayedCall(1500, () => {
                this.gameOver();
            });
        }
    }
    
    handlePassAnimation(targetLane) {
        // Make sure scene is not paused
        if (this.scene.isPaused()) {
            this.scene.resume();
        }
        
        this.isRunning = false;
        
        const currentPlayer = this.players[this.selectedPlayer];
        const targetPlayer = this.players[targetLane];
        
        if (!currentPlayer.ball) {
            console.error('Error: Current player has no ball object');
            return;
        }
        
        const ball = currentPlayer.ball;
        
        // Get perspective scales for both players
        const currentScale = currentPlayer.perspectiveScale;
        const targetScale = targetPlayer.perspectiveScale;
        
        // Calculate positions with perspective-scaled offsets
        const targetOffsetX = 47 * targetScale;
        const targetOffsetY = 40 * targetScale;
        const targetX = targetPlayer.sprite.x + targetOffsetX;
        const targetY = targetPlayer.sprite.y + targetOffsetY;
        
        // Calculate ball scales
        const currentBallScale = 0.08 * currentScale;
        const targetBallScale = 0.08 * targetScale;
        
        // Remove all indicators
        this.players.forEach((p) => {
            if (p.indicator) {
                p.indicator.destroy();
                p.indicator = null;
            }
        });
        
        // Kill existing tweens and create pass animation WITH SCALE
        this.tweens.killTweensOf(ball);
        
        this.tweens.add({
            targets: ball,
            x: targetX,
            y: targetY,
            scale: targetBallScale, // Animate the ball scale during pass
            duration: 1000,
            ease: 'Quad.easeOut',
            onComplete: () => {
                // Transfer ownership
                currentPlayer.hasBall = false;
                currentPlayer.ball = null;
                targetPlayer.hasBall = true;
                targetPlayer.ball = ball;
                
                // Update selected player
                this.selectedPlayer = targetLane;
                this.registry.set('selectedPlayer', targetLane);
                
                // Restart rotation
                this.tweens.add({
                    targets: ball,
                    angle: 360,
                    duration: 1000,
                    repeat: -1,
                    ease: 'Linear'
                });
                
                // Add indicator with perspective scaling
                const indicatorOffsetY = 80 * targetScale;
                const indicatorFontSize = Math.floor(20 * targetScale);
                const indicator = this.add.text(
                    targetPlayer.sprite.x,
                    targetPlayer.sprite.y - indicatorOffsetY,
                    'YOU',
                    {
                        fontSize: `${indicatorFontSize}px`,
                        fontStyle: 'bold',
                        fill: '#ffff00'
                    }
                ).setOrigin(0.5);
                
                targetPlayer.indicator = indicator;
                this.resumeRunning();
            }
        });
        
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
    
    handleShooting() {
        // Force isRunning to true for shooting (it may have been paused by DecisionScene)
        this.isRunning = true;
        
        // Get current player with ball
        const currentPlayer = this.players[this.selectedPlayer];
        const ball = currentPlayer.ball;
        
        if (!ball) {
            console.error('No ball found for shooting');
            return;
        }
        
        if (!this.goalOverlay) {
            console.error('Goal overlay not found');
            return;
        }
        
        // Determine if shot will be a goal based on player's lane
        // Better accuracy from lanes closer to center (lanes 1 and 2)
        const laneAccuracy = [0.7, 0.8, 0.6, 0.5]; // Lane 0-3 accuracy rates
        const willScore = Math.random() < laneAccuracy[this.selectedPlayer];
        
        // Hide the ball at player's feet
        ball.setVisible(false);
        
        // Hide indicator during shot
        if (currentPlayer.indicator) {
            currentPlayer.indicator.setVisible(false);
        }
        
        // Create a new ball for the shooting animation
        const shootingBall = this.add.image(
            currentPlayer.sprite.x + (47 * currentPlayer.perspectiveScale),
            currentPlayer.sprite.y + (40 * currentPlayer.perspectiveScale),
            'football'
        );
        shootingBall.setScale(0.08 * currentPlayer.perspectiveScale);
        shootingBall.setDepth(1002); // Above everything initially
        
        // Ball stays at a fixed screen position (like the player)
        const ballScreenX = shootingBall.x;
        const ballStartY = shootingBall.y;
        
        // Calculate how far we need to scroll to reach the END of the background
        // Background ends at pitchWidth
        const distanceToEnd = this.pitchWidth - ballScreenX;
        const distanceToGoal = this.goalOverlay.x - ballScreenX;
        
        console.log('Goal overlay at:', this.goalOverlay.x);
        console.log('Background end at:', this.pitchWidth);
        console.log('Ball screen position:', ballScreenX);
        console.log('Distance to goal:', distanceToGoal);
        console.log('Distance to end:', distanceToEnd);
        
        // Fixed durations for consistent gameplay
        const shotDuration = 4000; // Total shot takes 4 seconds
        
        // Arc height varies by lane - higher lanes (0) shoot lower, lower lanes (3) shoot higher
        // Lane 0 (top) = 150px arc, Lane 3 (bottom) = 350px arc
        // This keeps the ball within the background height (1200px)
        const arcHeightByLane = [150, 220, 280, 350]; // Lane 0-3 arc heights
        const arcHeight = arcHeightByLane[this.selectedPlayer];
        
        // Calculate scroll speed to reach END of background in 4 seconds
        const baseSpeed = distanceToEnd / (shotDuration / 1000);
        const scrollSpeed = baseSpeed * 1.5; // 1.5x to ensure we reach the end
        
        console.log('Base speed:', baseSpeed, 'px/s');
        console.log('Final scroll speed:', scrollSpeed, 'px/s');
        console.log('In 4 seconds will scroll:', scrollSpeed * 4, 'pixels');
        
        // Check if scene is paused
        console.log('Scene paused?', this.scene.isPaused(), 'Scene active?', this.scene.isActive());
        
        // Make sure scene is not paused
        if (this.scene.isPaused()) {
            console.log('Scene was paused, resuming...');
            this.scene.resume();
        }
        
        // Set shooting flag (keep isRunning true so tweens work)
        this.isShooting = true;
        console.log('Set isShooting to true, isRunning:', this.isRunning);
        
        // Animate the ball in an arc
        console.log('Starting arc animation, duration:', shotDuration);
        const arcUpTween = this.tweens.add({
            targets: shootingBall,
            y: ballStartY - arcHeight, // Go up
            duration: shotDuration / 2,
            ease: 'Quad.easeOut',
            onStart: () => {
                console.log('Arc up animation STARTED - tween is working!');
            },
            onUpdate: () => {
                // Log periodically during animation
                if (Math.random() < 0.05) { // 5% chance per frame
                    console.log('Arc animation updating, ball Y:', shootingBall.y);
                }
            },
            onComplete: () => {
                console.log('Arc up complete, ball coming down');
                // Ball comes back down - lands at bottom of screen for miss, or into goal
                const finalY = willScore ? 
                    ballStartY + 100 : // Land lower into goal area
                    1100; // Land near bottom of screen (miss - hits ground)
                
                this.tweens.add({
                    targets: shootingBall,
                    y: finalY,
                    duration: shotDuration / 2,
                    ease: 'Quad.easeIn',
                    onComplete: () => {
                        console.log('Arc down complete, adding bounce');
                        // Bounce when ball hits the ground/goal
                        const bounceHeight = willScore ? 40 : 60; // Bigger bounce for miss
                        this.tweens.add({
                            targets: shootingBall,
                            y: finalY - bounceHeight,
                            duration: 250,
                            ease: 'Quad.easeOut',
                            onComplete: () => {
                                // Ball settles after bounce
                                this.tweens.add({
                                    targets: shootingBall,
                                    y: finalY,
                                    duration: 250,
                                    ease: 'Bounce.easeOut',
                                    onComplete: () => {
                                        console.log('Ball settled, animation complete');
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
        
        console.log('Arc tween created:', arcUpTween ? 'success' : 'failed');
        
        // Spin the ball - more rotations for longer flight
        this.tweens.add({
            targets: shootingBall,
            angle: 1800, // 5 full rotations (increased from 3)
            duration: shotDuration,
            ease: 'Linear'
        });
        
        // Scale the ball (grows as it goes "further away")
        this.tweens.add({
            targets: shootingBall,
            scale: 0.08 * currentPlayer.perspectiveScale * 2.5, // Grows 2.5x (increased from 1.5x)
            duration: shotDuration,
            ease: 'Linear'
        });
        
        // Move ball horizontally across screen - 450 pixels past the visible edge
        this.tweens.add({
            targets: shootingBall,
            x: 1250, // Move 450 pixels past the right edge of screen (800 + 450 = 1250)
            duration: shotDuration,
            ease: 'Linear'
        });
        
        // Scroll the world to the goal at high speed
        console.log('Setting up scroll interval');
        const scrollStartTime = this.time.now;
        const scrollStartCameraX = this.cameraScrollX; // Track starting position
        let frameCount = 0;
        let ballHasLanded = false;
        
        const scrollInterval = this.time.addEvent({
            delay: 16, // Run every frame (~60fps)
            repeat: Math.ceil(shotDuration / 16), // 250 frames for 4 seconds
            callback: () => {
                if (frameCount === 0) {
                    console.log('FIRST CALLBACK EXECUTED!');
                }
                frameCount++;
                if (frameCount <= 5 || frameCount % 30 === 0) { // Log first 5 frames and then every 30 frames
                    console.log('Scroll frame:', frameCount, 'Ball at:', shootingBall.x, shootingBall.y);
                }
                
                const elapsed = this.time.now - scrollStartTime;
                const progress = Math.min(elapsed / shotDuration, 1);
                
                // Calculate how much to scroll this frame at constant high speed
                const frameTime = 16 / 1000; // 16ms in seconds
                const scrollThisFrame = scrollSpeed * frameTime;
                
                if (frameCount <= 5) {
                    console.log('Scrolling:', scrollThisFrame, 'pixels this frame, speed:', scrollSpeed);
                }
                
                // Keep scrolling continuously - don't stop
                // Move background tiles manually at high speed
                this.backgroundTiles.forEach(tile => {
                    tile.x -= scrollThisFrame;
                });
                
                // Move goal overlay at high speed
                this.goalOverlay.x -= scrollThisFrame;
                
                // Update camera scroll tracking
                this.cameraScrollX += scrollThisFrame;
                
                // Move all players left with the background at same speed
                this.players.forEach((player) => {
                    if (player.sprite) {
                        player.sprite.x -= scrollThisFrame;
                    }
                    // Don't update ball position - shooting ball is separate
                    // Just update indicator if it exists
                    if (player.indicator) {
                        player.indicator.x -= scrollThisFrame;
                    }
                });
                
                // Move all opponents left with the background at same speed
                this.opponents.forEach((laneOpponents) => {
                    laneOpponents.forEach((opponent) => {
                        if (opponent && opponent.active !== false) {
                            opponent.x -= scrollThisFrame;
                        }
                    });
                });
                
                // Ball moves with tween (no longer fixed at ballScreenX)
                // Calculate how far we've scrolled
                const totalScrolledDistance = (this.cameraScrollX - scrollStartCameraX);
                
                // Check if goal has reached the ball's current position (ball is moving to 800)
                const goalReachedBall = this.goalOverlay.x <= shootingBall.x;
                
                // Set ball depth when goal reaches ball position
                if (goalReachedBall && !ballHasLanded) {
                    ballHasLanded = true;
                    console.log('Goal reached ball! Goal at:', this.goalOverlay.x, 'Ball at:', shootingBall.x, 'Scrolled:', totalScrolledDistance);
                    
                    // Set ball depth based on result
                    if (willScore) {
                        shootingBall.setDepth(999); // Behind goal overlay (scored)
                    } else {
                        shootingBall.setDepth(1001); // In front of goal overlay (missed)
                    }
                }
                
                // When time is up (4 seconds)
                if (progress >= 1) {
                    console.log('4 seconds complete! Total scrolled:', totalScrolledDistance, '/', distanceToEnd);
                    scrollInterval.remove();
                    
                    // Wait 6 seconds after animation completes before showing result
                    this.time.delayedCall(6000, () => {
                        console.log('Transitioning to outcome scene');
                        this.isShooting = false;
                        this.handleShootingResult(willScore);
                    });
                }
            }
        });
        
        console.log('Scroll interval created, will run for', Math.ceil(shotDuration / 16), 'frames');
    }
    
    handleShootingResult(scored) {
        if (scored) {
            // Goal scored - show success and proceed
            const finalMultiplier = this.registry.get('currentMultiplier') || 1.0;
            const selectedStake = this.registry.get('selectedStake') || 100;
            const finalValue = (selectedStake / 100) * finalMultiplier;
            
            this.registry.set('finalMultiplier', finalMultiplier);
            this.registry.set('finalValue', finalValue);
            this.registry.set('outcomeType', 'goal');
            
            this.scene.start('OutcomeScene');
        } else {
            // Miss - player loses
            this.registry.set('finalMultiplier', 0);
            this.registry.set('finalValue', 0);
            this.registry.set('outcomeType', 'miss');
            
            this.scene.start('OutcomeScene');
        }
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
        
        // Remove ALL opponents from screen before showing decision panel
        // Players should not see any opposition during decision making
        this.opponents.forEach((laneOpponents, laneIndex) => {
            laneOpponents.forEach(opponent => {
                opponent.destroy();
            });
            laneOpponents.length = 0; // Clear the array
        });
        
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
        this.waitingForDecision = false; // Allow spawning again
        this.decisionTriggered = false; // Reset for next decision
        
        // RESUME multiplier counting
        this.multiplierPaused = false;
        
        // Move to next decision index
        this.currentDecisionIndex++;
        
        // Reset wave state for next wave - start fresh
        this.currentWaveActive = false;
        this.allWaveOpponentsGone = true; // Set to true so new wave can start immediately
        this.waveOpponentsSpawned = 0;
        this.currentWaveCount = 0;
        this.waveSpawnedThisSection = false; // Reset flag for new decision section
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
