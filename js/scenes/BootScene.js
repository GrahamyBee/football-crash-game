class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        console.log('BootScene preload() starting...');
        
        // Error handling - must be set before loading starts
        this.load.on('loaderror', (file) => {
            console.error('Error loading file:', file.src);
            console.error('File key:', file.key);
            console.error('File type:', file.type);
        });
        
        this.load.on('complete', () => {
            console.log('All assets loaded!');
        });
        
        // Load static footballer images for selection screen
        this.load.image('footballer1_img', 'Assets/footballer1.png');
        this.load.image('footballer2_img', 'Assets/footballer2.png');
        this.load.image('footballer3_img', 'Assets/footballer3.png');
        this.load.image('footballer4_img', 'Assets/footballer4.png');
        
        // Load football image
        this.load.image('football', 'Assets/football.png');
        
        // Load opposition assets
        this.load.spritesheet('opposition_run', 'Assets/opposition_run.png', {
            frameWidth: 256,
            frameHeight: 256
        });
        this.load.image('opposition_dodge', 'Assets/opposition_dodge.png');
        this.load.image('opposition_skill', 'Assets/opposition_skill.png');
        this.load.image('opposition_tackle', 'Assets/opposition_tackle.png');
        this.load.image('player_dive', 'Assets/player_dive.png');
        
        // Load all four footballer sprite sheets for animations during gameplay
        // 6 frames at 256x256 each = total image should be 1536x256
        this.load.spritesheet('footballer1', 'Assets/FOOTBALLER_NEW.png', {
            frameWidth: 256,
            frameHeight: 256
        });
        
        this.load.spritesheet('footballer2', 'Assets/FOOTBALLER_2_NEW.png', {
            frameWidth: 256,
            frameHeight: 256
        });
        
        this.load.spritesheet('footballer3', 'Assets/FOOTBALLER_3_NEW.png', {
            frameWidth: 256,
            frameHeight: 256
        });
        
        this.load.spritesheet('footballer4', 'Assets/FOOTBALLER_4_NEW.png', {
            frameWidth: 256,
            frameHeight: 256
        });
        
        console.log('All 4 static images and sprite sheets queued for loading');
    }

    create() {
        console.log('BootScene create() starting...');
        console.log('Checking textures...');
        
        // Create animations for all 4 footballers
        const footballers = ['footballer1', 'footballer2', 'footballer3', 'footballer4'];
        
        footballers.forEach((key, index) => {
            if (this.textures.exists(key)) {
                console.log(`${key} sprite sheet loaded successfully!`);
                const texture = this.textures.get(key);
                console.log(`${key} frame count:`, texture.frameTotal);
                
                // Create running animation for this footballer
                try {
                    this.anims.create({
                        key: `run${index + 1}`,  // run1, run2, run3, run4
                        frames: this.anims.generateFrameNumbers(key, { start: 0, end: 5 }), // 6 frames (0-5)
                        frameRate: 5,  // 5 frames per second
                        repeat: -1      // Loop forever
                    });
                    console.log(`Animation run${index + 1} created successfully!`);
                } catch (error) {
                    console.error(`Error creating animation for ${key}:`, error);
                }
            } else {
                console.warn(`${key} sprite sheet not loaded - will use circle fallback`);
            }
        });
        
        // Create opposition running animation
        if (this.textures.exists('opposition_run')) {
            console.log('opposition_run sprite sheet loaded successfully!');
            try {
                this.anims.create({
                    key: 'opposition_run_anim',
                    frames: this.anims.generateFrameNumbers('opposition_run', { start: 0, end: 5 }), // 6 frames
                    frameRate: 5,
                    repeat: -1
                });
                console.log('Opposition run animation created successfully!');
            } catch (error) {
                console.error('Error creating opposition animation:', error);
            }
        }
        
        // Initialize game data
        console.log('Initializing game data...');
        this.registry.set('selectedPlayer', null);
        this.registry.set('selectedStake', null);
        this.registry.set('currentMultiplier', 0);
        this.registry.set('activePlayers', [true, true, true, true]);
        this.registry.set('playerPositions', [0, 0, 0, 0]);
        this.registry.set('gameStartTime', 0);
        
        // Initialize wallet (only if not already set)
        if (!this.registry.has('walletBalance')) {
            this.registry.set('walletBalance', 10000); // £100.00 in pence
        }
        
        console.log('Game data initialized, starting SelectionScene...');
        // Start the selection scene
        this.scene.start('SelectionScene');
        console.log('SelectionScene started!');
    }
}
