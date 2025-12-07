const { log } = require('../utils/logger');
const { handlePlayerTimeout } = require('../utils/timeControlUtils');

class TimerManager {
    constructor(io, gameManager) {
        this.io = io;
        this.gameManager = gameManager;
        this.intervalId = null;
    }

    start() {
        if (this.intervalId) return;

        // Add server-driven timer updates for active games
        this.intervalId = setInterval(() => {
            // Send timer updates for all active games every 1000ms
            const activeGames = this.gameManager.getAllActiveGames();

            activeGames.forEach((gameState, gameId) => {
                if (gameState.status === 'playing' && (gameState.timeControl || gameState.gameType === 'blitz')) {
                    const currentPlayer = gameState.players.find(p => p.color === gameState.currentTurn);

                    if (currentPlayer && gameState.lastMoveTime) {
                        const now = Date.now();
                        const elapsedMs = now - gameState.lastMoveTime;
                        const elapsedSeconds = Math.floor(elapsedMs / 1000);

                        if (gameState.gameType === 'blitz') {
                            // For blitz games, decrease timeRemaining each second
                            if (elapsedSeconds > 0) {
                                const newTimeRemaining = Math.max(0, gameState.timePerMove - elapsedSeconds);
                                currentPlayer.timeRemaining = newTimeRemaining;

                                // Send time update to all players
                                this.io.to(gameId).emit('timeUpdate', {
                                    gameId,
                                    playerId: currentPlayer.id,
                                    color: currentPlayer.color,
                                    timeRemaining: newTimeRemaining,
                                    serverTimestamp: now,
                                    lastMoveTime: gameState.lastMoveTime
                                });

                                // Check for blitz timeout
                                if (newTimeRemaining <= 0) {
                                    log(`💀 SERVER BLITZ TIMEOUT DETECTED - Player ${currentPlayer.color} ran out of time (${gameState.timePerMove}s per move)`);
                                    handlePlayerTimeout(this.io, this.gameManager, gameState, currentPlayer);
                                }
                            }
                        } else {
                            // Handle standard games with proper countdown calculation
                            let calculatedTimeRemaining = currentPlayer.timeRemaining || 0;
                            let calculatedIsInByoYomi = currentPlayer.isInByoYomi || false;
                            let calculatedByoYomiPeriods = currentPlayer.byoYomiPeriodsLeft || 0;
                            let calculatedByoYomiTime = currentPlayer.byoYomiTimeLeft || 0;

                            // Calculate real-time countdown based on elapsed time
                            if (calculatedIsInByoYomi && gameState.timeControl && gameState.timeControl.byoYomiPeriods > 0) {
                                // Player is in byo-yomi mode - calculate remaining time in current period
                                calculatedByoYomiTime = Math.max(0, (currentPlayer.byoYomiTimeLeft || 0) - elapsedSeconds);

                                // If current period expired, auto-consume periods
                                if (calculatedByoYomiTime <= 0 && calculatedByoYomiPeriods > 1) {
                                    const periodsToUse = Math.floor(Math.abs(calculatedByoYomiTime) / gameState.timeControl.byoYomiTime) + 1;
                                    calculatedByoYomiPeriods = Math.max(0, calculatedByoYomiPeriods - periodsToUse);

                                    if (calculatedByoYomiPeriods > 0) {
                                        calculatedByoYomiTime = gameState.timeControl.byoYomiTime;

                                        // Update the stored player state when auto-consuming periods
                                        if (calculatedByoYomiPeriods !== currentPlayer.byoYomiPeriodsLeft) {
                                            log(`🔥 SERVER AUTO-CONSUMING BYO-YOMI PERIOD: Player ${currentPlayer.color} period expired, consumed ${periodsToUse} periods, ${calculatedByoYomiPeriods} periods remaining`);

                                            // Update stored state
                                            currentPlayer.byoYomiPeriodsLeft = calculatedByoYomiPeriods;
                                            currentPlayer.byoYomiTimeLeft = gameState.timeControl.byoYomiTime;
                                            gameState.lastMoveTime = now; // Reset timer reference

                                            // Emit byo-yomi reset event
                                            this.io.to(gameId).emit('byoYomiReset', {
                                                gameId,
                                                color: currentPlayer.color,
                                                byoYomiTimeLeft: currentPlayer.byoYomiTimeLeft,
                                                byoYomiPeriodsLeft: currentPlayer.byoYomiPeriodsLeft
                                            });
                                        }
                                    } else {
                                        calculatedByoYomiTime = 0;
                                        calculatedByoYomiPeriods = 0;
                                    }
                                } else if (calculatedByoYomiTime <= 0 && calculatedByoYomiPeriods <= 1) {
                                    calculatedByoYomiTime = 0;
                                    calculatedByoYomiPeriods = 0;
                                }
                            } else if (!calculatedIsInByoYomi) {
                                // Player is in main time - calculate remaining main time
                                calculatedTimeRemaining = Math.max(0, (currentPlayer.timeRemaining || 0) - elapsedSeconds);

                                // Check if should enter byo-yomi
                                if (calculatedTimeRemaining <= 0 && gameState.timeControl && gameState.timeControl.byoYomiPeriods > 0) {
                                    // Auto-enter byo-yomi mode
                                    const timeOverage = elapsedSeconds - (currentPlayer.timeRemaining || 0);
                                    const periodsConsumed = Math.floor(timeOverage / gameState.timeControl.byoYomiTime);
                                    const remainingPeriods = Math.max(0, gameState.timeControl.byoYomiPeriods - periodsConsumed);

                                    if (remainingPeriods > 0) {
                                        log(`🚨 SERVER AUTO-ENTERING BYO-YOMI: Player ${currentPlayer.color} main time expired, ${timeOverage}s overage, ${remainingPeriods} periods remaining`);

                                        // Update stored state to byo-yomi
                                        currentPlayer.timeRemaining = 0;
                                        currentPlayer.isInByoYomi = true;
                                        currentPlayer.byoYomiPeriodsLeft = remainingPeriods;
                                        currentPlayer.byoYomiTimeLeft = gameState.timeControl.byoYomiTime;
                                        gameState.lastMoveTime = now; // Reset timer reference

                                        // Update calculated values
                                        calculatedTimeRemaining = 0;
                                        calculatedIsInByoYomi = true;
                                        calculatedByoYomiPeriods = remainingPeriods;
                                        calculatedByoYomiTime = gameState.timeControl.byoYomiTime;

                                        // Emit byo-yomi reset event
                                        this.io.to(gameId).emit('byoYomiReset', {
                                            gameId,
                                            color: currentPlayer.color,
                                            byoYomiTimeLeft: currentPlayer.byoYomiTimeLeft,
                                            byoYomiPeriodsLeft: currentPlayer.byoYomiPeriodsLeft
                                        });
                                    } else {
                                        calculatedTimeRemaining = 0;
                                    }
                                }
                            }

                            // Send real-time calculated time updates
                            this.io.to(gameId).emit('timeUpdate', {
                                gameId,
                                playerId: currentPlayer.id,
                                color: currentPlayer.color,
                                timeRemaining: calculatedTimeRemaining,
                                byoYomiPeriodsLeft: calculatedByoYomiPeriods,
                                byoYomiTimeLeft: calculatedByoYomiTime,
                                isInByoYomi: calculatedIsInByoYomi,
                                serverTimestamp: now,
                                lastMoveTime: gameState.lastMoveTime
                            });

                            // Check for standard timeout
                            // Only timeout if main time was originally > 0 (not unlimited time)
                            const isUnlimitedTime = (gameState.timeControl?.timeControl || 0) === 0;

                            if (calculatedIsInByoYomi && calculatedByoYomiPeriods <= 0 && calculatedByoYomiTime <= 0) {
                                log(`💀 SERVER STANDARD TIMEOUT DETECTED - Player ${currentPlayer.color} ran out of byo-yomi time`);
                                handlePlayerTimeout(this.io, this.gameManager, gameState, currentPlayer);
                            } else if (!calculatedIsInByoYomi && calculatedTimeRemaining <= 0 && (gameState.timeControl?.byoYomiPeriods || 0) === 0 && !isUnlimitedTime) {
                                log(`💀 SERVER STANDARD TIMEOUT DETECTED - Player ${currentPlayer.color} ran out of main time with no byo-yomi`);
                                handlePlayerTimeout(this.io, this.gameManager, gameState, currentPlayer);
                            }
                        }
                    }
                }
            });
        }, 1000); // Update every second for better precision
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

module.exports = TimerManager;
