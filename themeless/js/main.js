// Main game initialization
const config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: 800,
    height: 1200,
    backgroundColor: '#1a1a1a',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 800,
        height: 1200
    },
    scene: [
        BootScene,
        SelectionScene,
        RunningScene,
        DecisionScene,
        ShootingScene,
        PenaltyScene,
        BonusRoundScene,
        OutcomeScene
    ],
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    }
};

// Create the game instance
const game = new Phaser.Game(config);
