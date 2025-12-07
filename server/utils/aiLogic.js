const { log } = require('./logger');
const { formatTimeDisplay, formatMoveTimeDisplay } = require('./timeUtils');
const { captureDeadStones } = require('./gameLogic');
const { broadcastGameUpdate } = require('./socketUtils');
const { handlePlayerTimeout } = require('./timeControlUtils');

// Helper function to apply time logic for AI players
function applyAITimeLogic(gameState, aiPlayer, thinkingTimeSeconds, io, gameId, gameManager) {
    if (!aiPlayer || thinkingTimeSeconds <= 0) return;

    log(`🤖 TIME CALCULATION - AI ${aiPlayer.color}: Main=${aiPlayer.timeRemaining}s, InByoYomi=${aiPlayer.isInByoYomi}, Thinking=${thinkingTimeSeconds}s`);

    if (gameState.gameType === 'blitz') {
        // For blitz games, check if AI exceeded time per move
        if (thinkingTimeSeconds > gameState.timePerMove) {
            log(`💀 BLITZ TIMEOUT - AI ${aiPlayer.color} spent ${thinkingTimeSeconds}s, exceeded time limit of ${gameState.timePerMove}s per move`);
            handlePlayerTimeout(io, gameManager, gameState, aiPlayer);
            return false; // Indicate timeout
        } else {
            log(`⚡ BLITZ MOVE - AI ${aiPlayer.color} spent ${thinkingTimeSeconds}s (within ${gameState.timePerMove}s limit)`);
        }

        // Reset AI timer for next move (if it's AI vs AI)
        aiPlayer.timeRemaining = gameState.timePerMove;
        return true;
    } else {
        // Standard game time deduction logic
        let timerAlreadyReset = false;

        if (aiPlayer.isInByoYomi) {
            // AI is already in byo-yomi mode
            if (thinkingTimeSeconds <= gameState.timeControl.byoYomiTime) {
                // Move made within byo-yomi period - reset clock, keep same period count
                aiPlayer.byoYomiTimeLeft = gameState.timeControl.byoYomiTime;
                log(`🔄 AI BYO-YOMI RESET - AI ${aiPlayer.color} thought for ${thinkingTimeSeconds}s (within period), period reset to ${gameState.timeControl.byoYomiTime}s, periods remain: ${aiPlayer.byoYomiPeriodsLeft}`);

                // Emit byoYomiReset event
                io.to(gameId).emit('byoYomiReset', {
                    gameId,
                    color: aiPlayer.color,
                    byoYomiTimeLeft: aiPlayer.byoYomiTimeLeft,
                    byoYomiPeriodsLeft: aiPlayer.byoYomiPeriodsLeft
                });
                log(`📤 AI BYO-YOMI RESET EVENT SENT - AI ${aiPlayer.color}: ${aiPlayer.byoYomiTimeLeft}s, Periods=${aiPlayer.byoYomiPeriodsLeft}`);

                timerAlreadyReset = true;
            } else {
                // Move exceeded byo-yomi period - calculate periods consumed
                const periodsConsumed = Math.floor(thinkingTimeSeconds / gameState.timeControl.byoYomiTime);
                const newPeriodsLeft = Math.max(0, aiPlayer.byoYomiPeriodsLeft - periodsConsumed);

                if (newPeriodsLeft > 0) {
                    // Still have periods remaining
                    aiPlayer.byoYomiPeriodsLeft = newPeriodsLeft;
                    aiPlayer.byoYomiTimeLeft = gameState.timeControl.byoYomiTime;
                    log(`⏳ AI BYO-YOMI PERIODS CONSUMED - AI ${aiPlayer.color} thought for ${thinkingTimeSeconds}s, consumed ${periodsConsumed} periods, ${newPeriodsLeft} periods remaining`);

                    // Emit reset event when periods are consumed and reset
                    io.to(gameId).emit('byoYomiReset', {
                        gameId,
                        color: aiPlayer.color,
                        byoYomiTimeLeft: aiPlayer.byoYomiTimeLeft,
                        byoYomiPeriodsLeft: aiPlayer.byoYomiPeriodsLeft
                    });
                    log(`📤 AI BYO-YOMI PERIODS CONSUMED EVENT SENT - AI ${aiPlayer.color}: ${aiPlayer.byoYomiTimeLeft}s, Periods=${aiPlayer.byoYomiPeriodsLeft}`);

                    timerAlreadyReset = true;
                } else {
                    // No more periods - AI times out
                    log(`💀 TIMEOUT - AI ${aiPlayer.color} consumed all byo-yomi periods (thought for ${thinkingTimeSeconds}s, consumed ${periodsConsumed} periods)`);
                    handlePlayerTimeout(io, gameManager, gameState, aiPlayer);
                    return false; // Indicate timeout
                }
            }
        } else {
            // AI is in main time
            const newMainTime = Math.max(0, aiPlayer.timeRemaining - thinkingTimeSeconds);

            if (newMainTime > 0) {
                // Still in main time
                aiPlayer.timeRemaining = newMainTime;
                log(`⏰ AI TIME DEDUCTED - AI ${aiPlayer.color} spent ${thinkingTimeSeconds}s from main time, ${newMainTime}s remaining`);
            } else {
                // First time entering byo-yomi - calculate periods consumed
                if (gameState.timeControl && gameState.timeControl.byoYomiPeriods > 0) {
                    const timeOverage = thinkingTimeSeconds - aiPlayer.timeRemaining; // How much time exceeded main time
                    const periodsConsumed = Math.floor(timeOverage / gameState.timeControl.byoYomiTime);
                    const remainingPeriods = Math.max(0, gameState.timeControl.byoYomiPeriods - periodsConsumed);

                    if (remainingPeriods > 0) {
                        // Enter byo-yomi with calculated periods remaining
                        aiPlayer.timeRemaining = 0;
                        aiPlayer.isInByoYomi = true;
                        aiPlayer.byoYomiPeriodsLeft = remainingPeriods;
                        aiPlayer.byoYomiTimeLeft = gameState.timeControl.byoYomiTime;
                        log(`🚨 AI ENTERING BYO-YOMI: AI ${aiPlayer.color} thought for ${thinkingTimeSeconds}s (${timeOverage}s over main time), consumed ${periodsConsumed} periods, ${remainingPeriods} periods remaining`);

                        // Emit byo-yomi reset event for entering byo-yomi
                        io.to(gameId).emit('byoYomiReset', {
                            gameId,
                            color: aiPlayer.color,
                            byoYomiTimeLeft: aiPlayer.byoYomiTimeLeft,
                            byoYomiPeriodsLeft: aiPlayer.byoYomiPeriodsLeft
                        });
                        log(`📤 AI BYO-YOMI ENTERED EVENT SENT - AI ${aiPlayer.color}: ${aiPlayer.byoYomiTimeLeft}s, Periods=${aiPlayer.byoYomiPeriodsLeft}`);

                        timerAlreadyReset = true;
                    } else {
                        // No periods left - AI times out
                        log(`💀 TIMEOUT - AI ${aiPlayer.color} exceeded main time and consumed all byo-yomi periods (thought for ${thinkingTimeSeconds}s, overage ${timeOverage}s, consumed ${periodsConsumed} periods)`);
                        handlePlayerTimeout(io, gameManager, gameState, aiPlayer);
                        return false; // Indicate timeout
                    }
                } else {
                    // No byo-yomi available - check if unlimited time before timing out
                    const isUnlimitedTime = (gameState.timeControl?.timeControl || 0) === 0;
                    if (!isUnlimitedTime) {
                        log(`💀 TIMEOUT - AI ${aiPlayer.color} exceeded main time with no byo-yomi available (thought for ${thinkingTimeSeconds}s, main time was ${aiPlayer.timeRemaining}s)`);
                        handlePlayerTimeout(io, gameManager, gameState, aiPlayer);
                        return false; // Indicate timeout
                    } else {
                        log(`⏰ UNLIMITED TIME - AI ${aiPlayer.color} thinking time but no timeout (unlimited time mode)`);
                    }
                }
            }
        }

        return true; // No timeout
    }
}

