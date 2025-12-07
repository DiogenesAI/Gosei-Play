# Gosei Play Server Documentation

This directory contains the backend server for Gosei Play, a real-time Go (Baduk/Weiqi) application. The server is built using **Node.js**, **Express**, and **Socket.IO** to handle real-time game state synchronization, AI integration (KataGo), and game management.

## 🏗️ Architecture

The server has been refactored from a monolithic `server.js` into a modular architecture to improve maintainability and scalability.

### Directory Structure

```
server/
├── api/            # Express API endpoints (AI integration)
├── config/         # Configuration files (Redis, etc.)
├── engines/        # AI engine binaries/scripts
├── handlers/       # Socket.IO event handlers (Business Logic)
├── managers/       # State management classes
├── utils/          # Utility functions (Game logic, Time, Logging)
├── katago/         # KataGo specific setup
└── server.js       # Main entry point
```

## 🧩 Key Components

### 1. Entry Point (`server.js`)
The main entry point initializes:
- Express App & HTTP Server
- Socket.IO Server (with Redis adapter support)
- Managers (`GameManager`, `TimerManager`, `EnhancedAIManager`)
- Event Handlers (injected with dependencies)

### 2. Managers (`server/managers/`)
- **`GameManager.js`**: Singleton responsible for storing active game states in memory (`Map<gameId, gameState>`) and mapping sockets to games.
- **`TimerManager.js`**: Handles the server-side game clock. It runs a precise interval to update game times, handle byo-yomi (overtime), and enforce timeouts.
- **`EnhancedAIManager.js`**: Manages the lifecycle of AI opponents (KataGo), handling process spawning, move generation, and analysis.

### 3. Handlers (`server/handlers/`)
Socket.IO events are grouped into specific handler modules:
- **`connectionHandlers.js`**: Handle `disconnect` and `leaveGame`.
- **`gameManagementHandlers.js`**: `createGame`, `joinGame`, `playAgain`.
- **`moveHandlers.js`**: `makeMove`, `passTurn`.
- **`undoHandlers.js`**: `requestUndo`, `respondToUndoRequest`.
- **`scoringHandlers.js`**: `confirmScore`, `toggleDeadStone`, `forceScoring`.
- **`gameActionHandlers.js`**: `resignGame`, `getGameState`.
- **`chatHandlers.js`**: `chatMessage`.
- **`timerHandlers.js`**: `timerTick` (client synchronization).

### 4. Utilities (`server/utils/`)
- **`gameLogic.js`**: Core Go rules (capture stones, liberties, handicap placement).
- **`timeUtils.js`**: Time formatting and calculation.
- **`timeControlUtils.js`**: Logic for handling player timeouts.
- **`aiLogic.js`**: Helper functions for AI move execution and time management.
- **`socketUtils.js`**: Standardized broadcasting of game updates.

## 🔌 Socket.IO Events

### Game Management
- `createGame`: Initialize a new game room.
- `joinGame`: Join an existing room (player or spectator).
- `playAgainRequest` / `playAgainResponse`: Rematch logic.

### Gameplay
- `makeMove`: Place a stone. Validates move, captures stones, updates history.
- `passTurn`: Pass the turn. Triggers scoring if double pass.
- `requestUndo` / `respondToUndoRequest`: Undo move logic.
- `resignGame`: Forfeit the game.

### Scoring
- `toggleDeadStone`: Mark stones as dead/alive during scoring.
- `confirmScore`: Agree on the final result.
- `forceScoring`: (AI games only) Force game into scoring phase.

### Real-time Updates
- `gameState`: Full game state broadcast.
- `moveMade`: Incremental update for a new move.
- `timeUpdate`: Frequent clock synchronization.
- `chatMessage`: In-game chat.

## 🚀 Setup & Running

### Prerequisites
- Node.js (v18+ recommended)
- Redis (Optional, for multi-server scaling)
- KataGo (for AI features)

### Installation
```bash
cd server
npm install
```

### Running Locally
```bash
# Standard start
npm start

# Development mode (if nodemon is installed)
npm run dev
```

### Environment Variables
- `PORT`: Server port (default: 3001)
- `REDIS_URL`: Connection string for Redis (e.g., `redis://localhost:6379`)
- `NODE_ENV`: `production` or `development`

## 🤖 AI Integration
The server integrates with KataGo via the `EnhancedAIManager`. It supports:
- **Direct Network Selection**: Loading specific neural networks.
- **Elo Ratings**: Estimating AI strength.
- **Analysis**: Real-time evaluation (optional).

## 🔄 Scaling
The server is designed to scale horizontally using **Redis**.
- The `RedisAdapter` in `config/redis.js` allows multiple server instances to communicate.
- Game state is currently in-memory (`GameManager`), so sticky sessions are required, or `GameManager` needs to be migrated to a distributed store (like Redis) for full stateless scaling.
