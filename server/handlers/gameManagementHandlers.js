const { v4: uuidv4 } = require('uuid');
const { log } = require('../utils/logger');
const { validateGameCreation } = require('../utils/captcha');
const { broadcastGameUpdate } = require('../utils/socketUtils');
const { makeAIMove } = require('../utils/aiLogic');
const { getHandicapStones } = require('../utils/gameLogic');

const GAME_CONFIGURATIONS = {
    standard: {
        name: 'Standard',
        description: 'Traditional Go with main time + byo-yomi periods'
    },
    blitz: {
        name: 'Blitz',
        description: 'Fast-paced games with time per move limit',
        defaultTimePerMove: 30 // Default 30 seconds per move
    }
};

module.exports = (io, socket, gameManager, aiGameManager) => {
    const handleCreateGame = ({ gameState, playerId, captcha, captchaAnswer, multiCaptcha, captchaAnswers, playerName }) => {
        log(`Creating game: ${gameState.id}, Code: ${gameState.code}`);

        // Get client IP for rate limiting
        const clientIP = socket.handshake.address || socket.conn.remoteAddress || 'unknown';

        // Validate captcha and rate limiting
        const validation = validateGameCreation({
            playerName: playerName || gameState.players[0]?.username,
            captcha,
            captchaAnswer,
            multiCaptcha,
            captchaAnswers
        }, clientIP);

        if (!validation.valid) {
            log(`Game creation validation failed: ${validation.error}`);
            socket.emit('gameCreationError', {
                error: validation.error,
                resetTime: validation.resetTime
            });
            return;
        }

        log(`Captcha validation passed for game creation`);

        // Check for color preference if provided
        if (gameState.colorPreference) {
            log(`Owner requested color preference: ${gameState.colorPreference}`);

            // Find the owner player
            const ownerPlayer = gameState.players.find(p => p.id === playerId);

            if (ownerPlayer) {
                if (gameState.colorPreference === 'black') {
                    ownerPlayer.color = 'black';
                } else if (gameState.colorPreference === 'white') {
                    ownerPlayer.color = 'white';
                }
                // If 'random', keep the default assignment
            }
        }

        // Initialize time control settings
        if (gameState.timeControl) {
            log(`Setting up time control: Main time: ${gameState.timeControl.timeControl} minutes, ` +
                `Byoyomi: ${gameState.timeControl.byoYomiPeriods} periods of ${gameState.timeControl.byoYomiTime} seconds`);

            gameState.lastMoveTime = Date.now();

            // Initialize time remaining for each player with full time control
            gameState.players.forEach(player => {
                // Convert minutes to seconds for main time
                player.timeRemaining = gameState.timeControl.timeControl * 60;

                // Initialize byo-yomi state
                if (gameState.timeControl.byoYomiPeriods > 0) {
                    player.byoYomiPeriodsLeft = gameState.timeControl.byoYomiPeriods;
                    player.byoYomiTimeLeft = gameState.timeControl.byoYomiTime;
                    player.isInByoYomi = false; // Start in main time
                }

                log(`Initialized time for player ${player.id}: ${player.timeRemaining} seconds main time, ` +
                    `${player.byoYomiPeriodsLeft || 0} byoyomi periods of ${player.byoYomiTimeLeft || 0} seconds`);
            });
        }

        // Initialize blitz game settings if applicable
        if (gameState.gameType === 'blitz') {
            const timePerMove = gameState.timePerMove || GAME_CONFIGURATIONS.blitz.defaultTimePerMove;
            log(`Setting up blitz game with ${timePerMove} seconds per move`);

            gameState.timePerMove = timePerMove;
            gameState.lastMoveTime = Date.now();

            // Initialize time remaining for each player with time per move
            gameState.players.forEach(player => {
                player.timeRemaining = timePerMove;
                log(`Initialized blitz time for player ${player.id}: ${timePerMove} seconds per move`);
            });
        }

        // Store the game state
        gameManager.createGame(gameState);

        // Join the socket to the game's room
        socket.join(gameState.id);
        gameManager.addPlayerToGame(socket.id, gameState.id);

        log(`Player ${playerId} created and joined game ${gameState.id}`);

        // Check if this should be an AI game
        if (gameState.vsAI) {
            const humanPlayer = gameState.players.find(p => p.id === playerId);

            // Check if direct network selection is used
            if (gameState.selectedNetworkId) {
                log(`🤖 Creating AI game with direct network selection: ${gameState.selectedNetworkId}`);

                // Create AI player with direct network selection
                aiGameManager.createAIGameWithDirectNetwork(gameState, humanPlayer, gameState.selectedNetworkId)
                    .then((aiPlayer) => {
                        log(`✅ AI player created with direct network: ${aiPlayer.username} (${aiPlayer.aiNetwork.elo} Elo)`);

                        // Set game status to playing since we now have 2 players (human + AI)
                        gameState.status = 'playing';

                        // Start the timer for standard games
                        if (gameState.gameType !== 'blitz') {
                            gameState.lastMoveTime = Date.now();
                        }

                        log(`Game ${gameState.id} status set to playing with AI opponent`);

                        // Update the stored game state
                        gameManager.updateGame(gameState.id, gameState);

                        // Broadcast updated game state with AI player
                        broadcastGameUpdate(io, gameManager, gameState.id, gameState);

                        // If AI plays first (black), make first move
                        if (aiPlayer.color === 'black') {
                            setTimeout(() => {
                                makeAIMove(io, gameManager, aiGameManager, gameState.id);
                            }, 1000); // Small delay for better UX
                        }
                    })
                    .catch((error) => {
                        log(`❌ Failed to create AI player with direct network: ${error.message}`);
                        socket.emit('gameCreationError', {
                            error: 'Failed to create AI opponent. Please try again or select a different network.'
                        });
                    });
            } else {
                // Fallback to old method for backward compatibility
                const aiLevel = gameState.aiLevel || 'normal';

                log(`🤖 Creating AI game with level: ${aiLevel} (fallback method)`);

                // Create AI player asynchronously
                aiGameManager.createAIGame(gameState, humanPlayer, '5k', 'equal') // Default values
                    .then((aiPlayer) => {
                        log(`✅ AI player created: ${aiPlayer.username}`);

                        // Set game status to playing since we now have 2 players (human + AI)
                        gameState.status = 'playing';

                        // Start the timer for standard games
                        if (gameState.gameType !== 'blitz') {
                            gameState.lastMoveTime = Date.now();
                        }

                        log(`Game ${gameState.id} status set to playing with AI opponent`);

                        // Update the stored game state
                        gameManager.updateGame(gameState.id, gameState);

                        // Broadcast updated game state with AI player
                        broadcastGameUpdate(io, gameManager, gameState.id, gameState);

                        // If AI plays first (black), make first move
                        if (aiPlayer.color === 'black') {
                            setTimeout(() => {
                                makeAIMove(io, gameManager, aiGameManager, gameState.id);
                            }, 1000); // Small delay for better UX
                        }
                    })
                    .catch((error) => {
                        log(`❌ Failed to create AI player: ${error.message}`);
                        socket.emit('gameCreationError', {
                            error: 'Failed to create AI opponent. Please try again.'
                        });
                    });
            }
        }

        // Use the new broadcast function
        broadcastGameUpdate(io, gameManager, gameState.id, gameState);
    };

    const handleJoinGame = ({ gameId, playerId, username, isReconnect, asSpectator }) => {
        log(`Player ${playerId} (${username}) joining game ${gameId}${asSpectator ? ' as spectator' : ''}`);

        // Add socket to the game's room
        socket.join(gameId);
        gameManager.addPlayerToGame(socket.id, gameId);

        // Get the current game state
        const gameState = gameManager.getGame(gameId);

        if (gameState) {
            // Initialize spectators array if it doesn't exist
            if (!gameState.spectators) {
                gameState.spectators = [];
            }

            // If this is a reconnection or spectator joining
            if (isReconnect) {
                // Find the existing player in the game state (check both players and spectators)
                const existingPlayer = gameState.players.find(p => p.id === playerId);
                const existingSpectator = gameState.spectators.find(p => p.id === playerId);

                if (existingPlayer) {
                    log(`Reconnect: Preserving time for player ${playerId}: ${existingPlayer.timeRemaining} seconds remaining`);
                    // Send the current game state with preserved time remaining to the reconnecting client
                    socket.emit('gameState', gameState);

                    // Also send an immediate time update to refresh the UI
                    gameState.players.forEach(player => {
                        socket.emit('timeUpdate', {
                            gameId,
                            playerId: player.id,
                            color: player.color,
                            timeRemaining: player.timeRemaining
                        });
                    });

                    // Notify other players that this player has rejoined
                    socket.to(gameId).emit('playerJoined', {
                        gameId,
                        playerId,
                        username,
                        isReconnect: true,
                        isSpectator: false
                    });
                } else if (existingSpectator) {
                    log(`Spectator reconnect: ${playerId}`);
                    socket.emit('gameState', gameState);

                    // Spectators rejoin silently - no notifications
                } else {
                    log(`Warning: Reconnecting player/spectator ${playerId} not found in game ${gameId}`);
                    socket.emit('gameState', gameState);
                }
            } else if (asSpectator || gameState.players.length >= 2) {
                // Join as spectator if explicitly requested or if game already has 2 players
                const spectator = {
                    id: playerId,
                    username,
                    color: null,
                    isSpectator: true
                };

                // Check if spectator already exists
                const existingSpectatorIndex = gameState.spectators.findIndex(s => s.id === playerId);
                if (existingSpectatorIndex === -1) {
                    gameState.spectators.push(spectator);
                    log(`Added spectator ${username} to game ${gameId}`);
                }

                // Update stored game state
                gameManager.updateGame(gameId, gameState);

                // Send acknowledgment
                socket.emit('joinedGame', {
                    success: true,
                    gameId,
                    playerId,
                    isSpectator: true,
                    numPlayers: gameState.players.length,
                    numSpectators: gameState.spectators.length,
                    status: gameState.status,
                    currentTurn: gameState.currentTurn
                });

                // Spectators join silently - no notifications

                // Use the new broadcast function for game updates
                broadcastGameUpdate(io, gameManager, gameId, gameState);

                log(`Game ${gameId} now has ${gameState.players.length} players and ${gameState.spectators.length} spectators`);
                return;
            } else {
                // Handle new player joining (not a reconnect)
                // Find the player in the game state
                const playerIndex = gameState.players.findIndex(p => p.id === playerId);

                if (playerIndex === -1) {
                    // Determine color for new player
                    let newPlayerColor = 'white'; // Default second player is white

                    // Check if the owner had a color preference
                    const ownerPlayer = gameState.players[0];
                    if (ownerPlayer && ownerPlayer.color) {
                        // Assign opposite color to second player
                        newPlayerColor = ownerPlayer.color === 'black' ? 'white' : 'black';
                    }

                    // Add new player with the determined color
                    const newPlayer = {
                        id: playerId,
                        username,
                        color: newPlayerColor,
                        isInByoYomi: false // Start in main time
                    };

                    // Initialize time settings based on game type
                    if (gameState.gameType === 'blitz') {
                        // For blitz games, each player gets the time per move
                        const timePerMove = gameState.timePerMove || GAME_CONFIGURATIONS.blitz.defaultTimePerMove;
                        newPlayer.timeRemaining = timePerMove;
                        log(`Initialized blitz time for joining player ${playerId}: ${timePerMove} seconds per move`);
                    } else {
                        // For standard games, use time control settings
                        newPlayer.timeRemaining = gameState.timeControl ? gameState.timeControl.timeControl * 60 : 0;
                        newPlayer.byoYomiPeriodsLeft = gameState.timeControl?.byoYomiPeriods || 0;
                        newPlayer.byoYomiTimeLeft = gameState.timeControl?.byoYomiTime || 30;
                        log(`Initialized standard time for joining player ${playerId}: ${newPlayer.timeRemaining} seconds main time, ` +
                            `${newPlayer.byoYomiPeriodsLeft} byoyomi periods of ${newPlayer.byoYomiTimeLeft} seconds`);
                    }

                    gameState.players.push(newPlayer);

                    // If we now have 2 players, set status to playing
                    if (gameState.players.length >= 2) {
                        log(`Game ${gameId} now has 2 players, changing status to playing`);
                        gameState.status = 'playing';

                        // For blitz games, don't start the timer until first move
                        if (gameState.gameType === 'blitz') {
                            // Set lastMoveTime to null so timer doesn't start until first move
                            gameState.lastMoveTime = null;
                            log(`Blitz game timer will start on first move`);
                        } else {
                            // For standard games, start timer immediately
                            gameState.lastMoveTime = Date.now();
                        }

                        // Keep the current turn as is for handicap games (should be 'white')
                        // Only set to 'black' for non-handicap games
                        if (gameState.gameType !== 'handicap') {
                            gameState.currentTurn = 'black';
                        } else {
                            log(`This is a handicap game. Current turn remains: ${gameState.currentTurn}`);
                            log(`Handicap stones on board: ${gameState.board.stones.filter(s => s.color === 'black').length}`);
                        }

                        log(`Game's currentTurn is set to: ${gameState.currentTurn}`);
                        // Debug log to show which player has which color
                        gameState.players.forEach(player => {
                            log(`Player ${player.username} is ${player.color}`);
                        });
                    }
                }

                // Update stored game state
                gameManager.updateGame(gameId, gameState);

                // Notify other players in the room
                socket.to(gameId).emit('playerJoined', {
                    gameId,
                    playerId,
                    username
                });

                // Use the new broadcast function for game updates
                broadcastGameUpdate(io, gameManager, gameId, gameState);
            }

            // Send join acknowledgment
            socket.emit('joinedGame', {
                success: true,
                gameId,
                playerId,
                numPlayers: gameState.players.length,
                status: gameState.status,
                currentTurn: gameState.currentTurn // Send current turn info explicitly
            });

            log(`Game ${gameId} now has ${gameState.players.length} players, status: ${gameState.status}, currentTurn: ${gameState.currentTurn}`);
        } else {
            log(`Game ${gameId} not found in active games`);
            socket.emit('error', `Game ${gameId} not found`);
        }
    };

    const handlePlayAgainRequest = ({ gameId, fromPlayerId, fromUsername, toPlayerId }) => {
        log(`Player ${fromPlayerId} (${fromUsername}) requested play again in game ${gameId} to player ${toPlayerId}`);

        const gameState = gameManager.getGame(gameId);
        if (gameState) {
            // Check if this is an AI game
            const isAIGame = gameState.players.some(player => player.isAI);
            const targetPlayer = gameState.players.find(p => p.id === toPlayerId);
            const isTargetAI = targetPlayer && targetPlayer.isAI;

            log(`🔍 Play again debug: isAIGame=${isAIGame}, targetPlayer=${JSON.stringify(targetPlayer)}, isTargetAI=${isTargetAI}`);
            log(`🔍 All players: ${JSON.stringify(gameState.players.map(p => ({ id: p.id, username: p.username, isAI: p.isAI })))}`);

            if (isAIGame && isTargetAI) {
                // Auto-accept play again requests for AI games
                log(`🤖 AI game detected - auto-accepting play again request`);

                // Create a new game immediately (same logic as accepted response)
                const originalGame = gameState;
                const newGameId = uuidv4();
                const newGameCode = Math.random().toString(36).substr(2, 6).toUpperCase();

                // Create new game state with same settings but reset board
                const newGameState = {
                    id: newGameId,
                    code: newGameCode,
                    players: originalGame.players.map(player => ({
                        ...player,
                        timeRemaining: originalGame.timeControl ? originalGame.timeControl.timeControl * 60 : undefined,
                        byoYomiPeriodsLeft: originalGame.timeControl?.byoYomiPeriods || 0,
                        byoYomiTimeLeft: originalGame.timeControl?.byoYomiTime || 30,
                        isInByoYomi: false
                    })),
                    board: {
                        size: originalGame.board.size,
                        stones: []
                    },
                    currentTurn: 'black',
                    status: 'playing',
                    history: [],
                    capturedStones: { capturedByBlack: 0, capturedByWhite: 0 },
                    komi: originalGame.komi,
                    scoringRule: originalGame.scoringRule,
                    gameType: originalGame.gameType,
                    handicap: originalGame.handicap || 0,
                    timeControl: originalGame.timeControl,
                    timePerMove: originalGame.timePerMove,
                    lastMoveTime: Date.now(),
                    createdAt: Date.now(),
                    vsAI: originalGame.vsAI,
                    aiLevel: originalGame.aiLevel,
                    selectedNetworkId: originalGame.selectedNetworkId, // Preserve network selection
                    aiUndoUsed: false // Reset undo usage for new game
                };

                log(`🔍 New game state players: ${JSON.stringify(newGameState.players.map(p => ({ id: p.id, username: p.username, isAI: p.isAI })))}`);

                // Store the new game first
                gameManager.createGame(newGameState);

                // Add handicap stones if it's a handicap game
                if (newGameState.gameType === 'handicap' && newGameState.handicap > 0) {
                    const handicapStones = getHandicapStones(newGameState.board.size, newGameState.handicap);
                    newGameState.board.stones = handicapStones;
                    newGameState.currentTurn = 'white';
                }

                // Create AI engine for the new game (players are already copied over)
                if (aiGameManager && originalGame.vsAI) {
                    const humanPlayer = newGameState.players.find(p => !p.isAI);
                    const aiPlayer = newGameState.players.find(p => p.isAI);

                    if (humanPlayer && aiPlayer) {
                        setTimeout(async () => {
                            try {
                                // Use the proper AI manager methods to recreate the AI game
                                if (newGameState.selectedNetworkId) {
                                    log(`🤖 Recreating AI game with direct network selection: ${newGameState.selectedNetworkId}`);
                                    await aiGameManager.createAIGameWithDirectNetwork(newGameState, humanPlayer, newGameState.selectedNetworkId);
                                } else {
                                    // Fallback to old method
                                    const aiLevel = originalGame.aiLevel || 'normal';
                                    log(`🤖 Recreating AI game with level: ${aiLevel}`);
                                    await aiGameManager.createAIGame(newGameState, humanPlayer, '5k', aiLevel);
                                }

                                log(`✅ AI engine recreated for new game ${newGameId}`);

                                // Update the stored game state
                                const updatedGameState = gameManager.getGame(newGameId);
                                if (updatedGameState) {
                                    broadcastGameUpdate(io, gameManager, newGameId, updatedGameState);
                                }
                            } catch (error) {
                                log(`❌ Failed to recreate AI engine: ${error.message}`);
                            }
                        }, 100);
                    }
                }

                // Move player to the new game room
                const gameRoom = io.sockets.adapter.rooms.get(gameId);
                if (gameRoom) {
                    gameRoom.forEach(socketId => {
                        const socket = io.sockets.sockets.get(socketId);
                        if (socket) {
                            socket.leave(gameId);
                            socket.join(newGameId);
                            gameManager.addPlayerToGame(socketId, newGameId);
                        }
                    });
                }

                log(`Created new AI game ${newGameId} (${newGameCode}) - auto-accepted play again`);

                // Broadcast the new game to the player
                setTimeout(() => {
                    io.to(newGameId).emit('playAgainResponse', {
                        accepted: true,
                        gameId: newGameId,
                        newGameState: newGameState
                    });

                    broadcastGameUpdate(io, gameManager, newGameId, newGameState);
                }, 200);

            } else {
                // Regular human vs human game - send request for manual acceptance
                io.to(gameId).emit('playAgainRequest', {
                    gameId,
                    fromPlayerId,
                    fromUsername,
                    toPlayerId
                });

                log(`Play again request sent from ${fromUsername} to player ${toPlayerId} in game ${gameId}`);
            }
        } else {
            log(`Play again request failed: Game ${gameId} not found`);
            socket.emit('error', `Game ${gameId} not found`);
        }
    };

    const handlePlayAgainResponse = ({ gameId, fromPlayerId, accepted }) => {
        log(`Player ${fromPlayerId} responded to play again request in game ${gameId}: ${accepted ? 'accepted' : 'declined'}`);

        const gameState = gameManager.getGame(gameId);
        if (gameState) {
            if (accepted) {
                // Create a new game with the same players and settings
                const originalGame = gameState;
                const newGameId = uuidv4(); // Use proper UUID instead of timestamp
                const newGameCode = Math.random().toString(36).substr(2, 6).toUpperCase();

                // Create new game state with same settings but reset board
                const newGameState = {
                    id: newGameId,
                    code: newGameCode,
                    players: originalGame.players.map(player => ({
                        ...player,
                        timeRemaining: originalGame.timeControl ? originalGame.timeControl.timeControl * 60 : undefined,
                        byoYomiPeriodsLeft: originalGame.timeControl?.byoYomiPeriods || 0,
                        byoYomiTimeLeft: originalGame.timeControl?.byoYomiTime || 30,
                        isInByoYomi: false
                    })),
                    board: {
                        size: originalGame.board.size,
                        stones: []
                    },
                    currentTurn: 'black',
                    status: 'playing', // Start as playing since we have 2 players
                    history: [],
                    capturedStones: { capturedByBlack: 0, capturedByWhite: 0 },
                    komi: originalGame.komi,
                    scoringRule: originalGame.scoringRule,
                    gameType: originalGame.gameType,
                    handicap: originalGame.handicap || 0,
                    timeControl: originalGame.timeControl,
                    timePerMove: originalGame.timePerMove,
                    lastMoveTime: Date.now(),
                    createdAt: Date.now()
                };

                // Add handicap stones if it's a handicap game
                if (newGameState.gameType === 'handicap' && newGameState.handicap > 0) {
                    // Add handicap stones based on board size and handicap count
                    const handicapStones = getHandicapStones(newGameState.board.size, newGameState.handicap);
                    newGameState.board.stones = handicapStones;
                    newGameState.currentTurn = 'white'; // White plays first in handicap games
                }

                // Store the new game
                gameManager.createGame(newGameState);

                // Move both players to the new game room and update socketToGame mapping
                const gameRoom = io.sockets.adapter.rooms.get(gameId);
                if (gameRoom) {
                    gameRoom.forEach(socketId => {
                        const socket = io.sockets.sockets.get(socketId);
                        if (socket) {
                            socket.leave(gameId);
                            socket.join(newGameId);
                            gameManager.addPlayerToGame(socketId, newGameId);
                        }
                    });
                }

                log(`Created new game ${newGameId} (${newGameCode}) for play again request`);

                // Broadcast the new game to both players with a slight delay to ensure socket rooms are updated
                setTimeout(() => {
                    io.to(newGameId).emit('playAgainResponse', {
                        accepted: true,
                        gameId: newGameId,
                        newGameState: newGameState
                    });

                    // Also emit the game state
                    broadcastGameUpdate(io, gameManager, newGameId, newGameState);
                }, 100);

            } else {
                // Request was declined
                io.to(gameId).emit('playAgainResponse', {
                    accepted: false,
                    gameId: gameId
                });
                log(`Play again request declined in game ${gameId}`);
            }
        } else {
            log(`Play again response failed: Game ${gameId} not found`);
            socket.emit('error', `Game ${gameId} not found`);
        }
    };

    return {
        handleCreateGame,
        handleJoinGame,
        handlePlayAgainRequest,
        handlePlayAgainResponse
    };
};
