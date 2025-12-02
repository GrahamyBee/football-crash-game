# Football Crash Game

A web-based mobile crash game based on football mechanics. Players choose a footballer and navigate through opposition tackles while building up their cash value, with decision points to pass, continue, or shoot for the goal.

## Game Features

### Core Gameplay
- **4 Footballers** to choose from with different colors
- **6 Stake Options**: 5p, 10p, 25p, 50p, £1, £2
- **Running Phase**: Cash value increases continuously from 0x to 500x
- **Crash Mechanic**: Opposition players tackle footballers, eliminating them
- **Decision Intervals**: Pause points where players can:
  - Continue running
  - Pass to another active player
  - Shoot for goal
  - Cash out (win current value)
- **Shooting Phase**: 
  - Distance-based multiplier increases as ball travels
  - Goal outcomes: Miss, Save, or Goal
  - Final payout: Running cash × Shooting multiplier

### Technical Features
- Built with **Phaser 3** game framework
- Responsive design for mobile and desktop
- Touch-friendly controls
- HTML5 Canvas rendering
- No backend required (client-side game)

## How to Play

1. **Selection Phase**:
   - Choose your stake amount
   - Select one of four footballers
   - Click "START GAME"

2. **Running Phase**:
   - Referee blows whistle and game begins
   - Your footballer (marked "YOU") runs with the ball
   - Cash value increases as you run
   - Avoid opposition tackles (red circles)
   - If tackled, ball automatically passes to another active player

3. **Decision Intervals**:
   - Game pauses at regular intervals
   - Choose your strategy:
     - **Continue**: Keep running with current player
     - **Pass**: Transfer ball to another active player
     - **Shoot**: Take a shot at goal
     - **Cash Out**: Win your current cash value and end game

4. **Shooting Phase**:
   - Ball travels toward the goal
   - Shooting multiplier increases during flight
   - Longer distance = higher potential multiplier
   - Three outcomes:
     - **Miss**: Game over, no win
     - **Saved**: Goalkeeper catches it, game over
     - **Goal**: Win! Final payout = Running value × Shooting multiplier

## Installation & Running

### Option 1: Simple Local Server (Python)

```bash
# Navigate to the game directory
cd "Football Crash"

# Start a local server (Python 3)
python3 -m http.server 8000

# Open in browser
# Visit: http://localhost:8000
```

### Option 2: Node.js Server

```bash
# Install http-server globally (one time only)
npm install -g http-server

# Navigate to game directory and start server
cd "Football Crash"
http-server -p 8000

# Visit: http://localhost:8000
```

### Option 3: VS Code Live Server Extension

1. Install "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

### Option 4: Direct File Opening

Simply open `index.html` directly in your browser. Note: Some features may be limited due to CORS restrictions.

## File Structure

```
Football Crash/
├── index.html              # Main HTML file
├── styles.css              # Game styling
├── README.md              # This file
└── js/
    ├── main.js            # Game initialization
    ├── config.js          # Game configuration
    └── scenes/
        ├── BootScene.js       # Initial loading scene
        ├── SelectionScene.js  # Stake & player selection
        ├── RunningScene.js    # Main running gameplay
        ├── DecisionScene.js   # Decision interval UI
        ├── ShootingScene.js   # Shooting mechanics
        └── OutcomeScene.js    # Win/loss screen
```

## Configuration

Edit `js/config.js` to customize game parameters:

```javascript
// Stake options
STAKES: [5, 10, 25, 50, 100, 200]

// Multiplier range
MIN_MULTIPLIER: 0
MAX_MULTIPLIER: 500

// Game speed
RUNNING_SPEED: 100
MULTIPLIER_INCREASE_RATE: 0.5

// Decision intervals (seconds)
DECISION_INTERVALS: [3, 6, 9, 12, 15]

// Crash probability
CRASH_CHANCE_PER_SECOND: 0.15

// Goal probabilities
GOAL_HIT_CHANCE: 0.8
GOALKEEPER_SAVE_CHANCE: 0.4
```

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

## Development

### Technologies Used
- **Phaser 3.70.0**: Game framework
- **HTML5 Canvas**: Rendering
- **JavaScript ES6**: Game logic
- **CSS3**: Styling

### Adding Graphics

Currently using placeholder graphics (colored circles). To add custom graphics:

1. Create sprite images (PNG with transparency)
2. Add to `assets/` folder
3. Load in `BootScene.js`:
   ```javascript
   this.load.image('player', 'assets/player.png');
   ```
4. Replace circles with sprites in scene files

## Future Enhancements

- [ ] Sound effects (whistle, tackle, crowd cheers)
- [ ] Background music
- [ ] Particle effects for goals and tackles
- [ ] Player statistics tracking
- [ ] Leaderboard system
- [ ] Multiplayer functionality
- [ ] Backend integration for fair RNG
- [ ] Custom footballer skins
- [ ] Achievement system
- [ ] Save game progress

## License

This is a prototype/demo game. Assets and commercial use rights should be properly secured before public deployment.

## Credits

Created with Phaser 3 game framework
