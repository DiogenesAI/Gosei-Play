const { log } = require('../utils/logger');
const { handlePlayerTimeout } = require('../utils/timeControlUtils');
const { broadcastGameUpdate } = require('../utils/socketUtils');

module.exports = (io, socket, gameManager) => {
    const handleTimerTick = ({ gameId }) => {
        const gameState = gameManager.getGame(gameId);

        if (gameState && gameState.status === 'playing') {
            const now = Date.now();

            // Send server timestamp with every update for synchronization
            const serverTimestamp = now;

            // Update time for current player if there's active timing
            const currentPlayer = gameState.players.find(p => p.color === gameState.currentTurn);

            if (currentPlayer && gameState.lastMoveTime) {
                const elapsedTime = Math.floor((now - gameState.lastMoveTime) / 1000);

                // Calculate accurate current time state without modifying stored values
                let currentTimeRemaining = currentPlayer.timeRemaining;
                let currentByoYomiTime = currentPlayer.byoYomiTimeLeft;
                let currentByoYomiPeriods = currentPlayer.byoYomiPeriodsLeft;
                let currentIsInByoYomi = currentPlayer.isInByoYomi;

                if (currentPlayer.isInByoYomi && gameState.timeControl.byoYomiPeriods > 0) {
                    currentByoYomiTime = Math.max(0, currentPlayer.byoYomiTimeLeft - elapsedTime);

                    // Debug log for byo-yomi countdown
                    if (elapsedTime > 0) {
                        log(`⏱️  BYO-YOMI COUNTDOWN - Player ${currentPlayer.color}: ${currentPlayer.byoYomiTimeLeft}s - ${elapsedTime}s elapsed = ${currentByoYomiTime}s remaining`);
                    }

                    if (currentByoYomiTime <= 0 && currentByoYomiPeriods > 1) {
                        const periodsToUse = Math.floor(Math.abs(currentByoYomiTime) / gameState.timeControl.byoYomiTime) + 1;
                        currentByoYomiPeriods = Math.max(0, currentByoYomiPeriods - periodsToUse);
                        currentByoYomiTime = gameState.timeControl.byoYomiTime;

                        // CRITICAL: Auto-consume period when byo-yomi period expires
                        if (currentByoYomiPeriods !== currentPlayer.byoYomiPeriodsLeft) {
                            log(`🔥 AUTO-CONSUMING BYO-YOMI PERIOD: Player ${currentPlayer.color} period expired, consumed ${periodsToUse} periods, ${currentByoYomiPeriods} periods remaining`);

                            // Update the stored player state
                            currentPlayer.byoYomiPeriodsLeft = currentByoYomiPeriods;
                            currentPlayer.byoYomiTimeLeft = gameState.timeControl.byoYomiTime;

                            // Reset the timer reference to current time for accurate countdown
                            gameState.lastMoveTime = now;

                            // Emit byo-yomi reset event for period consumption
                            io.to(gameId).emit('byoYomiReset', {
                                gameId,
                                color: currentPlayer.color,
                                byoYomiTimeLeft: currentPlayer.byoYomiTimeLeft,
                                byoYomiPeriodsLeft: currentPlayer.byoYomiPeriodsLeft
                            });
                            log(`📤 AUTO PERIOD CONSUMED EVENT SENT - Player ${currentPlayer.color}: ${currentPlayer.byoYomiTimeLeft}s, Periods=${currentPlayer.byoYomiPeriodsLeft}`);

                            // Update calculated values to match stored state
                            currentByoYomiTime = currentPlayer.byoYomiTimeLeft;
                            currentByoYomiPeriods = currentPlayer.byoYomiPeriodsLeft;
                        }
                    } else if (currentByoYomiTime <= 0 && currentByoYomiPeriods <= 1) {
                        currentByoYomiTime = 0;
                        currentByoYomiPeriods = 0;
                    }
                } else {
                    currentTimeRemaining = Math.max(0, currentPlayer.timeRemaining - elapsedTime);

                    // Debug log for main time countdown
                    if (elapsedTime > 0 && !currentPlayer.isInByoYomi) {
                        log(`⏰ MAIN TIME COUNTDOWN - Player ${currentPlayer.color}: ${currentPlayer.timeRemaining}s - ${elapsedTime}s elapsed = ${currentTimeRemaining}s remaining`);
                    }

                    // Check if should enter byo-yomi when main time expires
                    if (currentTimeRemaining <= 0 && gameState.timeControl && gameState.timeControl.byoYomiPeriods > 0) {
                        // Auto-enter byo-yomi mode
                        const timeOverage = elapsedTime - currentPlayer.timeRemaining;
                        const periodsConsumed = Math.floor(timeOverage / gameState.timeControl.byoYomiTime);
                        const remainingPeriods = Math.max(0, gameState.timeControl.byoYomiPeriods - periodsConsumed);

                        if (remainingPeriods > 0) {
                            log(`🚨 TIMER-TICK AUTO-ENTERING BYO-YOMI: Player ${currentPlayer.color} main time expired, ${timeOverage}s overage, ${remainingPeriods} periods remaining`);

                            // Update stored state to byo-yomi
                            currentPlayer.timeRemaining = 0;
                            currentPlayer.isInByoYomi = true;
                            currentPlayer.byoYomiPeriodsLeft = remainingPeriods;
                            currentPlayer.byoYomiTimeLeft = gameState.timeControl.byoYomiTime;
                            gameState.lastMoveTime = now; // Reset timer reference

                            // Update calculated values
                            currentTimeRemaining = 0;
                            currentIsInByoYomi = true;
                            currentByoYomiPeriods = remainingPeriods;
                            currentByoYomiTime = gameState.timeControl.byoYomiTime;

                            // Emit byo-yomi reset event
                            io.to(gameId).emit('byoYomiReset', {
                                gameId,
                                color: currentPlayer.color,
                                byoYomiTimeLeft: currentPlayer.byoYomiTimeLeft,
                                byoYomiPeriodsLeft: currentPlayer.byoYomiPeriodsLeft
                            });
                        } else {
                            currentTimeRemaining = 0;
                        }
                    }

                    // Check for timeout conditions based on game type
                    if (gameState.gameType === 'blitz') {
                        // Blitz game timeout: check if player exceeded time per move
                        if (currentTimeRemaining <= 0) {
                            log(`💀 BLITZ TIMEOUT DETECTED - Player ${currentPlayer.color} ran out of time (${gameState.timePerMove}s per move)`);
                            handlePlayerTimeout(io, gameManager, gameState, currentPlayer);
                            return;
                        }
                    } else {
                        // Standard game timeout: check byo-yomi and main time
                        // Only timeout if main time was originally > 0 (not unlimited time)
                        const isUnlimitedTime = (gameState.timeControl?.timeControl || 0) === 0;

                        if (currentIsInByoYomi && currentByoYomiPeriods <= 0 && currentByoYomiTime <= 0) {
                            log(`💀 STANDARD TIMEOUT DETECTED - Player ${currentPlayer.color} ran out of byo-yomi time`);
                            handlePlayerTimeout(io, gameManager, gameState, currentPlayer);
                            return;
                        } else if (!currentIsInByoYomi && currentTimeRemaining <= 0 && (gameState.timeControl?.byoYomiPeriods || 0) === 0 && !isUnlimitedTime) {
                            log(`💀 STANDARD TIMEOUT DETECTED - Player ${currentPlayer.color} ran out of main time with no byo-yomi`);
                            handlePlayerTimeout(io, gameManager, gameState, currentPlayer);
                            return;
                        }
                    }
                }

                // Send real-time time updates with server timestamp for all players
                gameState.players.forEach(player => {
                    const isCurrentTurn = player.color === gameState.currentTurn;

                    io.to(gameId).emit('timeUpdate', {
                        gameId,
                        playerId: player.id,
                        color: player.color,
                        timeRemaining: isCurrentTurn ? currentTimeRemaining : player.timeRemaining,
                        byoYomiPeriodsLeft: isCurrentTurn ? currentByoYomiPeriods : player.byoYomiPeriodsLeft,
                        byoYomiTimeLeft: isCurrentTurn ? currentByoYomiTime : player.byoYomiTimeLeft,
                        isInByoYomi: isCurrentTurn ? currentIsInByoYomi : player.isInByoYomi,
                        serverTimestamp: serverTimestamp,
                        lastMoveTime: gameState.lastMoveTime
                    });
                });

                // Reduced sync interval for better responsiveness
                const lastSync = gameState.lastFullStateSync || 0;
                if (now - lastSync >= 2000) { // Sync every 2 seconds instead of 5
                    gameState.lastFullStateSync = now;
                    broadcastGameUpdate(io, gameManager, gameId, gameState);
                }
            } else {
                // No active timing, just send current state with timestamp
                gameState.players.forEach(player => {
                    io.to(gameId).emit('timeUpdate', {
                        gameId,
                        playerId: player.id,
                        color: player.color,
                        timeRemaining: player.timeRemaining,
                        byoYomiPeriodsLeft: player.byoYomiPeriodsLeft,
                        byoYomiTimeLeft: player.byoYomiTimeLeft,
                        isInByoYomi: player.isInByoYomi,
                        serverTimestamp: serverTimestamp,
                        lastMoveTime: gameState.lastMoveTime
                    });
                });
            }
        }
    };

    return { handleTimerTick };
};