// Helper function to auto-confirm AI score when entering scoring mode
function autoConfirmAIScore(gameState) {
    const isAIGame = gameState.players.some(player => player.isAI);
    if (!isAIGame || gameState.status !== 'scoring') {
        return false;
    }

    // Initialize score confirmation if it doesn't exist
    if (!gameState.scoreConfirmation) {
        gameState.scoreConfirmation = { black: false, white: false };
    }

    // Find the AI player and auto-confirm for them
    const aiPlayer = gameState.players.find(player => player.isAI);
    if (aiPlayer) {
        const aiPlayerColor = aiPlayer.color;
        gameState.scoreConfirmation[aiPlayerColor] = true;
        log(`🤖 AI (${aiPlayerColor}) automatically confirmed score when entering scoring mode`);
        return true;
    }

    return false;
}

async function makeAIMove(io, gameManager, aiGameManager, gameId) {
    try {
        const gameState = gameManager.getGame(gameId);
        if (!gameState) {
            log(`❌ Game ${gameId} not found for AI move`);
            return;
        }

        if (gameState.status !== 'playing') {
            log(`❌ Game ${gameId} not playing (status: ${gameState.status}), skipping AI move`);
            return;
        }

        if (!aiGameManager.shouldAIMakeMove(gameState)) {
            log(`❌ AI should not make move for game ${gameId}`);
            return;
        }

        const currentColor = gameState.currentTurn;
        log(`🤖 Making AI move for ${currentColor} in game ${gameId}`);

        const aiMoveResult = await aiGameManager.makeAIMove(gameState, currentColor);
        const aiPlayer = gameState.players.find(p => p.color === currentColor && p.isAI);

        if (!aiPlayer) {
            log(`❌ AI player not found for color ${currentColor}`);
            return;
        }

        // Apply time logic for AI move
        const thinkingTime = aiMoveResult.thinkingTime || 1;
        const timeoutOccurred = !applyAITimeLogic(gameState, aiPlayer, thinkingTime, io, gameId, gameManager);

        if (timeoutOccurred) {
            log(`💀 AI ${currentColor} timed out, game ended`);
            return;
        }

        if (aiMoveResult.type === 'pass') {
            // Handle AI pass
            log(`🤖 AI (${currentColor}) decided to pass`);

            // Add pass to history with proper time tracking
            gameState.history.push({
                pass: true,
                color: currentColor,
                playerId: aiMoveResult.playerId,
                timestamp: Date.now(),
                timeSpentOnMove: thinkingTime,
                timeSpentDisplay: formatMoveTimeDisplay(thinkingTime),
                timeDisplay: formatTimeDisplay(aiPlayer),
                timeRemaining: aiPlayer.timeRemaining,
                isInByoYomi: aiPlayer.isInByoYomi,
                byoYomiTimeLeft: aiPlayer.byoYomiTimeLeft,
                byoYomiPeriodsLeft: aiPlayer.byoYomiPeriodsLeft
            });

            // Switch turn
            gameState.currentTurn = currentColor === 'black' ? 'white' : 'black';

            // Check for double pass (game end)
            const historyLength = gameState.history.length;
            if (historyLength >= 2) {
                const lastMove = gameState.history[historyLength - 1];
                const secondLastMove = gameState.history[historyLength - 2];

                if (lastMove.pass && secondLastMove.pass) {
                    gameState.status = 'scoring';
                    gameState.deadStones = [];
                    gameState.scoreConfirmation = { black: false, white: false };

                    // Auto-confirm AI score immediately
                    autoConfirmAIScore(gameState);

                    log(`Game ${gameId} ended with double pass, entering scoring phase`);
                }
            }

            // Broadcast the pass
            io.to(gameId).emit('moveMade', {
                pass: true,
                color: currentColor,
                playerId: aiMoveResult.playerId
            });

        } else if (aiMoveResult.type === 'move') {
            // Handle AI move
            const { position } = aiMoveResult;
            log(`🤖 AI (${currentColor}) plays at (${position.x}, ${position.y})`);

            // Validate move
            const isOccupied = gameState.board.stones.some(
                stone => stone.position.x === position.x && stone.position.y === position.y
            );

            if (isOccupied) {
                log(`❌ AI generated invalid move - position occupied`);
                return;
            }

            // Check KO rule
            if (gameState.koPosition &&
                position.x === gameState.koPosition.x &&
                position.y === gameState.koPosition.y) {
                log(`❌ AI generated invalid move - KO violation`);
                return;
            }

            // Add the stone
            const updatedStones = [...gameState.board.stones, {
                position,
                color: currentColor
            }];

            // Capture opponent stones
            const capturedStones = captureDeadStones(gameState, updatedStones, position, currentColor);
            gameState.board.stones = capturedStones.remainingStones;

            // Track move
            gameState.lastMove = position;
            gameState.lastMoveColor = currentColor;
            gameState.lastMovePlayerId = aiMoveResult.playerId;
            gameState.lastMoveCapturedCount = capturedStones.capturedCount;

            // Add to history with proper time tracking
            gameState.history.push({
                position: position,
                color: currentColor,
                playerId: aiMoveResult.playerId,
                timestamp: Date.now(),
                timeSpentOnMove: thinkingTime,
                timeSpentDisplay: formatMoveTimeDisplay(thinkingTime),
                timeDisplay: formatTimeDisplay(aiPlayer),
                timeRemaining: aiPlayer.timeRemaining,
                isInByoYomi: aiPlayer.isInByoYomi,
                byoYomiTimeLeft: aiPlayer.byoYomiTimeLeft,
                byoYomiPeriodsLeft: aiPlayer.byoYomiPeriodsLeft,
                capturedCount: capturedStones.capturedCount
            });

            // Set KO position
            if (capturedStones.koPosition) {
                gameState.koPosition = capturedStones.koPosition;
            } else if (gameState.koPosition) {
                gameState.koPosition = undefined;
            }

            // Update captured stones count
            if (!gameState.capturedStones) {
                gameState.capturedStones = { capturedByBlack: 0, capturedByWhite: 0 };
            }
            if (capturedStones.capturedCount > 0) {
                // When black captures, increment capturedByBlack (white stones captured)
                // When white captures, increment capturedByWhite (black stones captured)
                if (currentColor === 'black') {
                    gameState.capturedStones.capturedByBlack += capturedStones.capturedCount;
                } else {
                    gameState.capturedStones.capturedByWhite += capturedStones.capturedCount;
                }
            }

            // Switch turn
            gameState.currentTurn = currentColor === 'black' ? 'white' : 'black';

            // Reset timer for next player's move (only for standard games, not blitz)
            if (gameState.gameType !== 'blitz') {
                gameState.lastMoveTime = Date.now();
            }
        }

        // Update stored game state
        gameManager.updateGame(gameId, gameState);

        // Send time update for AI player
        io.to(gameId).emit('timeUpdate', {
            gameId,
            playerId: aiPlayer.id,
            color: aiPlayer.color,
            timeRemaining: aiPlayer.timeRemaining,
            isInByoYomi: aiPlayer.isInByoYomi,
            byoYomiTimeLeft: aiPlayer.byoYomiTimeLeft,
            byoYomiPeriodsLeft: aiPlayer.byoYomiPeriodsLeft,
            serverTimestamp: Date.now()
        });
        log(`📤 AI TIME UPDATE SENT - AI ${aiPlayer.color}: Main=${aiPlayer.timeRemaining}s, InByoYomi=${aiPlayer.isInByoYomi}, ByoYomiLeft=${aiPlayer.byoYomiTimeLeft}s, Periods=${aiPlayer.byoYomiPeriodsLeft}`);

        // Broadcast updated game state
        broadcastGameUpdate(io, gameManager, gameId, gameState);

        log(`✅ AI move completed for game ${gameId}`);

    } catch (error) {
        log(`❌ Error making AI move for game ${gameId}: ${error.message}`);
        console.error(error);
    }
}

module.exports = {
    makeAIMove,
    autoConfirmAIScore
};
