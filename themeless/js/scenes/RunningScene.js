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
        this.totalBonusWon = 0; // Track total bonus money won (in pounds)
        this.activePlayers = [true, true, true, true];
        this.playerPositions = [0, 0, 0, 0];
        this.testModeEnabled = this.registry.get('testModeEnabled') || false;
        
        // Track active text messages to prevent overlapping
        this.activeTextMessages = [];
        
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
        
        // ===== FORCED CRASH SYSTEM =====
        // Track game number (cycles 1-4)
        let gameCounter = this.registry.get('gameCounter') || 0;
        gameCounter++;
        if (gameCounter > 4) gameCounter = 1;
        this.registry.set('gameCounter', gameCounter);
        this.gameNumber = gameCounter;
        
        // Define forced crash schedule
        // Game 1: 1 crash before first decision
        // Game 2: 2 crashes between first and second decision
        // Game 3: 2 crashes between second and third decision
        // Game 4: 2 crashes between third and fourth decision
        this.forcedCrashSchedule = this.determineForcedCrashes(this.gameNumber);
        console.log(`Game ${this.gameNumber}: Forced crash schedule:`, this.forcedCrashSchedule);
        
        // Wave system state
        this.isPreFirstDecision = true; // Before first decision point
        this.preDecisionOpponentsSpawned = false; // Track if pre-decision opponents spawned
        this.preDecisionOpponentCount = 0; // How many pre-decision opponents
        this.preDecisionInteractionsRemaining = 0; // Track remaining interactions
        this.preDecisionAllInteractionsComplete = false; // All interactions done
        this.multiplierPaused = false; // Pause multiplier at decision point
        this.waitingForDecision = false; // Block spawning when decision window ready
        this.decisionTriggered = false; // Prevent duplicate decision triggers
        this.decisionSafetyTimeout = null; // Safety timeout for mobile devices
        this.currentWaveActive = false; // Is a wave currently spawning/active
        this.currentWaveCount = 0; // Number of opponents in current wave
        this.waveOpponentsSpawned = 0; // How many spawned so far
        this.allWaveOpponentsGone = false; // All wave opponents off screen or destroyed
        this.waveSpawnedThisSection = false; // Flag: has a wave been spawned for current decision section
        
        // ===== Scene Wake Handler (Bonus Round Return) =====
        this.events.on('wake', () => {
            // Ensure all sprites are visible (scene.sleep() preserves them)
            this.players.forEach((player) => {
                if (player.sprite) player.sprite.setVisible(true);
                if (player.ball) player.ball.setVisible(true);
                if (player.indicator) player.indicator.setVisible(true);
            });
            
            // Clear shooting flag but DON'T resume game yet
            this.isShooting = false;
            // isRunning and multiplierPaused will be handled by restoreGameState
            
            // Restore game state for bonus animation
            if (this.savedGameState) {
                this.restoreGameState();
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
        
        // THEMELESS: Black background pitch
        this.pitchWidth = width * 4; // Large scrollable pitch
        this.pitchHeight = height * 0.85;
        this.pitchY = (height - this.pitchHeight) / 2 + 40;
        
        // Black background rectangle
        this.add.rectangle(0, this.pitchY, this.pitchWidth, this.pitchHeight, 0x000000).setOrigin(0, 0);
        
        // Draw horizontal lanes (white lines)
        this.laneHeight = this.pitchHeight / 4;
        for (let i = 1; i < 4; i++) {
            this.add.line(
                0, 0,
                0, this.pitchY + this.laneHeight * i,
                this.pitchWidth, this.pitchY + this.laneHeight * i,
                0xFFFFFF, 0.3
            ).setOrigin(0);
        }
        
        // Camera follows the action
        this.cameraScrollX = 0;
    }
    
    createPlayers() {
        const width = this.cameras.main.width;
        
        this.players = [];
        this.opponents = [];
        
        // THEMELESS: Starting position (left side, no staggering)
        const baseX = 200;
        const horizontalStagger = [0, 0, 0, 0]; // No horizontal staggering
        
        // No vertical adjustments or perspective scaling
        const verticalAdjustments = [0, 0, 0, 0];
        const perspectiveScales = [1.0, 1.0, 1.0, 1.0]; // All same size
        
        for (let i = 0; i < 4; i++) {
            const baseY = this.pitchY + this.laneHeight * i + this.laneHeight / 2;
            const yAdjustment = this.laneHeight * verticalAdjustments[i];
            const y = baseY + yAdjustment;
            
            const x = baseX + horizontalStagger[i];
            const perspectiveScale = perspectiveScales[i];
            
            // THEMELESS: Use blue rectangles for all players - uniform size
            const rectWidth = 60;
            const rectHeight = 80;
            const player = this.add.rectangle(x, y, rectWidth, rectHeight, 0x0000FF);
            player.setStrokeStyle(3, 0xFFFFFF); // White border
            player.setDepth(10); // Set depth to ensure proper layering
            
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
            
            // Add star indicator to selected player
            if (i === this.selectedPlayer) {
                // THEMELESS: Use star shape to indicate active player - uniform size, NO rotation
                // Position at bottom-right of rectangle
                const starOffsetX = 40;
                const starOffsetY = 50;
                const starSize = 15;
                const ball = this.add.star(x + starOffsetX, y + starOffsetY, 5, starSize * 0.5, starSize, 0xFFD700); // Gold star
                ball.setDepth(100); // Ensure star is visible
                
                // Store ball reference in BOTH sprite and playerObj
                player.ball = ball;
                playerObj.ball = ball;
                
                // THEMELESS: No rotation animation for star
                playerObj.ballTween = null;
                
                // Add indicator - uniform size
                const indicatorOffsetY = 80;
                const indicatorFontSize = 20;
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
        console.log('=== GAME STARTING ===');
        console.log('testModeEnabled:', this.testModeEnabled);
        console.log('isPreFirstDecision:', this.isPreFirstDecision);
        console.log('preDecisionOpponentsSpawned:', this.preDecisionOpponentsSpawned);
        
        this.isRunning = true;
        this.hasStarted = true;
        this.gameStartTime = this.time.now;
        
        // Resume all player animations
        this.players.forEach(player => {
            if (player.sprite && player.sprite.anims) {
                player.sprite.anims.resume();
            }
            // THEMELESS: No ball rotation animation
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
            
            // Calculate actual cash value (multiplier-based game value)
            const currentCashValue = (this.currentMultiplier * this.selectedStake) / 100;
            
            // Calculate display value (includes bonus money won)
            const displayMultiplier = this.currentMultiplier + (this.totalBonusWon * 100 / this.selectedStake);
            
            // Update display with combined value
            this.cashValueText.setText(this.formatCashValue(displayMultiplier));
            
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
                        // Safety timeout: If we've been paused for more than 5 seconds, proceed anyway
                        if (!this.decisionSafetyTimeout) {
                            this.decisionSafetyTimeout = this.time.delayedCall(5000, () => {
                                console.log('Decision panel safety timeout - forcing appearance');
                                this.preDecisionAllInteractionsComplete = true;
                            });
                        }
                    } else {
                        // Clear safety timeout if set
                        if (this.decisionSafetyTimeout) {
                            this.decisionSafetyTimeout.remove();
                            this.decisionSafetyTimeout = null;
                        }
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
    
    determineForcedCrashes(gameNumber) {
        // Returns object with crash schedule:
        // { stage: 0-4, players: [array of player indices to crash] }
        // Stage 0 = before first decision
        // Stage 1 = between first and second decision
        // Stage 2 = between second and third decision
        // Stage 3 = between third and fourth decision
        
        const schedule = [];
        
        // Randomly select which players will crash (exclude selected player)
        const availablePlayers = [0, 1, 2, 3].filter(p => p !== this.selectedPlayer);
        const shuffled = Phaser.Utils.Array.Shuffle([...availablePlayers]);
        
        switch(gameNumber) {
            case 1:
                // 1 crash before first decision
                schedule.push({ stage: 0, players: [shuffled[0]] });
                break;
            case 2:
                // 2 crashes between first and second decision
                schedule.push({ stage: 1, players: [shuffled[0], shuffled[1]] });
                break;
            case 3:
                // 2 crashes between second and third decision
                schedule.push({ stage: 2, players: [shuffled[0], shuffled[1]] });
                break;
            case 4:
                // 2 crashes between third and fourth decision
                schedule.push({ stage: 3, players: [shuffled[0], shuffled[1]] });
                break;
        }
        
        return schedule;
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
        
        // THEMELESS: No background tiles or goal overlay to move
        
        // Keep players centered on screen (they don't actually move horizontally)
        // Players stay at their fixed positions while world scrolls
    }
    
    updateOpponents(deltaSeconds) {
        // Block all spawning if test mode is enabled
        if (this.testModeEnabled) {
            console.log('TEST MODE ENABLED - Skipping all opposition spawning');
            return; // Skip all opposition spawning in test mode
        }
        
        // Block all spawning if waiting for decision
        if (this.waitingForDecision) {
            // Don't spawn anything while decision window is ready
        } else if (this.isPreFirstDecision && !this.preDecisionOpponentsSpawned) {
            // PRE-FIRST DECISION: Spawn 1-4 lanes with opposition (always at least 1)
            const laneCount = 1 + Math.floor(Math.random() * 4); // 1, 2, 3, or 4 lanes
            
            // Get only active lanes (exclude crashed players)
            const activeLanes = [0, 1, 2, 3].filter(lane => 
                this.players[lane] && this.players[lane].active
            );
            
            console.log(`PRE-DECISION: laneCount=${laneCount}, activeLanes=${activeLanes.length}`);
            
            if (activeLanes.length > 0) {
                // Shuffle active lanes and take first N (or all if less than N)
                const shuffledLanes = Phaser.Utils.Array.Shuffle([...activeLanes]);
                const selectedLanes = shuffledLanes.slice(0, Math.min(laneCount, activeLanes.length));
                
                console.log(`Selected ${selectedLanes.length} lanes:`, selectedLanes);
                
                // Build a list of all opponents to spawn with their lanes
                const spawnQueue = [];
                selectedLanes.forEach((lane) => {
                    // Each selected lane gets 1-3 opponents (at least 1)
                    const opponentsInLane = 1 + Math.floor(Math.random() * 3); // 1, 2, or 3
                    
                    console.log(`Lane ${lane} gets ${opponentsInLane} opponents`);
                    
                    for (let i = 0; i < opponentsInLane; i++) {
                        spawnQueue.push(lane);
                    }
                });
                
                // Add forced crash opponents for stage 0 (before first decision)
                const stage0Crashes = this.forcedCrashSchedule.filter(c => c.stage === 0);
                if (stage0Crashes.length > 0) {
                    console.log(`Adding forced crashes for stage 0:`, stage0Crashes[0].players);
                    stage0Crashes[0].players.forEach(playerIndex => {
                        spawnQueue.push({ lane: playerIndex, forcedCrash: true });
                    });
                }
                
                console.log(`Total pre-decision spawn queue: ${spawnQueue.length} opponents`);
                
                // Shuffle the spawn queue so opponents from different lanes are mixed
                const shuffledQueue = Phaser.Utils.Array.Shuffle([...spawnQueue]);
                
                // Spawn opponents one at a time with 1.2-1.8 second gaps for better mobile timing
                shuffledQueue.forEach((item, index) => {
                    const spawnDelay = index * (1200 + Math.random() * 600); // 1.2-1.8 seconds between each opponent
                    this.time.delayedCall(spawnDelay, () => {
                        // Handle both lane numbers and objects with forcedCrash flag
                        const laneIndex = typeof item === 'object' ? item.lane : item;
                        const isForcedCrash = typeof item === 'object' && item.forcedCrash;
                        
                        // Only spawn if player is still active
                        if (this.players[laneIndex] && this.players[laneIndex].active) {
                            this.spawnOpponent(laneIndex, false, isForcedCrash);
                        }
                    });
                });
                
                this.preDecisionOpponentCount = shuffledQueue.length;
                this.preDecisionInteractionsRemaining = shuffledQueue.length; // Initialize interaction counter
            } else {
                // No active players, mark as complete
                this.preDecisionOpponentCount = 0;
                this.preDecisionInteractionsRemaining = 0;
                this.preDecisionAllInteractionsComplete = true;
            }
            
            this.preDecisionOpponentsSpawned = true;
        } else if (!this.isPreFirstDecision && !this.currentWaveActive && !this.waveSpawnedThisSection) {
            // WAVE SYSTEM: After first decision
            // Start new wave (waves spawn continuously)
            console.log(`Starting new wave at decision index ${this.currentDecisionIndex}, multiplier ${this.currentMultiplier.toFixed(2)}`);
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
                console.log(`Wave complete at multiplier ${this.currentMultiplier.toFixed(2)}, allowing new wave`);
                this.currentWaveActive = false;
                this.allWaveOpponentsGone = true;
                this.waveSpawnedThisSection = false; // Allow new wave to spawn
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
            
            // Spawn all opponents immediately at the same distance
            activeLanes.forEach(lane => {
                this.spawnOpponent(lane, true);
            });
            
            this.currentWaveCount = activeLanes.length;
            this.waveOpponentsSpawned = activeLanes.length;
            this.currentWaveActive = true;
            this.allWaveOpponentsGone = false;
        } else {
            // Normal mode: Random wave size: 1-3 opponents (always at least 1)
            this.currentWaveCount = 1 + Math.floor(Math.random() * 3); // 1, 2, or 3
            this.waveOpponentsSpawned = 0;
            
            // Check if we need to add forced crash opponents for this stage
            // Stage 1 = after first decision, Stage 2 = after second decision, Stage 3 = after third decision
            const currentStage = this.currentDecisionIndex; // currentDecisionIndex tracks which decision we just passed
            const stageCrashes = this.forcedCrashSchedule.filter(c => c.stage === currentStage);
            
            if (stageCrashes.length > 0) {
                // Add forced crash opponents to the wave (spawn immediately)
                stageCrashes[0].players.forEach(playerIndex => {
                    if (this.players[playerIndex] && this.players[playerIndex].active) {
                        // Spawn forced crash opponent immediately
                        this.spawnOpponent(playerIndex, false, true);
                        this.currentWaveCount++;
                        this.waveOpponentsSpawned++; // Count forced crashes as spawned
                    }
                });
            }
            
            this.currentWaveActive = true;
            this.allWaveOpponentsGone = false;
            this.lastOpponentSpawnTime = this.elapsedTime;
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
    
    spawnOpponent(lane, synchronizedSpawn = false, forcedCrash = false) {
        // Don't spawn too many opponents (unless synchronized Force Bonus spawn or forced crash)
        if (!synchronizedSpawn && !forcedCrash && this.opponents[lane].length >= 2) return;
        
        const width = this.cameras.main.width;
        
        // Horizontal stagger matching player positions
        const horizontalStagger = [240, 160, 80, 0]; // Lane 1 furthest back, Lane 4 most forward (80px gaps each)
        
        // For synchronized spawns (Force Bonus), spawn at fixed distance so all collide together
        // For forced crashes, spawn very close to guarantee collision
        // For pre-decision opponents, spawn so all interactions happen within 3 seconds
        // Player is at x=200, opponents move at 150px/s (1.5x world speed)
        // Spawn at various distances: 375px = 2.5s, 300px = 2.0s, 225px = 1.5s travel time
        let x;
        if (forcedCrash) {
            // Forced crash: Spawn very close (150px = 1.0 second, guaranteed collision)
            const distance = 150;
            x = 200 + horizontalStagger[lane] + distance;
        } else if (synchronizedSpawn) {
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
        
        // THEMELESS: No vertical adjustments - same line as players
        const verticalAdjustments = [0, 0, 0, 0]; // All on center line
        const baseY = this.pitchY + this.laneHeight * lane + this.laneHeight / 2;
        const yAdjustment = this.laneHeight * verticalAdjustments[lane];
        const y = baseY + yAdjustment;
        
        // THEMELESS: No perspective scaling
        const perspectiveScale = 1.0;
        
        // THEMELESS: Create triangle opponent
        // Pre-determine the outcome to set color
        const outcomeRandom = Math.floor(Math.random() * 4) + 1;
        let triangleColor;
        let outcomeType;
        
        if (outcomeRandom === 1) {
            triangleColor = 0x00FF00; // Green for skill/boost
            outcomeType = 'skill';
        } else if (outcomeRandom === 2) {
            triangleColor = 0x0000FF; // Blue for dodge
            outcomeType = 'dodge';
        } else {
            triangleColor = 0xFF0000; // Red for tackle/crash
            outcomeType = 'tackle';
        }
        
        // THEMELESS: Uniform triangle size (no scaling)
        const triangleSize = 50;
        const opponent = this.add.triangle(x, y, 0, -triangleSize/2, -triangleSize/2, triangleSize/2, triangleSize/2, triangleSize/2, triangleColor);
        opponent.setStrokeStyle(2, 0xFFFFFF); // White border
        opponent.setDepth(10); // Same depth as players so they don't go underneath
        opponent.isAnimated = true; // Track if this is animated or static
        opponent.collisionFlag = 0; // 0 = can collide, 1 = already collided
        opponent.perspectiveScale = 1.0; // Always 1.0 (no scaling)
        opponent.outcomeType = outcomeType; // Store predetermined outcome
        
        this.opponents[lane].push(opponent);
    }
    
    checkCrashes() {
        // Check collisions for ALL active players (so opponents get cleared)
        // But only award skill boosts to the SELECTED player (the one with the ball)
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
                
                // THEMELESS: Uniform collision distance - increased for better visibility
                const collisionDistance = 70; // Increased from 38 to 70 for geometric shapes
                
                if (distance < collisionDistance) {
                    // IMMEDIATELY set flag to 1 to prevent any re-processing
                    opponent.collisionFlag = 1;
                    
                    // THEMELESS: Use predetermined outcome from triangle color
                    const outcome = opponent.outcomeType || 'tackle'; // Fallback to tackle if not set
                    
                    if (outcome === 'tackle') {
                        // CRASH! Replace both player and opponent with static images
                        this.crashPlayer(playerIndex, opponent);
                    } else if (outcome === 'dodge') {
                        // Replace opponent with dodge image
                        this.replaceOpponentWithStaticImage(opponent, 'opposition_dodge', playerIndex, oppIndex);
                        this.showDodgeMessage(playerX, playerY, 'DODGED!');
                    } else {
                        // SKILL! - Replace opponent with skill image
                        this.replaceOpponentWithStaticImage(opponent, 'opposition_skill', playerIndex, oppIndex);
                        
                        // ONLY award skill boost if this is the SELECTED PLAYER (with the ball)
                        if (playerIndex === this.selectedPlayer) {
                            const stakeInPounds = this.selectedStake / 100;
                            this.totalBonusWon += stakeInPounds;
                            this.showSkillBoostMessage(playerX, playerY, stakeInPounds);
                        } else {
                            // Other players just show dodge message
                            this.showDodgeMessage(playerX, playerY, 'SKILL!');
                        }
                    }
                    
                    // Track pre-decision interactions
                    if (this.isPreFirstDecision && this.preDecisionOpponentsSpawned && this.preDecisionInteractionsRemaining > 0) {
                        // Decrement interaction counter
                        this.preDecisionInteractionsRemaining--;
                        
                        // If all interactions complete, show decision panel immediately
                        if (this.preDecisionInteractionsRemaining === 0) {
                            this.preDecisionAllInteractionsComplete = true;
                        }
                    }
                }
            });
        });
    }
    
    replaceOpponentWithStaticImage(opponent, imageKey, lane, oppIndex) {
        // THEMELESS: Keep triangles but make them semi-transparent to show they've been interacted with
        const x = opponent.x;
        const y = opponent.y;
        
        // Preserve perspective scale
        const perspectiveScale = opponent.perspectiveScale || 1.0;
        
        // Simply make the existing triangle semi-transparent
        opponent.setAlpha(0.3);
        opponent.isAnimated = false; // Mark as static
        opponent.collisionFlag = 1; // Already collided, prevent re-collision
        
        // No need to replace in array since we're modifying in place
    }
    
    showDodgeMessage(x, y, message) {
        // Use provided message or pick random
        if (!message) {
            const messages = ['DRIBBLED!', 'DODGED!', 'AVOIDED!', 'SKILL!'];
            message = messages[Math.floor(Math.random() * messages.length)];
        }
        
        // Check for overlapping text and adjust Y position
        let adjustedY = y - 40;
        const overlapThreshold = 50; // Minimum distance between text messages
        
        // Remove destroyed text from tracking array
        this.activeTextMessages = this.activeTextMessages.filter(textObj => textObj && !textObj.text._destroyed);
        
        // Check for overlap with existing text
        let hasOverlap = true;
        while (hasOverlap) {
            hasOverlap = false;
            for (const textObj of this.activeTextMessages) {
                const distance = Phaser.Math.Distance.Between(x, adjustedY, textObj.x, textObj.y);
                if (distance < overlapThreshold) {
                    adjustedY -= 30; // Move up to avoid overlap
                    hasOverlap = true;
                    break;
                }
            }
        }
        
        const dodgeText = this.add.text(x, adjustedY, message, {
            fontSize: '20px',
            fontStyle: 'bold',
            fill: '#FFFF00'  // Yellow for dodge messages
        }).setOrigin(0.5).setDepth(10002); // Highest z-index for text
        
        // Track this text
        this.activeTextMessages.push({ text: dodgeText, x: x, y: adjustedY });
        
        this.tweens.add({
            targets: dodgeText,
            y: dodgeText.y - 50,
            alpha: 0,
            duration: 1500,
            onComplete: () => {
                // Remove from tracking when destroyed
                this.activeTextMessages = this.activeTextMessages.filter(textObj => textObj.text !== dodgeText);
                dodgeText.destroy();
            }
        });
    }
    
    showSkillBoostMessage(x, y, boostAmount) {
        // Check for overlapping text and adjust Y position
        let adjustedY = y - 40;
        const overlapThreshold = 50; // Minimum distance between text messages
        
        // Remove destroyed text from tracking array
        this.activeTextMessages = this.activeTextMessages.filter(textObj => textObj && !textObj.text._destroyed);
        
        // Check for overlap with existing text
        let hasOverlap = true;
        while (hasOverlap) {
            hasOverlap = false;
            for (const textObj of this.activeTextMessages) {
                const distance = Phaser.Math.Distance.Between(x, adjustedY, textObj.x, textObj.y);
                if (distance < overlapThreshold) {
                    adjustedY -= 30; // Move up to avoid overlap
                    hasOverlap = true;
                    break;
                }
            }
        }
        
        // Main "SKILL!" text with amount
        const skillText = this.add.text(x, adjustedY, `SKILL! +£${boostAmount.toFixed(2)}`, {
            fontSize: '20px',
            fontStyle: 'bold',
            fill: '#00BFFF'  // Blue for boost messages
        }).setOrigin(0.5).setDepth(10002); // Highest z-index for text
        
        // Track this text
        this.activeTextMessages.push({ text: skillText, x: x, y: adjustedY });
        
        // Animate skill text
        this.tweens.add({
            targets: skillText,
            y: skillText.y - 50,
            alpha: 0,
            duration: 1500,
            onComplete: () => {
                // Remove from tracking when destroyed
                this.activeTextMessages = this.activeTextMessages.filter(textObj => textObj.text !== skillText);
                skillText.destroy();
            }
        });
        
        // Show floating indicator in top UI area (near cash display)
        const width = this.cameras.main.width;
        
        // Position near the cash value display (right side of screen)
        const uiIndicator = this.add.text(width - 50, 60, `+£${boostAmount.toFixed(2)}`, {
            fontSize: '24px',
            fontStyle: 'bold',
            fill: '#00FF00',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(1, 0).setDepth(10002).setScrollFactor(0); // Highest z-index for text
        
        // Animate UI indicator - float up and fade
        this.tweens.add({
            targets: uiIndicator,
            y: 30,
            alpha: 0,
            duration: 2000,
            ease: 'Power2.easeOut',
            onComplete: () => uiIndicator.destroy()
        });
    }
    
    crashPlayer(playerIndex, opponent) {
        const player = this.players[playerIndex];
        if (!player.active) return;
        
        // Store reference to the opposition that caused the tackle (for bonus round)
        if (opponent) {
            this.lastTackler = opponent;
        }
        
        // Get perspective scale for this lane
        const perspectiveScale = player.perspectiveScale || 1.0;
        
        // ===== BONUS CHECK: Must check BEFORE destroying sprites =====
        // Only player with ball can trigger bonus
        if (player.hasBall && player.ball) {
            this.bonusRoundPlayerIndex = playerIndex;
            this.isRunning = false;
            
            // Check for bonus round (Force Bonus = 100%, normal = 20%)
            const forceBonus = this.registry.get('forceBonus') || false;
            const bonusTriggered = forceBonus || (Math.random() < 0.2);
            
            if (bonusTriggered) {
                // THEMELESS: Show collision on opponent but keep player/ball intact
                if (opponent) {
                    // Make opponent triangle semi-transparent
                    opponent.setAlpha(0.3);
                    
                    // Fade out triangle after delay
                    this.time.delayedCall(1500, () => {
                        if (opponent && opponent.active) {
                            opponent.destroy();
                        }
                    });
                }
                
                // Show referee and trigger bonus round
                this.time.delayedCall(1500, () => {
                    this.showRefereeAndStartBonus();
                });
                return; // Exit early - don't destroy player/ball
            }
        } else if (player.hasBall && !player.ball) {
            console.error(`ERROR: Player ${playerIndex} has hasBall=true but no ball object!`);
        }
        
        // ===== NO BONUS: Proceed with normal crash =====
        player.active = false;
        
        // THEMELESS: Make opponent triangle semi-transparent
        if (opponent) {
            opponent.setAlpha(0.3);
            opponent.isAnimated = false;
            opponent.collisionFlag = 1;
        }
        
        // THEMELESS: Make player rectangle semi-transparent to show crash
        const playerX = player.sprite.x;
        const playerY = player.sprite.y;
        
        // Make player rectangle semi-transparent
        player.sprite.setAlpha(0.3);
        player.sprite.setFillStyle(0xFF0000); // Change to red to indicate crash
        
        // THEMELESS: No dive image to remove (using geometric shapes)
        
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
        
        // If player had ball and no bonus, trigger game over
        if (player.hasBall) {
            player.hasBall = false;
            player.ball = null;
            this.time.delayedCall(1500, () => {
                this.gameOver();
            });
        }
    }
    
    handlePassAnimation(targetLane) {
        if (this.scene.isPaused()) {
            this.scene.resume();
        }
        
        this.isRunning = false;
        
        const currentPlayer = this.players[this.selectedPlayer];
        const targetPlayer = this.players[targetLane];
        
        if (!currentPlayer.ball) {
            console.error('THEMELESS: Error - Current player has no ball object');
            return;
        }
        
        const star = currentPlayer.ball;
        
        // THEMELESS: Uniform positioning (no scaling)
        const starOffsetX = 40;
        const starOffsetY = 50;
        const targetX = targetPlayer.sprite.x + starOffsetX;
        const targetY = targetPlayer.sprite.y + starOffsetY;
        
        console.log('THEMELESS: Passing star from lane', this.selectedPlayer, 'to lane', targetLane);
        console.log('THEMELESS: Star position:', star.x, star.y, '-> target:', targetX, targetY);
        
        // Remove all indicators
        this.players.forEach((p) => {
            if (p.indicator) {
                p.indicator.destroy();
                p.indicator = null;
            }
        });
        
        // Kill existing tweens and create pass animation
        this.tweens.killTweensOf(star);
        
        this.tweens.add({
            targets: star,
            x: targetX,
            y: targetY,
            duration: 1000,
            ease: 'Quad.easeOut',
            onComplete: () => {
                console.log('THEMELESS: Pass animation complete');
                
                // Transfer ownership
                currentPlayer.hasBall = false;
                currentPlayer.ball = null;
                targetPlayer.hasBall = true;
                targetPlayer.ball = star;
                
                // Update selected player
                this.selectedPlayer = targetLane;
                this.registry.set('selectedPlayer', targetLane);
                
                console.log('THEMELESS: Selected player now:', this.selectedPlayer);
                
                // THEMELESS: No rotation for star (keep it static)
                
                // Add indicator - uniform size
                const indicatorOffsetY = 80;
                const indicatorFontSize = 20;
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
        
        // THEMELESS: No spinning animation for star during pass
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
        
        // THEMELESS: No rotation animation for star
        
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
        // THEMELESS: Simple text-based shooting outcome (no animation)
        console.log('handleShooting called');
        
        // Make sure scene is active
        if (this.scene.isPaused()) {
            this.scene.resume();
        }
        
        // Determine if shot will score (50% chance)
        const willScore = Math.random() > 0.5;
        
        // Random multiplier between 5x and 10x
        const shootingMultiplier = 5 + Math.random() * 5;
        
        // Get screen dimensions
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Calculate winnings
        const displayMultiplier = this.currentMultiplier + (this.totalBonusWon * 100 / this.selectedStake);
        const currentPrizeInPence = this.selectedStake * displayMultiplier;
        const totalWinInPence = currentPrizeInPence * shootingMultiplier;
        
        // Show outcome after 1 second
        this.time.delayedCall(1000, () => {
            if (willScore) {
                // GOAL!
                const resultText = this.add.text(width / 2, height / 2 - 100, 'GOAL!', {
                    fontSize: '120px',
                    fontStyle: 'bold',
                    fill: '#00FF00',
                    stroke: '#000000',
                    strokeThickness: 10
                }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
                
                const multiplierText = this.add.text(width / 2, height / 2, `${shootingMultiplier.toFixed(1)}x MULTIPLIER`, {
                    fontSize: '60px',
                    fontStyle: 'bold',
                    fill: '#FFD700',
                    stroke: '#000000',
                    strokeThickness: 8
                }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
                
                const amountText = this.add.text(width / 2, height / 2 + 100, `YOU WIN £${(totalWinInPence / 100).toFixed(2)}`, {
                    fontSize: '50px',
                    fontStyle: 'bold',
                    fill: '#FFFFFF',
                    stroke: '#000000',
                    strokeThickness: 6
                }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
                
            } else {
                // MISS!
                const resultText = this.add.text(width / 2, height / 2 - 80, 'MISS!', {
                    fontSize: '120px',
                    fontStyle: 'bold',
                    fill: '#FF0000',
                    stroke: '#000000',
                    strokeThickness: 10
                }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
                
                const missText = this.add.text(width / 2, height / 2 + 50, 'NO MULTIPLIER', {
                    fontSize: '60px',
                    fontStyle: 'bold',
                    fill: '#FFFFFF',
                    stroke: '#000000',
                    strokeThickness: 8
                }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
            }
            
            // Wait 3 seconds then go to outcome scene
            this.time.delayedCall(3000, () => {
                this.handleShootingResult(willScore, shootingMultiplier);
            });
        });
    }
    
    handleShootingResult(scored, shootingMultiplier = 10.0) {
        if (scored) {
            // Goal scored - show success and proceed
            const displayMultiplier = this.currentMultiplier + (this.totalBonusWon * 100 / this.selectedStake);
            const currentPrizeInPence = this.selectedStake * displayMultiplier;
            const totalWinInPence = currentPrizeInPence * shootingMultiplier;
            
            this.registry.set('won', true);
            this.registry.set('crashMultiplier', displayMultiplier); // Store total crash game multiplier (base + bonuses)
            this.registry.set('shootingMultiplier', shootingMultiplier); // Store shooting multiplier
            this.registry.set('crashWinAmount', currentPrizeInPence / 100); // Crash game winnings in pounds
            this.registry.set('finalMultiplier', displayMultiplier * shootingMultiplier);
            this.registry.set('finalValue', totalWinInPence / 100); // Convert to pounds
            this.registry.set('outcomeType', 'goal');
            
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
        // THEMELESS: This function should not be called - stars are created during player setup
        // But if it is called, create a star instead of football
        const ball = this.add.star(
            player.sprite.x + 40,
            player.sprite.y + 50,
            5,
            7.5,
            15,
            0xFFD700
        );
        ball.setDepth(100);
        
        // THEMELESS: No rotation animation for star
        
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
        this.registry.set('totalBonusWon', this.totalBonusWon);
        this.registry.set('activePlayers', this.players.map(p => p.active));
        this.registry.set('playerPositions', this.playerPositions);
        this.registry.set('elapsedTime', this.elapsedTime);
        this.registry.set('currentDecisionIndex', this.currentDecisionIndex);
        
        // Start decision scene
        this.scene.pause();
        this.scene.launch('DecisionScene');
    }
    
    resumeRunning() {
        console.log(`=== RESUMING after decision ${this.currentDecisionIndex}, multiplier ${this.currentMultiplier.toFixed(2)} ===`);
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
        console.log(`Wave state reset, ready for new waves in section ${this.currentDecisionIndex}`);
    }
    
    saveGameState() {
        // Save minimal state (scene.sleep() preserves display objects)
        this.savedGameState = {
            bonusPlayerIndex: this.bonusRoundPlayerIndex,
            currentMultiplier: this.currentMultiplier
        };
        
        // Pause all player animations during bonus round
        this.players.forEach(player => {
            if (player.sprite && player.sprite.anims) {
                player.sprite.anims.pause();
            }
        });
        
        // Pause ball rotation tweens
        this.players.forEach(player => {
            if (player.ball) {
                this.tweens.killTweensOf(player.ball); // Stop rotation tweens
            }
        });
        
        // Pause opponent animations
        this.opponents.forEach(laneOpponents => {
            laneOpponents.forEach(opponent => {
                if (opponent && opponent.anims && opponent.isAnimated) {
                    opponent.anims.pause();
                }
            });
        });
    }
    
    restoreGameState() {
        if (!this.savedGameState) {
            console.error('No saved game state to restore!');
            return;
        }
        
        const state = this.savedGameState;
        
        // Restore multiplier value (sprites preserved by scene.sleep())
        this.currentMultiplier = state.currentMultiplier;
        
        // IMPORTANT: Update UI with combined value (multiplier + bonus)
        // BonusRoundScene may have added to totalBonusWon, so recalculate display
        if (this.cashValueText) {
            const displayMultiplier = this.currentMultiplier + (this.totalBonusWon * 100 / this.selectedStake);
            this.cashValueText.setText(this.formatCashValue(displayMultiplier));
        }
        
        // Clear saved state
        this.savedGameState = null;
        
        // DON'T resume animations yet - wait for whistle
        // Show whistle message first, then resume everything
        this.showResumeWhistleMessage();
    }
    
    showResumeWhistleMessage() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const message = this.add.text(width / 2, height / 2, '🔊 WHISTLE!\nGame Resuming...', {
            fontSize: '48px',
            fontStyle: 'bold',
            fill: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(20000).setScrollFactor(0);
        
        // Wait 2 seconds, then fade out and resume everything
        this.time.delayedCall(2000, () => {
            // Fade out the message
            this.tweens.add({
                targets: message,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    message.destroy();
                }
            });
            
            // Resume all player animations
            this.players.forEach(player => {
                if (player.sprite && player.sprite.anims && player.sprite.anims.isPaused) {
                    player.sprite.anims.resume();
                }
            });
            
            // THEMELESS: No rotation animations for stars
            
            // Resume opponent animations
            this.opponents.forEach(laneOpponents => {
                laneOpponents.forEach(opponent => {
                    if (opponent && opponent.anims && opponent.anims.isPaused && opponent.isAnimated) {
                        opponent.anims.resume();
                    }
                });
            });
            
            // NOW resume the game
            this.isRunning = true;
            this.multiplierPaused = false;
        });
    }
    
    showBonusAddedAnimation(bonusAmount) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Keep game paused during animation
        this.isRunning = false;
        
        // Bonus was already added to totalBonusWon by BonusRoundScene's wallet animation
        // This animation is for showing bonus added from skill moves
        this.totalBonusWon += bonusAmount;
        this.registry.set('bonusWinAmount', 0);
        
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
                    
                    // Resume the game
                    this.isRunning = true;
                    this.multiplierPaused = false;
                }
            });
        });
    }
    
    showRefereeAndStartBonus() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Store game state before bonus round
        this.saveGameState();
        
        // THEMELESS: Simple text notification without referee image
        const whistleText = this.add.text(width / 2, height / 2 - 50, 'REFEREE WHISTLE!', {
            fontSize: '64px',
            fontStyle: 'bold',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5).setDepth(10000).setScrollFactor(0).setAlpha(0);
        
        const bonusText = this.add.text(width / 2, height / 2 + 50, 'BONUS ROUND!', {
            fontSize: '48px',
            fontStyle: 'bold',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(10000).setScrollFactor(0).setAlpha(0);
        
        // Store references for cleanup
        this.refereeElements = { whistleText, bonusText };
        
        // Fade in text
        this.tweens.add({
            targets: [whistleText, bonusText],
            alpha: 1,
            duration: 400,
            ease: 'Power2'
        });
        
        // Wait then fade out and start bonus round
        this.time.delayedCall(2000, () => {
            // Fade out text
            this.tweens.add({
                targets: [whistleText, bonusText],
                alpha: 0,
                duration: 400,
                onComplete: () => {
                    whistleText.destroy();
                    bonusText.destroy();
                    if (this.scene.isActive('BonusRoundScene')) {
                        this.scene.stop('BonusRoundScene');
                    }
                    this.scene.sleep('RunningScene');
                    this.scene.launch('BonusRoundScene');
                }
            });
        });
    }
    
    gameOver() {
        console.log('THEMELESS: gameOver() called');
        this.isRunning = false;
        
        // Stop all timers and tweens
        this.time.removeAllEvents();
        this.tweens.killAll();
        
        // Clear any active text messages
        if (this.activeTextMessages) {
            this.activeTextMessages.forEach(textObj => {
                if (textObj.text && textObj.text.active) {
                    textObj.text.destroy();
                }
            });
            this.activeTextMessages = [];
        }
        
        // Game over with no win
        this.registry.set('finalMultiplier', 0);
        this.registry.set('won', false);
        this.registry.set('outcomeType', 'crash');
        
        console.log('THEMELESS: Starting OutcomeScene in 1 second');
        
        // Use a new timer for the scene transition
        this.time.delayedCall(1000, () => {
            console.log('THEMELESS: Transitioning to OutcomeScene now');
            this.scene.start('OutcomeScene');
        });
    }
}
