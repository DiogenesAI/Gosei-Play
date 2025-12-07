const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { log } = require('./utils/logger');
const { setupRedisAdapter } = require('./config/redis');

// Managers
const gameManager = require('./managers/GameManager');
const EnhancedAIManager = require('./managers/enhanced-ai-manager');
const TimerManager = require('./managers/TimerManager');

// API
const AIGameAPI = require('./api/ai-game-api');

// Handlers Factories
const createConnectionHandlers = require('./handlers/connectionHandlers');
const createGameManagementHandlers = require('./handlers/gameManagementHandlers');
const createMoveHandlers = require('./handlers/moveHandlers');
const createUndoHandlers = require('./handlers/undoHandlers');
const createScoringHandlers = require('./handlers/scoringHandlers');
const createGameActionHandlers = require('./handlers/gameActionHandlers');
const createChatHandlers = require('./handlers/chatHandlers');
const createTimerHandlers = require('./handlers/timerHandlers');

const app = express();
app.use(cors());
app.use(express.json()); // Add JSON parsing middleware

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow connections from any origin for development
    methods: ["GET", "POST"]
  },
  // Add these settings to fix disconnection issues
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e8
});

// Initialize Redis adapter
setupRedisAdapter(io).catch(err => {
  console.error('Redis adapter initialization error:', err);
});

// Initialize Managers
const aiGameManager = new EnhancedAIManager();
const timerManager = new TimerManager(io, gameManager);
timerManager.start();

// Initialize API
const aiGameAPI = new AIGameAPI(aiGameManager);

io.on('connection', (socket) => {
  log(`New client connected: ${socket.id}`);

  // Initialize handlers
  const connectionHandlers = createConnectionHandlers(io, socket, gameManager, aiGameManager);
  const gameManagementHandlers = createGameManagementHandlers(io, socket, gameManager, aiGameManager);
  const moveHandlers = createMoveHandlers(io, socket, gameManager, aiGameManager);
  const undoHandlers = createUndoHandlers(io, socket, gameManager, aiGameManager);
  const scoringHandlers = createScoringHandlers(io, socket, gameManager);
  const gameActionHandlers = createGameActionHandlers(io, socket, gameManager);
  const chatHandlers = createChatHandlers(io, socket, gameManager);
  const timerHandlers = createTimerHandlers(io, socket, gameManager);

  // Game Management Events
  socket.on('createGame', gameManagementHandlers.handleCreateGame);
  socket.on('joinGame', gameManagementHandlers.handleJoinGame);
  socket.on('playAgainRequest', gameManagementHandlers.handlePlayAgainRequest);
  socket.on('playAgainResponse', gameManagementHandlers.handlePlayAgainResponse);

  // Move Events
  socket.on('makeMove', moveHandlers.handleMakeMove);
  socket.on('passTurn', moveHandlers.handlePassTurn);

  // Undo Events
  socket.on('requestUndo', undoHandlers.handleRequestUndo);
  socket.on('respondToUndoRequest', undoHandlers.handleRespondToUndoRequest);

  // Scoring Events
  socket.on('confirmScore', scoringHandlers.handleConfirmScore);
  socket.on('gameEnded', scoringHandlers.handleGameEnded);
  socket.on('cancelScoring', scoringHandlers.handleCancelScoring);
  socket.on('forceScoring', scoringHandlers.handleForceScoring);
  socket.on('toggleDeadStone', scoringHandlers.handleToggleDeadStone);
  socket.on('syncDeadStones', scoringHandlers.handleSyncDeadStones);

  // Game Action Events
  socket.on('resignGame', gameActionHandlers.handleResignGame);
  socket.on('requestSync', gameActionHandlers.handleRequestSync);
  socket.on('getGameState', gameActionHandlers.handleGetGameState);
  socket.on('gameStatusChanged', gameActionHandlers.handleGameStatusChanged);

  // Chat Events
  socket.on('chatMessage', chatHandlers.handleChatMessage);

  // Timer Events
  socket.on('timerTick', timerHandlers.handleTimerTick);

  // Connection Events
  socket.on('leaveGame', connectionHandlers.handleLeaveGame);
  socket.on('disconnect', connectionHandlers.handleDisconnect);
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('🛑 Shutting down server...');
  aiGameManager.shutdown();
  timerManager.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down server...');
  aiGameManager.shutdown();
  timerManager.stop();
  process.exit(0);
});

// Routes
app.get('/', (req, res) => {
  res.send('Socket server is running');
});

// Health check endpoint for monitoring
app.get('/health', (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'development',
      REDIS_URL: process.env.REDIS_URL ? 'configured' : 'not configured',
      REDIS_PASSWORD: process.env.REDIS_PASSWORD ? 'configured' : 'not configured'
    },
    activeGames: gameManager.getAllActiveGames().size,
    connectedSockets: io.engine.clientsCount,
    memory: process.memoryUsage(),
    version: '1.0.8'
  };

  res.json(healthData);
});

// Debug endpoint to show Redis adapter status
app.get('/debug/redis', (req, res) => {
  const redisStatus = {
    adapterConfigured: !!io.of('/').adapter.constructor.name.includes('Redis'),
    adapterType: io.of('/').adapter.constructor.name,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      REDIS_URL: process.env.REDIS_URL,
      REDIS_PASSWORD: process.env.REDIS_PASSWORD ? '[CONFIGURED]' : null
    },
    timestamp: new Date().toISOString()
  };

  res.json(redisStatus);
});

// AI API Routes
app.get('/api/ai/opponents/:rank', (req, res) => {
  aiGameAPI.getAvailableOpponents(req, res);
});

app.get('/api/ai/networks', (req, res) => {
  aiGameAPI.getNetworkInfo(req, res);
});

app.get('/api/ai/all-networks', (req, res) => {
  aiGameAPI.getAllNetworks(req, res);
});

app.get('/api/ai/test-selection/:rank/:strength', (req, res) => {
  aiGameAPI.testNetworkSelection(req, res);
});

app.post('/api/ai/create-game', (req, res) => {
  aiGameAPI.createAIGame(req, res);
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  log(`Socket server listening on ${HOST}:${PORT}`);
});
