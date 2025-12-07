const { log } = require('./logger');

function broadcastGameUpdate(io, gameManager, gameId, gameState) {
    // First send immediate move notification if there's a last move
    if (gameState.lastMove) {
        io.to(gameId).emit('moveMade', {
            position: gameState.lastMove,
            color: gameState.lastMoveColor,
            playerId: gameState.lastMovePlayerId,
            capturedCount: gameState.lastMoveCapturedCount || 0
        });
    }

    // Make sure the KO position is properly included if it exists
    if (gameState.koPosition) {
        log(`Broadcasting game update with KO position at (${gameState.koPosition.x}, ${gameState.koPosition.y})`);
    }

    // Then broadcast full state update
    io.to(gameId).emit('gameState', gameState);

    // Store the game state
    gameManager.updateGame(gameId, gameState);
}

module.exports = { broadcastGameUpdate };
