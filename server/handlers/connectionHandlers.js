const { log } = require('../utils/logger');
const { broadcastGameUpdate } = require('../utils/socketUtils');

module.exports = (io, socket, gameManager, aiGameManager) => {
    const handleDisconnect = () => {
        log(`Client disconnected: ${socket.id}`);

        // Check if this socket was in a game
        const gameId = gameManager.getGameIdBySocketId(socket.id);
        if (gameId) {
            socket.to(gameId).emit('playerDisconnected', {
                gameId,
                socketId: socket.id
            });

            // Clean up
            gameManager.removePlayerFromGame(socket.id);

            // If no more clients in the game, remove it after a timeout
            setTimeout(() => {
                const room = io.sockets.adapter.rooms.get(gameId);
                if (!room || room.size === 0) {
                    log(`Removing inactive game ${gameId}`);
                    // Clean up AI game if needed
                    if (aiGameManager.getActiveAIGames().includes(gameId)) {
                        aiGameManager.cleanupGame(gameId);
                        log(`🧹 Cleaned up AI game ${gameId}`);
                    }
                    gameManager.removeGame(gameId);
                }
            }, 5 * 60 * 1000); // 5 minutes timeout
        }
    };

    const handleLeaveGame = ({ gameId, playerId }) => {
        log(`Player/Spectator ${playerId} leaving game ${gameId}`);

        // Get the game state to find player/spectator username
        const gameState = gameManager.getGame(gameId);
        let username = 'A player'; // Default fallback
        let isSpectator = false;

        if (gameState) {
            // Check if it's a player leaving
            const leavingPlayer = gameState.players.find(p => p.id === playerId);
            if (leavingPlayer && leavingPlayer.username) {
                username = leavingPlayer.username;
            } else {
                // Check if it's a spectator leaving
                const leavingSpectator = gameState.spectators?.find(s => s.id === playerId);
                if (leavingSpectator && leavingSpectator.username) {
                    username = leavingSpectator.username;
                    isSpectator = true;

                    // Remove spectator from the list
                    gameState.spectators = gameState.spectators.filter(s => s.id !== playerId);
                    gameManager.updateGame(gameId, gameState);

                    log(`Spectator ${username} removed from game ${gameId}`);
                }
            }
        }

        // Leave the socket room
        socket.leave(gameId);
        gameManager.removePlayerFromGame(socket.id);

        // Notify other players/spectators with username included
        if (isSpectator) {
            // Spectators leave silently - no notifications
            // But we still need to broadcast the updated game state so spectator count updates
            if (gameState) {
                broadcastGameUpdate(io, gameManager, gameId, gameState);
            }
        } else {
            socket.to(gameId).emit('playerLeft', {
                gameId,
                playerId,
                username
            });
        }

        // Check if there are any players left in the game room
        const room = io.sockets.adapter.rooms.get(gameId);
        const clientsCount = room ? room.size : 0;

        log(`Game ${gameId} has ${clientsCount} clients remaining after ${isSpectator ? 'spectator' : 'player'} left`);

        // If no players left in the room, remove the game immediately
        if (!room || clientsCount === 0) {
            log(`No players remaining in game ${gameId}, removing it immediately`);
            if (aiGameManager.getActiveAIGames().includes(gameId)) {
                aiGameManager.cleanupGame(gameId);
                log(`🧹 Cleaned up AI game ${gameId}`);
            }
            gameManager.removeGame(gameId);
        }
    };

    return {
        handleDisconnect,
        handleLeaveGame
    };
};
