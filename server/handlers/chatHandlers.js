const { log } = require('../utils/logger');

module.exports = (io, socket, gameManager) => {
    const handleChatMessage = ({ gameId, playerId, username, message }) => {
        log(`Chat message from ${username} (${playerId}) in game ${gameId}: ${message}`);

        // Get the current game state
        const gameState = gameManager.getGame(gameId);

        if (gameState) {
            // Broadcast the message to all clients in the game room
            io.to(gameId).emit('chatMessage', {
                id: Date.now().toString(),
                playerId,
                username,
                message,
                timestamp: Date.now()
            });

            log(`Broadcasting chat message to all clients in room ${gameId}`);
        }
    };

    return {
        handleChatMessage
    };
};
