const { log } = require('../utils/logger');
const { broadcastGameUpdate } = require('../utils/socketUtils');
const { autoConfirmAIScore } = require('../utils/aiLogic');
const { findStoneAt, getConnectedGroup } = require('../utils/gameLogic');
const { calculateScore } = require('../utils/scoringUtils');

module.exports = (io, socket, gameManager) => {
    const handleConfirmScore = ({ gameId, playerId, playerColor, confirmed }) => {
        log(`Player ${playerId} (${playerColor}) ${confirmed ? 'confirmed' : 'unconfirmed'} score for game ${gameId}`);

        const gameState = gameManager.getGame(gameId);
        if (gameState) {
            // Only allow confirmation in scoring mode
            if (gameState.status !== 'scoring') {
                log(`Cannot confirm score: game ${gameId} not in scoring mode`);
                socket.emit('error', 'Cannot confirm score: game not in scoring mode');
                return;
            }

            // Initialize score confirmation if it doesn't exist
            if (!gameState.scoreConfirmation) {
                gameState.scoreConfirmation = { black: false, white: false };
            }

            // Update the confirmation for this player
            gameState.scoreConfirmation[playerColor] = confirmed;

            log(`Score confirmations for game ${gameId}: Black: ${gameState.scoreConfirmation.black}, White: ${gameState.scoreConfirmation.white}`);

            // Store updated game state
            gameManager.updateGame(gameId, gameState);

            // Broadcast the confirmation update to all clients
            io.to(gameId).emit('scoreConfirmationUpdate', {
                gameId,
                playerId,
                playerColor,
                confirmed,
                scoreConfirmation: gameState.scoreConfirmation
            });

            // Check if both players have confirmed
            if (gameState.scoreConfirmation.black && gameState.scoreConfirmation.white) {
                log(`Both players confirmed score for game ${gameId}. Calculating final score...`);
                log(`Using scoring rule: ${gameState.scoringRule || 'japanese'} with komi: ${gameState.komi || 'default'}`);

                // Calculate final score server-side
                const scoreResult = calculateScore(gameState);

                log(`Score calculation complete. Black: ${scoreResult.black.total}, White: ${scoreResult.white.total}, Winner: ${scoreResult.winner}`);

                // Update game state
                gameState.status = 'finished';
                gameState.score = scoreResult;
                gameState.winner = scoreResult.winner;
                gameState.territory = scoreResult.territory;

                // Set result string (e.g., "B+1.5")
                const diff = scoreResult.diff;
                // Format diff to remove trailing zeros if integer
                const diffStr = Number.isInteger(diff) ? diff.toString() : diff.toFixed(1);
                gameState.result = `${scoreResult.winner === 'black' ? 'B' : 'W'}+${diffStr}`;

                gameManager.updateGame(gameId, gameState);

                log(`Game ${gameId} finished. Winner: ${gameState.winner}, Score: ${JSON.stringify(scoreResult)}`);

                // Broadcast game finished
                io.to(gameId).emit('gameFinished', {
                    gameId,
                    score: scoreResult,
                    winner: gameState.winner,
                    territory: gameState.territory,
                    result: gameState.result
                });
            }

            // Also broadcast the full game state
            io.to(gameId).emit('gameState', gameState);
            log(`Broadcasting updated game state to all clients in room ${gameId}`);
        }
    };

    // Deprecated: Client should not send gameEnded anymore, server calculates it
    const handleGameEnded = ({ gameId, score, winner, territory }) => {
        log(`⚠️ Deprecated handleGameEnded called for game ${gameId}. Ignoring client-provided score.`);
        // We do nothing here now, as the server handles scoring in handleConfirmScore
    };

    const handleCancelScoring = ({ gameId }) => {
        log(`Canceling scoring phase for game ${gameId}`);

        // Update the game state if it exists in memory
        const gameState = gameManager.getGame(gameId);
        if (gameState) {
            // Only allow cancellation if in scoring mode
            if (gameState.status !== 'scoring') {
                log(`Cannot cancel scoring: game ${gameId} not in scoring mode`);
                socket.emit('error', 'Cannot cancel scoring: game not in scoring mode');
                return;
            }

            // Return to playing state
            gameState.status = 'playing';
            gameState.deadStones = []; // Clear dead stones
            gameState.territory = undefined; // Clear territory visualization
            gameState.scoreConfirmation = { black: false, white: false }; // Reset score confirmations

            // Store updated game state
            gameManager.updateGame(gameId, gameState);

            // Use the new broadcast function for move updates
            broadcastGameUpdate(io, gameManager, gameId, gameState);

            // Broadcast the cancel to ALL clients in the room
            io.to(gameId).emit('scoringCanceled', {
                gameId
            });
            log(`Broadcasting scoring cancellation to all clients in room ${gameId}`);

            // Also broadcast the full game state
            io.to(gameId).emit('gameState', gameState);
            log(`Broadcasting updated game state to all clients in room ${gameId}`);
        }
    };

    const handleForceScoring = ({ gameId, playerId, playerColor, reason }) => {
        log(`🚨 FORCE SCORING: Player ${playerId} (${playerColor}) forcing scoring for game ${gameId} - Reason: ${reason}`);

        const gameState = gameManager.getGame(gameId);
        if (gameState) {
            // Validate this is an AI game
            const isAIGame = gameState.players.some(player => player.isAI);
            if (!isAIGame) {
                log(`Cannot force scoring: game ${gameId} is not an AI game`);
                socket.emit('error', 'Force scoring only available in AI games');
                return;
            }

            // Only allow if game is currently playing
            if (gameState.status !== 'playing') {
                log(`Cannot force scoring: game ${gameId} not in playing state (current: ${gameState.status})`);
                socket.emit('error', 'Cannot force scoring: game not in progress');
                return;
            }

            // Check if last move was a pass by the requesting player
            const lastMove = gameState.history[gameState.history.length - 1];
            if (!lastMove || !lastMove.pass || lastMove.color !== playerColor) {
                log(`Cannot force scoring: last move was not a pass by requesting player`);
                socket.emit('error', 'Force scoring only available after you pass');
                return;
            }

            // Add AI pass move to complete double pass requirement
            const aiPlayer = gameState.players.find(p => p.isAI && p.color === gameState.currentTurn);
            const aiPassMove = {
                pass: true,
                color: gameState.currentTurn,
                playerId: aiPlayer ? aiPlayer.id : `ai_${gameState.currentTurn}`,
                timestamp: Date.now(),
                timeSpentOnMove: 0,
                timeSpentDisplay: '0s',
                timeDisplay: 'Forced by human',
                isForced: true,
                reason: 'AI unresponsive'
            };

            // Update game state
            gameState.history.push(aiPassMove);
            gameState.status = 'scoring';
            gameState.deadStones = [];
            gameState.scoreConfirmation = { black: false, white: false };

            // Auto-confirm AI score immediately
            autoConfirmAIScore(gameState);

            log(`🎯 Game ${gameId} forced into scoring phase - AI move added automatically`);

            // Store updated game state
            gameManager.updateGame(gameId, gameState);

            // Broadcast the forced AI pass
            io.to(gameId).emit('moveMade', {
                pass: true,
                color: gameState.currentTurn,
                playerId: aiPassMove.playerId,
                isForced: true
            });

            // Broadcast the transition to scoring
            io.to(gameId).emit('scoringPhaseStarted', {
                gameId,
                reason: 'Forced due to unresponsive AI'
            });

            // Use the new broadcast function for move updates
            broadcastGameUpdate(io, gameManager, gameId, gameState);

            // Also broadcast the full game state
            io.to(gameId).emit('gameState', gameState);
            log(`Broadcasting forced scoring transition to all clients in room ${gameId}`);
        } else {
            log(`Game ${gameId} not found for force scoring request`);
            socket.emit('error', `Game ${gameId} not found`);
        }
    };

    const handleToggleDeadStone = ({ gameId, position, playerId }) => {
        log(`Player ${playerId} toggled dead stone at (${position.x}, ${position.y}) in game ${gameId}`);

        const gameState = gameManager.getGame(gameId);
        if (gameState) {
            // Only allow toggling in scoring mode
            if (gameState.status !== 'scoring') {
                log(`Cannot toggle dead stone: game ${gameId} not in scoring mode`);
                socket.emit('error', 'Cannot toggle dead stone: game not in scoring mode');
                return;
            }

            // Initialize deadStones array if it doesn't exist
            if (!gameState.deadStones) {
                gameState.deadStones = [];
            }

            // Find the stone at the clicked position
            const stoneAtPos = findStoneAt(position, gameState.board.stones);
            if (!stoneAtPos) {
                log(`No stone found at position (${position.x}, ${position.y})`);
                socket.emit('error', 'Cannot toggle dead stone: no stone at position');
                return;
            }

            // Get the connected group of stones
            const connectedGroup = getConnectedGroup(position, gameState.board.stones, gameState.board.size);

            // Count how many stones in the group are already marked as dead
            const alreadyMarkedCount = connectedGroup.filter(pos =>
                gameState.deadStones.some(dead => dead.x === pos.x && dead.y === pos.y)
            ).length;

            // If more than half are already marked, remove them all
            // Otherwise, add all stones in the group
            if (alreadyMarkedCount > connectedGroup.length / 2) {
                // Remove all stones in the group from dead stones
                gameState.deadStones = gameState.deadStones.filter(deadStone =>
                    !connectedGroup.some(groupPos => groupPos.x === deadStone.x && groupPos.y === deadStone.y)
                );
            } else {
                // Add all stones in the group to dead stones (avoiding duplicates)
                const newDeadStones = connectedGroup.filter(groupPos =>
                    !gameState.deadStones.some(deadStone => deadStone.x === groupPos.x && deadStone.y === groupPos.y)
                );

                gameState.deadStones = [...gameState.deadStones, ...newDeadStones];
            }

            // Update stored game state
            gameManager.updateGame(gameId, gameState);

            // Broadcast dead stone change to all clients
            io.to(gameId).emit('deadStoneToggled', {
                gameId,
                position,
                playerId,
                deadStones: gameState.deadStones
            });

            // Use the new broadcast function for move updates
            broadcastGameUpdate(io, gameManager, gameId, gameState);
        }
    };

    const handleSyncDeadStones = ({ gameId, playerId }) => {
        log(`Player ${playerId} requested dead stones sync for game ${gameId}`);

        const gameState = gameManager.getGame(gameId);
        if (gameState) {
            // Send current dead stones to the requesting client
            socket.emit('deadStonesSynced', {
                gameId,
                deadStones: gameState.deadStones || []
            });

            log(`Sent ${gameState.deadStones ? gameState.deadStones.length : 0} dead stones to player ${playerId}`);
        } else {
            log(`Game ${gameId} not found for dead stones sync request`);
            socket.emit('error', `Game ${gameId} not found`);
        }
    };

    return {
        handleConfirmScore,
        handleGameEnded,
        handleCancelScoring,
        handleForceScoring,
        handleToggleDeadStone,
        handleSyncDeadStones
    };
};
