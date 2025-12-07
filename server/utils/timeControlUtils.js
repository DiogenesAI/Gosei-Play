const { log } = require('./logger');
const { broadcastGameUpdate } = require('./socketUtils');

function handlePlayerTimeout(io, gameManager, gameState, player) {
    gameState.status = 'finished';
    const winner = player.color === 'black' ? 'white' : 'black';
    gameState.winner = winner;

    // Set the game result with timeout notation
    const result = winner === 'black' ? 'B+T' : 'W+T';
    gameState.result = result;

    // Create timeout message based on game type
    const timeoutMessage = player.color === 'black'
        ? 'Black ran out of time - White wins (W+T)'
        : 'White ran out of time - Black wins (B+T)';

    // Add details about the time control based on game type
    let timeoutDetails;
    if (gameState.gameType === 'blitz') {
        timeoutDetails = `${player.color} exceeded time limit of ${gameState.timePerMove} seconds per move in Blitz game`;
    } else if (player.isInByoYomi) {
        timeoutDetails = `${player.color} used all ${gameState.timeControl.byoYomiPeriods} byo-yomi periods`;
    } else {
        timeoutDetails = `${player.color} exceeded main time limit of ${gameState.timeControl.timeControl} minutes`;
    }

    log(`Game ${gameState.id}: ${timeoutMessage} - ${timeoutDetails}`);

    // Broadcast timeout and game end with detailed information
    io.to(gameState.id).emit('playerTimeout', {
        gameId: gameState.id,
        playerId: player.id,
        color: player.color,
        winner: winner,
        result: result,
        message: timeoutMessage,
        details: timeoutDetails,
        isInByoYomi: player.isInByoYomi
    });

    // Add a chat message about the timeout
    io.to(gameState.id).emit('chatMessage', {
        id: Date.now().toString(),
        playerId: 'system',
        username: 'System',
        message: `${timeoutMessage}. ${timeoutDetails}.`,
        timestamp: Date.now(),
        isSystem: true
    });

    broadcastGameUpdate(io, gameManager, gameState.id, gameState);
}

module.exports = { handlePlayerTimeout };
