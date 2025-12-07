const { log } = require('../utils/logger');
const { broadcastGameUpdate } = require('../utils/socketUtils');

module.exports = (io, socket, gameManager) => {
    const handleResignGame = ({ gameId, playerId, color }) => {
        log(`Player ${playerId} (${color}) resigned from game ${gameId}`);

        // Update the game state if it exists in memory
        const gameState = gameManager.getGame(gameId);
        if (gameState) {
            // Set game as finished with the opponent as winner
            gameState.status = 'finished';
            const winner = color === 'black' ? 'white' : 'black';
            gameState.winner = winner;

            // Set the game result with resignation notation
            const result = winner === 'black' ? 'B+R' : 'W+R';
            gameState.result = result;

            // Create resignation message
            const resignationMessage = color === 'black'
                ? 'Black resigned - White win (W+R)'
                : 'White resigned - Black win (B+R)';

            log(`Game ${gameState.id}: ${resignationMessage}`);

            // Store updated game state
            gameManager.updateGame(gameId, gameState);

            // Use the new broadcast function for move updates
            broadcastGameUpdate(io, gameManager, gameId, gameState);

            // Broadcast the resignation to ALL clients in the room
            io.to(gameId).emit('playerResigned', {
                gameId,
                playerId,
                color,
                winner: gameState.winner,
                result: result,
                message: resignationMessage
            });
            log(`Broadcasting resignation to all clients in room ${gameId}`);

            // Also broadcast the full game state
            io.to(gameId).emit('gameState', gameState);
            log(`Broadcasting updated game state to all clients in room ${gameId}`);
        }
    };

    const handleRequestSync = ({ gameId, playerId }) => {
        log(`Player ${playerId} requested sync for game ${gameId}`);

        const gameState = gameManager.getGame(gameId);
        if (gameState) {
            log(`Sending sync data for game ${gameId}`);
            socket.emit('syncGameState', gameState);

            // Also broadcast to all other clients to ensure everyone is in sync
            socket.to(gameId).emit('syncRequest', { gameId, playerId });
        } else {
            log(`Game ${gameId} not found for sync request`);
            socket.emit('error', `Game ${gameId} not found`);
        }
    };

    const handleGetGameState = ({ gameId }) => {
        log(`Request for game state of game ${gameId}`);

        const gameState = gameManager.getGame(gameId);
        if (gameState) {
            socket.emit('gameState', gameState);
        } else {
            socket.emit('error', `Game ${gameId} not found`);
        }
    };

    const handleGameStatusChanged = ({ gameId, status }) => {
        log(`Game ${gameId} status changed to ${status}`);

        const gameState = gameManager.getGame(gameId);
        if (gameState) {
            gameState.status = status;
            gameManager.updateGame(gameId, gameState);

            // Broadcast the status change to all clients
            io.to(gameId).emit('gameStatusChanged', {
                gameId,
                status
            });

            // Use the new broadcast function for move updates
            broadcastGameUpdate(io, gameManager, gameId, gameState);

            log(`Broadcasting status change to all clients in room ${gameId}`);
        } else {
            log(`Game ${gameId} not found for status change`);
            socket.emit('error', `Game ${gameId} not found`);
        }
    };

    return {
        handleResignGame,
        handleRequestSync,
        handleGetGameState,
        handleGameStatusChanged
    };
};
