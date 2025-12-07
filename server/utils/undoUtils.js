const { log } = require('./logger');
const { getHandicapStones, captureDeadStones } = require('./gameLogic');
const { broadcastGameUpdate } = require('./socketUtils');

function processUndo(io, gameManager, gameState, moveIndex, gameId) {
    // Revert to the requested move index (keep all moves up to but not including moveIndex)
    const historyToKeep = gameState.history.slice(0, moveIndex);

    log(`Undo accepted: Keeping ${historyToKeep.length} moves out of ${gameState.history.length} total moves`);

    // Reset board state and replay from the beginning
    let stones = [];
    let currentTurn = 'black'; // Black always starts first
    let capturedStones = { capturedByBlack: 0, capturedByWhite: 0 };

    // ONLY add handicap stones if this is actually a handicap game AND we're going back to the beginning
    if (gameState.gameType === 'handicap' && gameState.handicap > 0 && historyToKeep.length === 0) {
        // Find handicap stones from the original board setup
        const handicapStones = getHandicapStones(gameState.board.size, gameState.handicap);
        stones = handicapStones;
        currentTurn = 'white'; // White plays first in handicap games
        log(`Added ${handicapStones.length} handicap stones for handicap game`);
    }

    // Replay each move in the history with proper capture logic
    historyToKeep.forEach((move, index) => {
        if (!move.pass) {
            // Extract position from move - handle both formats safely
            let position;
            if (move.position && typeof move.position === 'object' && typeof move.position.x === 'number' && typeof move.position.y === 'number') {
                // Server format: { position: { x, y }, ... }
                position = move.position;
            } else if (typeof move === 'object' && typeof move.x === 'number' && typeof move.y === 'number') {
                // Client format: { x, y }
                position = move;
            } else {
                log(`ERROR: Invalid move format during undo replay at index ${index}:`, move);
                return; // Skip this invalid move
            }

            // Validate position is within bounds
            if (position.x < 0 || position.x >= gameState.board.size || position.y < 0 || position.y >= gameState.board.size) {
                log(`ERROR: Invalid position during undo replay at index ${index}: (${position.x}, ${position.y})`);
                return; // Skip this invalid move
            }

            // Add the stone
            const newStone = {
                position: position,
                color: currentTurn
            };
            stones.push(newStone);

            // Apply capture logic (simplified version)
            const updatedStones = [...stones];
            const captureResult = captureDeadStones(
                { ...gameState, board: { ...gameState.board, stones: updatedStones } },
                updatedStones,
                newStone.position,
                currentTurn
            );

            stones = captureResult.remainingStones;

            // Update captured count
            // When black captures, increment capturedByBlack (white stones captured)
            // When white captures, increment capturedByWhite (black stones captured)
            if (currentTurn === 'black') {
                capturedStones.capturedByBlack += captureResult.capturedCount;
            } else {
                capturedStones.capturedByWhite += captureResult.capturedCount;
            }

            log(`Replayed move ${index + 1}: ${currentTurn} at (${newStone.position.x}, ${newStone.position.y}), captured ${captureResult.capturedCount} stones`);
        }

        // Toggle turn for next move
        currentTurn = currentTurn === 'black' ? 'white' : 'black';
    });

    // Calculate the current turn after undo
    let nextTurn;
    if (gameState.gameType === 'handicap' && gameState.handicap > 0) {
        // In handicap games, white starts first, so:
        // historyToKeep.length = 0 -> white's turn
        // historyToKeep.length = 1 -> black's turn  
        // historyToKeep.length = 2 -> white's turn
        nextTurn = historyToKeep.length % 2 === 0 ? 'white' : 'black';
    } else {
        // In normal games, black starts first, so:
        // historyToKeep.length = 0 -> black's turn
        // historyToKeep.length = 1 -> white's turn
        // historyToKeep.length = 2 -> black's turn
        nextTurn = historyToKeep.length % 2 === 0 ? 'black' : 'white';
    }

    // Update game state
    gameState.board.stones = stones;
    gameState.currentTurn = nextTurn;
    gameState.history = historyToKeep;
    gameState.capturedStones = capturedStones;

    // Clear KO position since board state changed
    gameState.koPosition = undefined;

    // Clear the undo request (in case it was set)
    gameState.undoRequest = undefined;

    // Mark AI undo as used if this is an AI game
    const isAIGame = gameState.players.some(player => player.isAI);
    if (isAIGame) {
        gameState.aiUndoUsed = true;
        log(`AI undo used - no more undos allowed in this AI game`);
    }

    // Store updated game state
    gameManager.updateGame(gameId, gameState);

    // Use the new broadcast function for move updates
    broadcastGameUpdate(io, gameManager, gameId, gameState);

    log(`Undo completed: Board has ${stones.length} stones, next turn: ${nextTurn}`);
}

module.exports = { processUndo };
