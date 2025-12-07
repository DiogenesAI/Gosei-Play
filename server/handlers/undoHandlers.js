const { log } = require('../utils/logger');
const { processUndo } = require('../utils/undoUtils');
const { broadcastGameUpdate } = require('../utils/socketUtils');

module.exports = (io, socket, gameManager, aiGameManager) => {
    const handleRequestUndo = ({ gameId, playerId, moveIndex }) => {
        log(`Player ${playerId} requested undo to move ${moveIndex} in game ${gameId}`);

        const gameState = gameManager.getGame(gameId);
        if (gameState) {
            log(`Current game has ${gameState.history.length} moves, requesting to keep ${moveIndex} moves (removing ${gameState.history.length - moveIndex} moves)`);

            // Check if this is an AI game - if so, auto-accept the undo
            const isAIGame = gameState.players.some(player => player.isAI);
            const requestingPlayer = gameState.players.find(player => player.id === playerId);
            const isHumanRequestingUndo = requestingPlayer && !requestingPlayer.isAI;

            if (isAIGame && isHumanRequestingUndo) {
                log(`🤖 AI game detected - auto-accepting undo request from human player`);

                // Auto-process the undo immediately for AI games
                processUndo(io, gameManager, gameState, moveIndex, gameId);

                // Sync AI engine state after undo
                if (aiGameManager && aiGameManager.isAIGame(gameState)) {
                    setTimeout(async () => {
                        try {
                            await aiGameManager.syncGameState(gameState);
                            log(`🔄 AI engine synced after undo`);
                        } catch (error) {
                            log(`❌ Failed to sync AI engine after undo: ${error.message}`);
                        }
                    }, 100);
                }
            } else {
                // Regular human vs human game - add undo request to game state
                gameState.undoRequest = {
                    requestedBy: playerId,
                    moveIndex
                };

                // Store updated game state
                gameManager.updateGame(gameId, gameState);

                // Use the new broadcast function for move updates
                broadcastGameUpdate(io, gameManager, gameId, gameState);
            }
        }
    };

    const handleRespondToUndoRequest = ({ gameId, playerId, accepted, moveIndex }) => {
        log(`Player ${playerId} ${accepted ? 'accepted' : 'rejected'} undo request in game ${gameId}`);

        const gameState = gameManager.getGame(gameId);
        if (gameState) {
            if (accepted) {
                processUndo(io, gameManager, gameState, moveIndex, gameId);
            }

            // Clear the undo request
            gameState.undoRequest = undefined;

            // Store updated game state
            gameManager.updateGame(gameId, gameState);

            // Use the new broadcast function for move updates
            broadcastGameUpdate(io, gameManager, gameId, gameState);
        }
    };

    return {
        handleRequestUndo,
        handleRespondToUndoRequest
    };
};
