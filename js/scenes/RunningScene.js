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
        
        // Set up scene wake handler for bonus round returns (using wake instead of resume)
        this.events.on('wake', () => {
            console.log('RunningScene woken - checking sprite visibility');
            
            // Ensure all sprites are visible (scene.sleep() should preserve them)
            this.players.forEach((player, index) => {
                console.log(`Player ${index}:`, {
                    active: player.active,
                    hasSprite: !!player.sprite,
                    spriteVisible: player.sprite ? player.sprite.visible : 'no sprite',
                    hasBall: player.hasBall,
                    ballVisible: player.ball ? player.ball.visible : 'no ball',
                    indicatorVisible: player.indicator ? player.indicator.visible : 'no indicator'
                });
                
                // Make sure sprites are visible
                if (player.sprite) {
                    player.sprite.setVisible(true);
                }
                if (player.ball) {
                    player.ball.setVisible(true);
                }
                if (player.indicator) {
                    player.indicator.setVisible(true);
                }
            });
            
            // Just resume the game logic
            this.isRunning = true;
            this.multiplierPaused = false;
            
            // Still call restoreGameState for bonus animation handling
            if (this.savedGameState) {
                this.restoreGameState();
            } else {
                console.log('Game resumed after bonus round - no saved state');
            }
        });
        
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
        
        // Add goal overlay - position at the RIGHT EDGE to overlay the last background section
        // The goal should be at the end of the pitch (right side)
        this.goalOverlay = this.add.image(0, this.pitchY, 'goal_overlay')
            .setOrigin(0, 0); // Same origin as background tiles
        
        // Scale the goal overlay to match background height (same scaleY as background)
        this.goalOverlay.setScale(scaleY); // Use same scale as background tiles
        
        // Position goal - move 110% further right from the calculated edge position
        const goalWidth = this.goalOverlay.width * scaleY;
        const basePosition = this.pitchWidth - goalWidth;
        const rightwardAdjustment = goalWidth * 1.1; // Move 110% of goal width to the right (30% + 50% + 30%)
        this.goalOverlay.x = basePosition + rightwardAdjustment;
        
        // Set high z-index/depth to ensure it's on top of background
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
        // Allow update to run during shooting (for tweens and timers)
        if (!this.isRunning && !this.isShooting) return;
        
        // If shooting, skip normal game logic but continue method execution
        // This allows Phaser's tweens and timers to process
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
        const forceBonus = this.registry.get('forceBonus') || false;
        
        if (forceBonus) {
            // Force Bonus Mode: Spawn opponent in EVERY active lane simultaneously
            const activeLanes = [];
            this.players.forEach((player, index) => {
                if (player.active) activeLanes.push(index);
            });
            
            console.log('Force Bonus Wave: Spawning opponents in all active lanes:', activeLanes);
            
            // Spawn all opponents immediately at the same distance
            activeLanes.forEach(lane => {
                this.spawnOpponent(lane, true); // Pass true to indicate synchronized spawn
            });
            
            this.currentWaveCount = activeLanes.length;
            this.waveOpponentsSpawned = activeLanes.length;
            this.currentWaveActive = true;
            this.allWaveOpponentsGone = false;
        } else {
            // Normal mode: Random wave size: 0-3 opponents
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
    
    spawnOpponent(lane, synchronizedSpawn = false) {
        // Don't spawn too many opponents (unless synchronized Force Bonus spawn)
        if (!synchronizedSpawn && this.opponents[lane].length >= 2) return;
        
        const width = this.cameras.main.width;
        
        // Horizontal stagger matching player positions
        const horizontalStagger = [240, 160, 80, 0]; // Lane 1 furthest back, Lane 4 most forward (80px gaps each)
        
        // For synchronized spawns (Force Bonus), spawn at fixed distance so all collide together
        // For pre-decision opponents, spawn so all interactions happen within 3 seconds
        // Player is at x=200, opponents move at 150px/s (1.5x world speed)
        // Spawn at various distances: 375px = 2.5s, 300px = 2.0s, 225px = 1.5s travel time
        let x;
        if (synchronizedSpawn) {
            // Force Bonus: All opponents spawn at same distance (300px = 2.0 seconds travel time)
            const distance = 300;
            x = 200 + horizontalStagger[lane] + distance;
        } else if (this.isPreFirstDecision && !this.preDecisionAllInteractionsComplete) {
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
        
        // Store reference to the opposition that caused the tackle (for bonus round)
        if (opponent) {
            this.lastTackler = opponent;
        }
        
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
        
        // Check if the crashed player had the ball - if so, check for bonus round
        if (player.hasBall) {
            // IMPORTANT: Save which player had the ball
            this.bonusRoundPlayerIndex = playerIndex;
            
            // Stop the game immediately
            this.isRunning = false;
            
            // Check for bonus round
            const forceBonus = this.registry.get('forceBonus') || false;
            
            // If Force Bonus is enabled, ALWAYS trigger bonus (100% chance)
            // Otherwise, 1 in 5 chance (20%)
            const randomValue = Math.random();
            const bonusTriggered = forceBonus || (randomValue < 0.2);
            
            console.log('Player with ball tackled!', {
                playerIndex: playerIndex,
                forceBonus: forceBonus,
                randomValue: randomValue,
                bonusTriggered: bonusTriggered
            });
            
            if (bonusTriggered) {
                console.log(`Bonus triggered! Player ${playerIndex} will respawn after bonus round`);
                
                // Show referee and trigger bonus round
                console.log('Bonus round will trigger in 1.5 seconds...');
                this.time.delayedCall(1500, () => {
                    this.showRefereeAndStartBonus();
                });
            } else {
                // No bonus - clear ball reference and proceed to game over
                player.hasBall = false;
                player.ball = null;
                // Game over - player with ball was tackled
                console.log('No bonus - game over in 1.5 seconds...');
                this.time.delayedCall(1500, () => {
                    this.gameOver();
                });
            }
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
        // Make sure scene is active and not paused
        if (this.scene.isPaused()) {
            this.scene.resume();
        }
        
        // Set flags to allow update to run
        this.isShooting = true;
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
        
        // Hide the ball at player's feet
        ball.setVisible(false);
        
        // Hide indicator during shot
        if (currentPlayer.indicator) {
            currentPlayer.indicator.setVisible(false);
        }
        
        // Create a new ball for the shooting animation at player's position
        const shootingBall = this.add.image(
            currentPlayer.sprite.x + (47 * currentPlayer.perspectiveScale),
            currentPlayer.sprite.y + (40 * currentPlayer.perspectiveScale),
            'football'
        );
        shootingBall.setScale(0.08 * currentPlayer.perspectiveScale);
        shootingBall.setDepth(1002);
        
        // Check if we're forcing a goal (test mode)
        const forceGoal = this.registry.get('forceGoal') || false;
        
        // Determine if shot will score
        // In test mode, always score. Otherwise, random chance (you can adjust this later)
        const willScore = forceGoal ? true : (Math.random() > 0.5);
        
        // Calculate target: right side of goal
        const goalRightEdge = this.goalOverlay.x + (this.goalOverlay.width * this.goalOverlay.scaleX);
        const goalTop = this.goalOverlay.y;
        const goalHeight = this.goalOverlay.height * this.goalOverlay.scaleY;
        const goalCenterY = goalTop + (goalHeight / 2);
        
        // Ball landing position depends on whether it's a goal or miss
        // Goal: 30% from top (higher)
        // Miss: 80% from top (lower)
        const ballLandingY = willScore 
            ? goalTop + (goalHeight * 0.3) 
            : goalTop + (goalHeight * 0.8);
        
        // Arc height based on lane (higher lanes = lower arc)
        const arcHeights = [200, 280, 350, 420];
        const arcHeight = arcHeights[this.selectedPlayer];
        
        // Ball movement - starts at player, moves forward slowly
        const ballStartX = shootingBall.x;
        const ballStartY = shootingBall.y;
        const ballForwardMovement = 300; // Ball moves only 300px forward (slower)
        const ballTargetX = ballStartX + ballForwardMovement;
        
        // Calculate how much the world needs to scroll to bring goal to ball
        // The background will scroll much faster than the ball moves
        const distanceToGoal = goalRightEdge - ballTargetX - 80; // Goal needs to reach ball + 80px offset
        
        // Calculate shot duration - minimum 4 seconds for good animation feel
        const minShotDuration = 4000; // Minimum 4 seconds
        const scrollSpeed = 500; // Fixed comfortable speed (pixels per second)
        const calculatedDuration = (distanceToGoal / scrollSpeed) * 1000; // Convert to milliseconds
        const shotDuration = Math.max(minShotDuration, calculatedDuration);
        
        // Adjust scroll speed to match the duration
        const actualScrollSpeed = distanceToGoal / (shotDuration / 1000);
        
        console.log('Shooting setup:', {
            goalRightEdge,
            ballTargetX,
            distanceToGoal,
            scrollSpeed: actualScrollSpeed,
            shotDuration
        });
        
        // Target ball size: same as player 4's ball (0.08 * 2.0 = 0.16)
        const targetBallScale = 0.16;
        
        // Create multiplier text in center of screen
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const multiplierText = this.add.text(width / 2, height / 2, '1.0x', {
            fontSize: '120px',
            fontStyle: 'bold',
            fill: '#FFD700', // Gold color
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
        
        // Animate multiplier from 1.0x to 10.0x over the shot duration
        let currentMultiplier = 1.0;
        const maxMultiplier = 10.0;
        const multiplierIncrement = (maxMultiplier - 1.0) / (shotDuration / 50); // Update every 50ms
        
        const multiplierTimer = this.time.addEvent({
            delay: 50,
            repeat: shotDuration / 50,
            callback: () => {
                currentMultiplier += multiplierIncrement;
                if (currentMultiplier <= maxMultiplier) {
                    multiplierText.setText(currentMultiplier.toFixed(1) + 'x');
                }
            }
        });
        
        // Animate ball in arc pattern - moves forward slowly as it flies
        // Part 1: Ball goes UP and FORWARD (slowly)
        // Scale grows to halfway to target size
        const midScale = (shootingBall.scale + targetBallScale) / 2;
        this.tweens.add({
            targets: shootingBall,
            x: ballTargetX, // Move forward slowly
            y: ballStartY - arcHeight, // Go up
            scale: midScale, // Grow to midpoint
            duration: shotDuration * 0.5,
            ease: 'Quad.easeOut'
        });
        
        // Part 2: Ball comes DOWN (stays at forward position)
        // Scale reaches target (player 4's ball size)
        this.time.delayedCall(shotDuration * 0.5, () => {
            this.tweens.add({
                targets: shootingBall,
                y: ballLandingY, // Come down to goal height (80% down from top)
                scale: targetBallScale, // Grow to player 4's ball size
                duration: shotDuration * 0.5,
                ease: 'Quad.easeIn'
            });
        });
        
        // Spin the ball throughout flight
        this.tweens.add({
            targets: shootingBall,
            angle: 720, // 2 full rotations
            duration: shotDuration,
            ease: 'Linear'
        });
        
        // Scroll the world to bring goal to the ball
        const scrollStartTime = this.time.now;
        let totalScrolled = 0;
        let goalHit = false;
        let resultProcessed = false; // Prevent double-processing
        
        const scrollLoop = this.time.addEvent({
            delay: 16, // Every frame (~60fps)
            repeat: -1, // Repeat indefinitely until we stop it
            callback: () => {
                const elapsed = this.time.now - scrollStartTime;
                
                // Check if goal has reached the ball position
                const currentGoalRightEdge = this.goalOverlay.x + (this.goalOverlay.width * this.goalOverlay.scaleX);
                const ballCurrentX = shootingBall.x;
                
                // When goal right edge reaches ball (with 100px buffer)
                if (!goalHit && !resultProcessed && currentGoalRightEdge <= (ballCurrentX + 100)) {
                    goalHit = true;
                    resultProcessed = true; // Mark as processed
                    
                    // Ball hits the goal
                    shootingBall.setDepth(999); // Behind goal
                    
                    // Stop scrolling
                    scrollLoop.remove();
                    
                    // Stop multiplier timer
                    multiplierTimer.remove();
                    
                    // Show result based on willScore
                    if (willScore) {
                        // GOAL! Keep multiplier and add win text
                        // Current prize (shown at top) × shooting multiplier = Total Win
                        const currentPrizeInPence = this.selectedStake * this.currentMultiplier;
                        const totalWinInPence = currentPrizeInPence * currentMultiplier;
                        
                        // Add winnings to wallet
                        const currentBalance = this.registry.get('walletBalance') || 0;
                        this.registry.set('walletBalance', currentBalance + totalWinInPence);
                        
                        const youWinText = this.add.text(width / 2, height / 2 - 80, 'YOU WIN!!!', {
                            fontSize: '100px',
                            fontStyle: 'bold',
                            fill: '#00FF00',
                            stroke: '#000000',
                            strokeThickness: 10
                        }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
                        
                        const winText = this.add.text(width / 2, height / 2 + 50, 'You won:', {
                            fontSize: '45px',
                            fontStyle: 'bold',
                            fill: '#FFD700',
                            stroke: '#000000',
                            strokeThickness: 6
                        }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
                        
                        const amountText = this.add.text(width / 2, height / 2 + 120, `£${(totalWinInPence / 100).toFixed(2)}`, {
                            fontSize: '70px',
                            fontStyle: 'bold',
                            fill: '#00FF00',
                            stroke: '#000000',
                            strokeThickness: 8
                        }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
                        
                    } else {
                        // MISS! Remove multiplier and show game over
                        multiplierText.destroy();
                        
                        const stake = this.registry.get('selectedStake') || 100;
                        
                        const gameOverText = this.add.text(width / 2, height / 2 - 80, 'GAME OVER', {
                            fontSize: '80px',
                            fontStyle: 'bold',
                            fill: '#FF0000',
                            stroke: '#000000',
                            strokeThickness: 8
                        }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
                        
                        const missText = this.add.text(width / 2, height / 2, 'You Missed!', {
                            fontSize: '50px',
                            fontStyle: 'bold',
                            fill: '#FFFFFF',
                            stroke: '#000000',
                            strokeThickness: 6
                        }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
                        
                        const luckText = this.add.text(width / 2, height / 2 + 60, 'Better luck next time', {
                            fontSize: '40px',
                            fontStyle: 'bold',
                            fill: '#FFFFFF',
                            stroke: '#000000',
                            strokeThickness: 5
                        }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
                        
                        const lostText = this.add.text(width / 2, height / 2 + 120, `You have lost £${(stake / 100).toFixed(2)}`, {
                            fontSize: '35px',
                            fontStyle: 'bold',
                            fill: '#FF0000',
                            stroke: '#000000',
                            strokeThickness: 5
                        }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
                    }
                    
                    // Snap ball to goal and bounce
                    this.tweens.killTweensOf(shootingBall);
                    this.tweens.add({
                        targets: shootingBall,
                        x: currentGoalRightEdge - 80,
                        y: ballLandingY,
                        duration: 100,
                        ease: 'Power2',
                        onComplete: () => {
                            this.tweens.add({
                                targets: shootingBall,
                                x: currentGoalRightEdge - 100,
                                duration: 150,
                                ease: 'Bounce.easeOut',
                                onComplete: () => {
                                    // After bounce, wait 5 seconds then show result
                                    this.time.delayedCall(5000, () => {
                                        this.isShooting = false;
                                        this.handleShootingResult(willScore, currentMultiplier);
                                    });
                                }
                            });
                        }
                    });
                    return;
                }
                
                // Safety: if we've been scrolling too long, stop
                if (!resultProcessed && elapsed >= shotDuration + 3000) {
                    resultProcessed = true; // Mark as processed
                    scrollLoop.remove();
                    
                    // Stop multiplier timer
                    multiplierTimer.remove();
                    
                    // Show result based on willScore
                    if (willScore) {
                        // GOAL! Keep multiplier and add win text
                        // Current prize (shown at top) × shooting multiplier = Total Win
                        const currentPrizeInPence = this.selectedStake * this.currentMultiplier;
                        const totalWinInPence = currentPrizeInPence * currentMultiplier;
                        
                        // Add winnings to wallet
                        const currentBalance = this.registry.get('walletBalance') || 0;
                        this.registry.set('walletBalance', currentBalance + totalWinInPence);
                        
                        const youWinText = this.add.text(width / 2, height / 2 - 80, 'YOU WIN!!!', {
                            fontSize: '100px',
                            fontStyle: 'bold',
                            fill: '#00FF00',
                            stroke: '#000000',
                            strokeThickness: 10
                        }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
                        
                        const winText = this.add.text(width / 2, height / 2 + 50, 'You won:', {
                            fontSize: '45px',
                            fontStyle: 'bold',
                            fill: '#FFD700',
                            stroke: '#000000',
                            strokeThickness: 6
                        }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
                        
                        const amountText = this.add.text(width / 2, height / 2 + 120, `£${(totalWinInPence / 100).toFixed(2)}`, {
                            fontSize: '70px',
                            fontStyle: 'bold',
                            fill: '#00FF00',
                            stroke: '#000000',
                            strokeThickness: 8
                        }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
                        
                    } else {
                        // MISS! Remove multiplier and show game over
                        multiplierText.destroy();
                        
                        const stake = this.registry.get('selectedStake') || 100;
                        
                        const gameOverText = this.add.text(width / 2, height / 2 - 80, 'GAME OVER', {
                            fontSize: '80px',
                            fontStyle: 'bold',
                            fill: '#FF0000',
                            stroke: '#000000',
                            strokeThickness: 8
                        }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
                        
                        const missText = this.add.text(width / 2, height / 2, 'You Missed!', {
                            fontSize: '50px',
                            fontStyle: 'bold',
                            fill: '#FFFFFF',
                            stroke: '#000000',
                            strokeThickness: 6
                        }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
                        
                        const luckText = this.add.text(width / 2, height / 2 + 60, 'Better luck next time', {
                            fontSize: '40px',
                            fontStyle: 'bold',
                            fill: '#FFFFFF',
                            stroke: '#000000',
                            strokeThickness: 5
                        }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
                        
                        const lostText = this.add.text(width / 2, height / 2 + 120, `You have lost £${(stake / 100).toFixed(2)}`, {
                            fontSize: '35px',
                            fontStyle: 'bold',
                            fill: '#FF0000',
                            stroke: '#000000',
                            strokeThickness: 5
                        }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
                    }
                    
                    // Wait 5 seconds then show result
                    this.time.delayedCall(5000, () => {
                        this.isShooting = false;
                        this.handleShootingResult(willScore, currentMultiplier);
                    });
                    return;
                }
                
                const frameTime = 16 / 1000;
                const scrollAmount = actualScrollSpeed * frameTime;
                totalScrolled += scrollAmount;
                
                // Move background, goal, players, and opponents LEFT (world scrolls right)
                this.backgroundTiles.forEach(tile => {
                    tile.x -= scrollAmount;
                });
                
                this.goalOverlay.x -= scrollAmount;
                this.cameraScrollX += scrollAmount;
                
                this.players.forEach(player => {
                    if (player.sprite) player.sprite.x -= scrollAmount;
                    if (player.ball) player.ball.x -= scrollAmount;
                    if (player.indicator) player.indicator.x -= scrollAmount;
                });
                
                this.opponents.forEach(laneOpponents => {
                    laneOpponents.forEach(opponent => {
                        if (opponent && opponent.active !== false) {
                            opponent.x -= scrollAmount;
                        }
                    });
                });
            }
        });
    }
    
    handleShootingResult(scored, shootingMultiplier = 10.0) {
        if (scored) {
            // Goal scored - show success and proceed
            const currentPrizeInPence = this.selectedStake * this.currentMultiplier;
            const totalWinInPence = currentPrizeInPence * shootingMultiplier;
            
            this.registry.set('won', true);
            this.registry.set('crashMultiplier', this.currentMultiplier); // Store crash game multiplier
            this.registry.set('shootingMultiplier', shootingMultiplier); // Store shooting multiplier
            this.registry.set('crashWinAmount', currentPrizeInPence / 100); // Crash game winnings in pounds
            this.registry.set('finalMultiplier', this.currentMultiplier * shootingMultiplier);
            this.registry.set('finalValue', totalWinInPence / 100); // Convert to pounds
            this.registry.set('outcomeType', 'goal');
            
            console.log('Setting registry values:', {
                won: true,
                crashMultiplier: this.currentMultiplier,
                shootingMultiplier: shootingMultiplier,
                crashWinAmount: currentPrizeInPence / 100,
                finalMultiplier: this.currentMultiplier * shootingMultiplier,
                finalValue: totalWinInPence / 100
            });
            
            this.scene.start('OutcomeScene');
        } else {
            // Miss - player loses
            this.registry.set('won', false);
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
    
    saveGameState() {
        console.log('Saving minimal game state before bonus round...');
        
        // Since scene.sleep() preserves all display objects, we only need to save:
        // - Which player had the ball (bonusRoundPlayerIndex is already set)
        // - Multiplier value
        
        this.savedGameState = {
            bonusPlayerIndex: this.bonusRoundPlayerIndex,
            currentMultiplier: this.currentMultiplier
        };
        
        console.log('Minimal state saved:', this.savedGameState);
    }
    
    restoreGameState() {
        if (!this.savedGameState) {
            console.error('No saved game state to restore!');
            return;
        }
        
        console.log('=== SIMPLE RESTORE - No sprite manipulation needed ===');
        console.log('scene.sleep() preserved all display objects!');
        
        const state = this.savedGameState;
        
        // Just restore the multiplier value
        // Everything else (sprites, positions, etc.) was preserved by scene.sleep()
        this.currentMultiplier = state.currentMultiplier;
        
        console.log('Multiplier restored:', this.currentMultiplier);
        
        // Update UI text
        if (this.cashValueText) {
            this.cashValueText.setText(this.formatCashValue(this.currentMultiplier));
        }
        
        // Clear saved state
        this.savedGameState = null;
        
        // Show bonus addition animation if won
        const bonusWinAmount = this.registry.get('bonusWinAmount') || 0;
        if (bonusWinAmount > 0) {
            this.showBonusAddedAnimation(bonusWinAmount);
        } else {
            // Resume immediately if no bonus won
            this.isRunning = true;
            this.multiplierPaused = false;
            console.log('No bonus won - resuming game immediately');
        }
    }
    
    showBonusAddedAnimation(bonusAmount) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        console.log('Showing bonus added animation:', bonusAmount);
        
        // Keep game paused during animation
        this.isRunning = false;
        
        // Current game value
        const currentValue = this.formatCashValue(this.currentMultiplier);
        
        // Semi-transparent overlay
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0, 0)
            .setDepth(15000)
            .setScrollFactor(0);
        
        // "BONUS ADDED!" text
        const bonusAddedText = this.add.text(width / 2, height / 2 - 100, 'BONUS ADDED!', {
            fontSize: '48px',
            fontStyle: 'bold',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(15001).setScrollFactor(0).setAlpha(0);
        
        // Current game value
        const currentValueText = this.add.text(width / 2, height / 2, currentValue, {
            fontSize: '42px',
            fontStyle: 'bold',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(15001).setScrollFactor(0).setAlpha(0);
        
        // Plus sign
        const plusText = this.add.text(width / 2, height / 2 + 60, '+', {
            fontSize: '36px',
            fontStyle: 'bold',
            fill: '#00FF00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(15001).setScrollFactor(0).setAlpha(0);
        
        // Bonus amount
        const bonusAmountText = this.add.text(width / 2, height / 2 + 110, `£${bonusAmount.toFixed(2)}`, {
            fontSize: '42px',
            fontStyle: 'bold',
            fill: '#00FF00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(15001).setScrollFactor(0).setAlpha(0);
        
        // Equals line
        const equalsText = this.add.text(width / 2 - 60, height / 2 + 170, '═══════', {
            fontSize: '36px',
            fill: '#FFFFFF'
        }).setOrigin(0, 0.5).setDepth(15001).setScrollFactor(0).setAlpha(0);
        
        // New total (game value stays same, this is just for display)
        const newTotal = (this.currentMultiplier * this.selectedStake / 100) + bonusAmount;
        const newTotalText = this.add.text(width / 2, height / 2 + 230, `£${newTotal.toFixed(2)}`, {
            fontSize: '48px',
            fontStyle: 'bold',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(15001).setScrollFactor(0).setAlpha(0);
        
        // Animation sequence
        this.tweens.add({
            targets: bonusAddedText,
            alpha: 1,
            duration: 300,
            ease: 'Power2'
        });
        
        this.time.delayedCall(300, () => {
            this.tweens.add({
                targets: [currentValueText, plusText, bonusAmountText],
                alpha: 1,
                duration: 400,
                ease: 'Power2'
            });
        });
        
        this.time.delayedCall(1000, () => {
            this.tweens.add({
                targets: [equalsText, newTotalText],
                alpha: 1,
                duration: 400,
                ease: 'Power2'
            });
        });
        
        // Clean up and resume game after animation
        this.time.delayedCall(2500, () => {
            this.tweens.add({
                targets: [overlay, bonusAddedText, currentValueText, plusText, bonusAmountText, equalsText, newTotalText],
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    overlay.destroy();
                    bonusAddedText.destroy();
                    currentValueText.destroy();
                    plusText.destroy();
                    bonusAmountText.destroy();
                    equalsText.destroy();
                    newTotalText.destroy();
                    
                    // Now resume the game
                    this.isRunning = true;
                    this.multiplierPaused = false;
                    console.log('Bonus animation complete, game resuming');
                }
            });
        });
    }
    
    showRefereeAndStartBonus() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        console.log('Bonus round triggered! Showing referee...');
        
        // Store game state before bonus round
        this.saveGameState();
        
        // Create referee image below screen (showing only 66% when slid up)
        const refereeHeight = 400; // Approximate height of referee image at scale
        const visiblePercent = 0.66;
        const slideUpY = height - (refereeHeight * visiblePercent * 0.9); // 0.9 is the scale (3x bigger)
        
        const referee = this.add.image(width / 2, height + 100, 'referee')
            .setScale(0.9)
            .setDepth(10000)
            .setScrollFactor(0);
        
        // Add referee whistle text (initially hidden)
        const whistleText = this.add.text(width / 2, slideUpY - 250, 'REFEREE WHISTLE!', {
            fontSize: '48px',
            fontStyle: 'bold',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(10000).setScrollFactor(0).setAlpha(0);
        
        const bonusText = this.add.text(width / 2, slideUpY - 180, 'BONUS ROUND!', {
            fontSize: '36px',
            fontStyle: 'bold',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(10000).setScrollFactor(0).setAlpha(0);
        
        // Store references for cleanup
        this.refereeElements = { referee, whistleText, bonusText };
        
        // Slide referee up from bottom
        this.tweens.add({
            targets: referee,
            y: slideUpY,
            duration: 800,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Fade in text
                this.tweens.add({
                    targets: [whistleText, bonusText],
                    alpha: 1,
                    duration: 300,
                    ease: 'Power2'
                });
            }
        });
        
        // Wait then slide referee down and start bonus round
        this.time.delayedCall(2000, () => {
            // Fade out text
            this.tweens.add({
                targets: [whistleText, bonusText],
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    whistleText.destroy();
                    bonusText.destroy();
                }
            });
            
            // Slide referee back down
            this.tweens.add({
                targets: referee,
                y: height + 100,
                duration: 600,
                ease: 'Power2.easeIn',
                onComplete: () => {
                    referee.destroy();
                    console.log('Launching BonusRoundScene...');
                    // Stop the BonusRoundScene if it's already running
                    if (this.scene.isActive('BonusRoundScene')) {
                        this.scene.stop('BonusRoundScene');
                    }
                    // Sleep this scene (keeps display list intact) and launch bonus round
                    this.scene.sleep('RunningScene');
                    this.scene.launch('BonusRoundScene');
                }
            });
        });
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
