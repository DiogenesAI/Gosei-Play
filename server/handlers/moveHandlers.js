const { log } = require('../utils/logger');
const { calculateMoveTime, formatMoveTimeDisplay, formatTimeDisplay } = require('../utils/timeUtils');
const { captureDeadStones } = require('../utils/gameLogic');
const { handlePlayerTimeout } = require('../utils/timeControlUtils');
const { broadcastGameUpdate } = require('../utils/socketUtils');
const { makeAIMove, autoConfirmAIScore } = require('../utils/aiLogic');

module.exports = (io, socket, gameManager, aiGameManager) => {
    const handleMakeMove = ({ gameId, position, color, playerId }) => {
        const gameState = gameManager.getGame(gameId);
        if (gameState) {
            // For blitz games, start timer on first move if not already started
            if (gameState.gameType === 'blitz' && !gameState.lastMoveTime) {
                gameState.lastMoveTime = Date.now();
                log(`🏃 BLITZ TIMER STARTED - First move made, timer now active`);
            }

            // Enhanced move tracking with detailed timing information
            const movingPlayer = gameState.players.find(p => p.color === color);
            if (movingPlayer) {
                // Calculate actual time spent on this move
                const timeSpentOnMove = calculateMoveTime(gameState);
                const moveTimeDisplay = formatMoveTimeDisplay(timeSpentOnMove);

                log(`🎯 MOVE TRACKED - Player ${playerId} made move at (${position.x}, ${position.y}) in game ${gameId} - Time spent: ${moveTimeDisplay} (${movingPlayer.isInByoYomi ? 'Byo-yomi' : 'Main'})`);
                log(`🕐 MOVE TIMING - Player ${color}: Main=${movingPlayer.timeRemaining}s, InByoYomi=${movingPlayer.isInByoYomi}, ByoYomiLeft=${movingPlayer.byoYomiTimeLeft}s, Periods=${movingPlayer.byoYomiPeriodsLeft}`);
            } else {
                log(`Player ${playerId} made move at (${position.x}, ${position.y}) in game ${gameId}`);
            }
        } else {
            log(`Player ${playerId} made move at (${position.x}, ${position.y}) in game ${gameId}`);
        }

        if (gameState) {

            // Validate move - check if position is already occupied
            const isOccupied = gameState.board.stones.some(
                stone => stone.position.x === position.x && stone.position.y === position.y
            );

            if (isOccupied) {
                log(`Invalid move - position already occupied`);
                socket.emit('error', 'Invalid move - position already occupied');
                return;
            }

            // Check for KO rule violation
            if (gameState.koPosition &&
                position.x === gameState.koPosition.x &&
                position.y === gameState.koPosition.y) {
                log(`Invalid move - KO rule violation at (${position.x}, ${position.y})`);
                socket.emit('error', 'Invalid move - KO rule violation');
                return;
            }

            // Track last move for immediate updates
            gameState.lastMove = position;
            gameState.lastMoveColor = color;
            gameState.lastMovePlayerId = playerId;

            // Add the stone
            const updatedStones = [...gameState.board.stones, {
                position,
                color
            }];

            // Capture opponent stones
            // Capture opponent stones
            const capturedStones = captureDeadStones(gameState, updatedStones, position, color);

            if (capturedStones.isSuicide) {
                log(`Invalid move - Suicide rule violation at (${position.x}, ${position.y})`);
                socket.emit('error', 'Invalid move - Suicide rule violation');
                return;
            }

            gameState.lastMoveCapturedCount = capturedStones.capturedCount;

            // Update game state (but don't change turn yet if byo-yomi reset needed)
            gameState.board.stones = capturedStones.remainingStones;

            // Get moving player for history and time handling
            const movingPlayer = gameState.players.find(p => p.color === color);

            // Enhanced history tracking with timing information
            const timeSpentOnMove = calculateMoveTime(gameState);
            const moveHistoryEntry = {
                position: position,
                color: color,
                playerId: playerId,
                timestamp: Date.now(),
                timeSpentOnMove: timeSpentOnMove,
                timeSpentDisplay: formatMoveTimeDisplay(timeSpentOnMove),
                timeDisplay: movingPlayer ? formatTimeDisplay(movingPlayer) : 'Unknown',
                timeRemaining: movingPlayer ? movingPlayer.timeRemaining : 0,
                isInByoYomi: movingPlayer ? movingPlayer.isInByoYomi : false,
                byoYomiTimeLeft: movingPlayer ? movingPlayer.byoYomiTimeLeft : 0,
                byoYomiPeriodsLeft: movingPlayer ? movingPlayer.byoYomiPeriodsLeft : 0,
                capturedCount: capturedStones.capturedCount
            };

            gameState.history.push(moveHistoryEntry);

            // Set KO position if a single stone was captured
            // Clear existing KO position if we moved elsewhere
            if (capturedStones.koPosition) {
                gameState.koPosition = capturedStones.koPosition;
                log(`KO position updated to (${capturedStones.koPosition.x}, ${capturedStones.koPosition.y})`);
            } else if (gameState.koPosition) {
                log(`Clearing KO position as move was played elsewhere`);
                gameState.koPosition = undefined;
            }

            // Deduct time spent from player's remaining time
            if (movingPlayer && timeSpentOnMove > 0) {
                if (gameState.gameType === 'blitz') {
                    // For blitz games, check if player exceeded time per move
                    if (timeSpentOnMove > gameState.timePerMove) {
                        log(`💀 BLITZ TIMEOUT - Player ${movingPlayer.color} spent ${timeSpentOnMove}s, exceeded time limit of ${gameState.timePerMove}s per move`);
                        handlePlayerTimeout(io, gameManager, gameState, movingPlayer);
                        return; // Exit early, game is over
                    } else {
                        log(`⚡ BLITZ MOVE - Player ${movingPlayer.color} spent ${timeSpentOnMove}s (within ${gameState.timePerMove}s limit)`);
                    }

                    // Reset timer for next player to full timePerMove
                    const nextPlayer = gameState.players.find(p => p.color === (movingPlayer.color === 'black' ? 'white' : 'black'));
                    if (nextPlayer) {
                        nextPlayer.timeRemaining = gameState.timePerMove;
                        log(`⚡ BLITZ RESET - Next player ${nextPlayer.color} timer reset to ${gameState.timePerMove}s`);

                        // Send immediate time update for the next player
                        io.to(gameId).emit('timeUpdate', {
                            gameId,
                            playerId: nextPlayer.id,
                            color: nextPlayer.color,
                            timeRemaining: nextPlayer.timeRemaining,
                            serverTimestamp: Date.now()
                        });
                    }

                    // Reset timer for next move
                    gameState.lastMoveTime = Date.now();
                } else {
                    // Standard game time deduction logic (existing byo-yomi handling)
                    let timerAlreadyReset = false; // Flag to track if we reset the timer during byo-yomi processing

                    if (movingPlayer.isInByoYomi) {
                        // Player is already in byo-yomi mode (3.1 and 3.2)
                        if (timeSpentOnMove <= gameState.timeControl.byoYomiTime) {
                            // 3.1: Move made within byo-yomi period - reset clock, keep same period count
                            movingPlayer.byoYomiTimeLeft = gameState.timeControl.byoYomiTime;
                            log(`🔄 BYO-YOMI RESET - Player ${movingPlayer.color} made move in ${timeSpentOnMove}s (within period), period reset to ${gameState.timeControl.byoYomiTime}s, periods remain: ${movingPlayer.byoYomiPeriodsLeft}`);

                            // CRITICAL FIX: Emit byoYomiReset event IMMEDIATELY when reset happens
                            io.to(gameId).emit('byoYomiReset', {
                                gameId,
                                color: movingPlayer.color,
                                byoYomiTimeLeft: movingPlayer.byoYomiTimeLeft,
                                byoYomiPeriodsLeft: movingPlayer.byoYomiPeriodsLeft
                            });
                            log(`📤 BYO-YOMI RESET EVENT SENT - Player ${movingPlayer.color}: ${movingPlayer.byoYomiTimeLeft}s, Periods=${movingPlayer.byoYomiPeriodsLeft}`);

                            // CRITICAL: Reset the timer start time when byo-yomi resets
                            gameState.lastMoveTime = Date.now();
                            timerAlreadyReset = true;
                        } else {
                            // 3.2: Move exceeded byo-yomi period - calculate periods consumed
                            const periodsConsumed = Math.floor(timeSpentOnMove / gameState.timeControl.byoYomiTime);
                            const newPeriodsLeft = Math.max(0, movingPlayer.byoYomiPeriodsLeft - periodsConsumed);

                            if (newPeriodsLeft > 0) {
                                // Still have periods remaining
                                movingPlayer.byoYomiPeriodsLeft = newPeriodsLeft;
                                movingPlayer.byoYomiTimeLeft = gameState.timeControl.byoYomiTime;
                                log(`⏳ BYO-YOMI PERIODS CONSUMED - Player ${movingPlayer.color} spent ${timeSpentOnMove}s, consumed ${periodsConsumed} periods, ${newPeriodsLeft} periods remaining`);

                                // CRITICAL FIX: Also emit reset event when periods are consumed and reset
                                io.to(gameId).emit('byoYomiReset', {
                                    gameId,
                                    color: movingPlayer.color,
                                    byoYomiTimeLeft: movingPlayer.byoYomiTimeLeft,
                                    byoYomiPeriodsLeft: movingPlayer.byoYomiPeriodsLeft
                                });
                                log(`📤 BYO-YOMI PERIODS CONSUMED EVENT SENT - Player ${movingPlayer.color}: ${movingPlayer.byoYomiTimeLeft}s, Periods=${movingPlayer.byoYomiPeriodsLeft}`);

                                // CRITICAL: Reset the timer start time when periods are consumed and reset
                                gameState.lastMoveTime = Date.now();
                                timerAlreadyReset = true;
                            } else {
                                // No more periods - player times out
                                log(`💀 TIMEOUT - Player ${movingPlayer.color} consumed all byo-yomi periods (spent ${timeSpentOnMove}s, consumed ${periodsConsumed} periods)`);
                                handlePlayerTimeout(io, gameManager, gameState, movingPlayer);
                                return; // Exit early, game is over
                            }
                        }
                    } else {
                        // Player is in main time
                        const newMainTime = Math.max(0, movingPlayer.timeRemaining - timeSpentOnMove);

                        if (newMainTime > 0) {
                            // Still in main time
                            movingPlayer.timeRemaining = newMainTime;
                            log(`⏰ TIME DEDUCTED - Player ${movingPlayer.color} spent ${timeSpentOnMove}s from main time, ${newMainTime}s remaining`);
                        } else {
                            // 2: First time entering byo-yomi - calculate periods consumed
                            if (gameState.timeControl && gameState.timeControl.byoYomiPeriods > 0) {
                                const timeOverage = timeSpentOnMove - movingPlayer.timeRemaining; // How much time exceeded main time
                                const periodsConsumed = Math.floor(timeOverage / gameState.timeControl.byoYomiTime);
                                const remainingPeriods = Math.max(0, gameState.timeControl.byoYomiPeriods - periodsConsumed);

                                if (remainingPeriods > 0) {
                                    // Enter byo-yomi with calculated periods remaining
                                    movingPlayer.timeRemaining = 0;
                                    movingPlayer.isInByoYomi = true;
                                    movingPlayer.byoYomiPeriodsLeft = remainingPeriods;
                                    movingPlayer.byoYomiTimeLeft = gameState.timeControl.byoYomiTime;
                                    log(`🚨 ENTERING BYO-YOMI: Player ${movingPlayer.color} spent ${timeSpentOnMove}s (${timeOverage}s over main time), consumed ${periodsConsumed} periods, ${remainingPeriods} periods remaining`);

                                    // Emit byo-yomi reset event for entering byo-yomi
                                    io.to(gameId).emit('byoYomiReset', {
                                        gameId,
                                        color: movingPlayer.color,
                                        byoYomiTimeLeft: movingPlayer.byoYomiTimeLeft,
                                        byoYomiPeriodsLeft: movingPlayer.byoYomiPeriodsLeft
                                    });
                                    log(`📤 BYO-YOMI ENTERED EVENT SENT - Player ${movingPlayer.color}: ${movingPlayer.byoYomiTimeLeft}s, Periods=${movingPlayer.byoYomiPeriodsLeft}`);

                                    // CRITICAL: Reset the timer start time when entering byo-yomi
                                    gameState.lastMoveTime = Date.now();
                                    timerAlreadyReset = true;
                                } else {
                                    // No periods left - player times out
                                    log(`💀 TIMEOUT - Player ${movingPlayer.color} exceeded main time and consumed all byo-yomi periods (spent ${timeSpentOnMove}s, overage ${timeOverage}s, consumed ${periodsConsumed} periods)`);
                                    handlePlayerTimeout(io, gameManager, gameState, movingPlayer);
                                    return; // Exit early, game is over
                                }
                            } else {
                                // No byo-yomi available - check if unlimited time before timing out
                                const isUnlimitedTime = (gameState.timeControl?.timeControl || 0) === 0;
                                if (!isUnlimitedTime) {
                                    log(`💀 TIMEOUT - Player ${movingPlayer.color} exceeded main time with no byo-yomi available (spent ${timeSpentOnMove}s, main time was ${movingPlayer.timeRemaining}s)`);
                                    handlePlayerTimeout(io, gameManager, gameState, movingPlayer);
                                    return; // Exit early, game is over
                                } else {
                                    log(`⏰ UNLIMITED TIME - Player ${movingPlayer.color} spending time but no timeout (unlimited time mode)`);
                                }
                            }
                        }
                    }

                    // Reset timer for the next move (only if not already reset in byo-yomi logic above)
                    if (!timerAlreadyReset) {
                        gameState.lastMoveTime = Date.now();
                    }
                }
            } else {
                // No time spent, just reset the timer for next move
                gameState.lastMoveTime = Date.now();
            }

            // Send time update after deducting time spent
            if (movingPlayer) {
                // For blitz games, reset timer for the player who just made a move
                if (gameState.gameType === 'blitz' && gameState.timePerMove) {
                    movingPlayer.timeRemaining = gameState.timePerMove;
                    log(`Reset blitz timer for player ${movingPlayer.id} (${color}) to ${gameState.timePerMove} seconds`);
                }

                // Send time update to all clients for this player
                io.to(gameId).emit('timeUpdate', {
                    gameId,
                    playerId: movingPlayer.id,
                    color: movingPlayer.color,
                    timeRemaining: movingPlayer.timeRemaining,
                    byoYomiPeriodsLeft: movingPlayer.byoYomiPeriodsLeft,
                    byoYomiTimeLeft: movingPlayer.byoYomiTimeLeft,
                    isInByoYomi: movingPlayer.isInByoYomi
                });

                log(`📤 TIME UPDATE SENT - Player ${movingPlayer.color}: Main=${movingPlayer.timeRemaining}s, InByoYomi=${movingPlayer.isInByoYomi}, ByoYomiLeft=${movingPlayer.byoYomiTimeLeft}s, Periods=${movingPlayer.byoYomiPeriodsLeft}`);
            }

            // For blitz games, set the new player's timer
            if (gameState.gameType === 'blitz' && gameState.timePerMove) {
                const nextPlayer = gameState.players.find(p => p.color === gameState.currentTurn);
                if (nextPlayer) {
                    nextPlayer.timeRemaining = gameState.timePerMove;
                    log(`Set blitz timer for next player ${nextPlayer.id} (${nextPlayer.color}) to ${gameState.timePerMove} seconds`);

                    // Send immediate time update for the next player
                    io.to(gameId).emit('timeUpdate', {
                        gameId,
                        playerId: nextPlayer.id,
                        color: nextPlayer.color,
                        timeRemaining: nextPlayer.timeRemaining
                    });
                }
            }

            // Update captured stones count
            if (!gameState.capturedStones) {
                gameState.capturedStones = { capturedByBlack: 0, capturedByWhite: 0 };
            }
            if (capturedStones.capturedCount > 0) {
                // When black captures, increment capturedByBlack (white stones captured)
                // When white captures, increment capturedByWhite (black stones captured)
                if (color === 'black') {
                    gameState.capturedStones.capturedByBlack += capturedStones.capturedCount;
                } else {
                    gameState.capturedStones.capturedByWhite += capturedStones.capturedCount;
                }
            }

            // Change turn immediately - no delay needed since byo-yomi reset events are sent immediately
            gameState.currentTurn = color === 'black' ? 'white' : 'black';
            broadcastGameUpdate(io, gameManager, gameId, gameState);

            // Check if AI should make a move after human move
            if (aiGameManager.isAIGame(gameState)) {
                aiGameManager.handleHumanMove(gameState, {
                    color: color,
                    position: position,
                    playerId: playerId
                }).then(() => {
                    // Make AI move if it's AI's turn
                    if (aiGameManager.shouldAIMakeMove(gameState)) {
                        setTimeout(() => {
                            makeAIMove(io, gameManager, aiGameManager, gameId);
                        }, 500); // Small delay for better UX
                    }
                }).catch(error => {
                    log(`❌ Error handling human move in AI game: ${error.message}`);
                });
            }
        }
    };

    const handlePassTurn = ({ gameId, color, playerId, endGame }) => {
        const gameState = gameManager.getGame(gameId);
        if (gameState) {
            // Enhanced pass tracking with detailed timing information
            const passingPlayer = gameState.players.find(p => p.color === color);
            if (passingPlayer) {
                // Calculate actual time spent on this pass
                const timeSpentOnPass = calculateMoveTime(gameState);
                const passTimeDisplay = formatMoveTimeDisplay(timeSpentOnPass);

                log(`🎯 PASS TRACKED - Player ${playerId} passed their turn in game ${gameId} - Time spent: ${passTimeDisplay} (${passingPlayer.isInByoYomi ? 'Byo-yomi' : 'Main'})`);
            } else {
                log(`Player ${playerId} passed their turn in game ${gameId}`);
            }
        } else {
            log(`Player ${playerId} passed their turn in game ${gameId}`);
        }

        // Update the game state if it exists in memory
        if (gameState) {
            // Update turn
            gameState.currentTurn = color === 'black' ? 'white' : 'black';

            // Enhanced pass history tracking with timing information
            const playerForHistory = gameState.players.find(p => p.color === color);
            const timeSpentOnPass = calculateMoveTime(gameState);
            const passHistoryEntry = {
                pass: true,
                color: color,
                playerId: playerId,
                timestamp: Date.now(),
                timeSpentOnMove: timeSpentOnPass,
                timeSpentDisplay: formatMoveTimeDisplay(timeSpentOnPass),
                timeDisplay: playerForHistory ? formatTimeDisplay(playerForHistory) : 'Unknown',
                timeRemaining: playerForHistory ? playerForHistory.timeRemaining : 0,
                isInByoYomi: playerForHistory ? playerForHistory.isInByoYomi : false,
                byoYomiTimeLeft: playerForHistory ? playerForHistory.byoYomiTimeLeft : 0,
                byoYomiPeriodsLeft: playerForHistory ? playerForHistory.byoYomiPeriodsLeft : 0
            };

            gameState.history.push(passHistoryEntry);

            // Deduct time spent from player's remaining time for pass
            const passingPlayerForTime = gameState.players.find(p => p.color === color);
            if (passingPlayerForTime && timeSpentOnPass > 0) {
                let timerAlreadyReset = false; // Flag to track if we reset the timer during byo-yomi processing

                if (passingPlayerForTime.isInByoYomi) {
                    // Player is already in byo-yomi mode (3.1 and 3.2)
                    if (timeSpentOnPass <= gameState.timeControl.byoYomiTime) {
                        // 3.1: Pass made within byo-yomi period - reset clock, keep same period count
                        passingPlayerForTime.byoYomiTimeLeft = gameState.timeControl.byoYomiTime;
                        log(`🔄 BYO-YOMI RESET (PASS) - Player ${passingPlayerForTime.color} passed in ${timeSpentOnPass}s (within period), period reset to ${gameState.timeControl.byoYomiTime}s, periods remain: ${passingPlayerForTime.byoYomiPeriodsLeft}`);

                        // CRITICAL FIX: Emit byoYomiReset event IMMEDIATELY when reset happens on pass
                        io.to(gameId).emit('byoYomiReset', {
                            gameId,
                            color: passingPlayerForTime.color,
                            byoYomiTimeLeft: passingPlayerForTime.byoYomiTimeLeft,
                            byoYomiPeriodsLeft: passingPlayerForTime.byoYomiPeriodsLeft
                        });
                        log(`📤 BYO-YOMI RESET EVENT SENT (PASS) - Player ${passingPlayerForTime.color}: ${passingPlayerForTime.byoYomiTimeLeft}s, Periods=${passingPlayerForTime.byoYomiPeriodsLeft}`);

                        // CRITICAL: Reset the timer start time when byo-yomi resets on pass
                        gameState.lastMoveTime = Date.now();
                        timerAlreadyReset = true;
                    } else {
                        // 3.2: Pass exceeded byo-yomi period - calculate periods consumed
                        const periodsConsumed = Math.floor(timeSpentOnPass / gameState.timeControl.byoYomiTime);
                        const newPeriodsLeft = Math.max(0, passingPlayerForTime.byoYomiPeriodsLeft - periodsConsumed);

                        if (newPeriodsLeft > 0) {
                            // Still have periods remaining
                            passingPlayerForTime.byoYomiPeriodsLeft = newPeriodsLeft;
                            passingPlayerForTime.byoYomiTimeLeft = gameState.timeControl.byoYomiTime;
                            log(`⏳ BYO-YOMI PERIODS CONSUMED (PASS) - Player ${passingPlayerForTime.color} spent ${timeSpentOnPass}s, consumed ${periodsConsumed} periods, ${newPeriodsLeft} periods remaining`);

                            // CRITICAL FIX: Also emit reset event when periods are consumed and reset on pass
                            io.to(gameId).emit('byoYomiReset', {
                                gameId,
                                color: passingPlayerForTime.color,
                                byoYomiTimeLeft: passingPlayerForTime.byoYomiTimeLeft,
                                byoYomiPeriodsLeft: passingPlayerForTime.byoYomiPeriodsLeft
                            });
                            log(`📤 BYO-YOMI PERIODS CONSUMED EVENT SENT (PASS) - Player ${passingPlayerForTime.color}: ${passingPlayerForTime.byoYomiTimeLeft}s, Periods=${passingPlayerForTime.byoYomiPeriodsLeft}`);

                            // CRITICAL: Reset the timer start time when periods are consumed and reset on pass
                            gameState.lastMoveTime = Date.now();
                            timerAlreadyReset = true;
                        } else {
                            // No more periods - player times out
                            log(`💀 TIMEOUT (PASS) - Player ${passingPlayerForTime.color} consumed all byo-yomi periods (spent ${timeSpentOnPass}s, consumed ${periodsConsumed} periods)`);
                            handlePlayerTimeout(io, gameManager, gameState, passingPlayerForTime);
                            return; // Exit early, game is over
                        }
                    }
                } else {
                    // Player is in main time
                    const newMainTime = Math.max(0, passingPlayerForTime.timeRemaining - timeSpentOnPass);

                    if (newMainTime > 0) {
                        // Still in main time
                        passingPlayerForTime.timeRemaining = newMainTime;
                        log(`⏰ TIME DEDUCTED (PASS) - Player ${passingPlayerForTime.color} spent ${timeSpentOnPass}s from main time, ${newMainTime}s remaining`);
                    } else {
                        // 2: First time entering byo-yomi - calculate periods consumed
                        if (gameState.timeControl && gameState.timeControl.byoYomiPeriods > 0) {
                            const timeOverage = timeSpentOnPass - passingPlayerForTime.timeRemaining; // How much time exceeded main time
                            const periodsConsumed = Math.floor(timeOverage / gameState.timeControl.byoYomiTime);
                            const remainingPeriods = Math.max(0, gameState.timeControl.byoYomiPeriods - periodsConsumed);

                            if (remainingPeriods > 0) {
                                // Enter byo-yomi with calculated periods remaining
                                passingPlayerForTime.timeRemaining = 0;
                                passingPlayerForTime.isInByoYomi = true;
                                passingPlayerForTime.byoYomiPeriodsLeft = remainingPeriods;
                                passingPlayerForTime.byoYomiTimeLeft = gameState.timeControl.byoYomiTime;
                                log(`🚨 ENTERING BYO-YOMI (PASS): Player ${passingPlayerForTime.color} spent ${timeSpentOnPass}s (${timeOverage}s over main time), consumed ${periodsConsumed} periods, ${remainingPeriods} periods remaining`);

                                // Emit byo-yomi reset event for entering byo-yomi
                                io.to(gameId).emit('byoYomiReset', {
                                    gameId,
                                    color: passingPlayerForTime.color,
                                    byoYomiTimeLeft: passingPlayerForTime.byoYomiTimeLeft,
                                    byoYomiPeriodsLeft: passingPlayerForTime.byoYomiPeriodsLeft
                                });
                                log(`📤 BYO-YOMI ENTERED EVENT SENT (PASS) - Player ${passingPlayerForTime.color}: ${passingPlayerForTime.byoYomiTimeLeft}s, Periods=${passingPlayerForTime.byoYomiPeriodsLeft}`);

                                // CRITICAL: Reset the timer start time when entering byo-yomi on pass
                                gameState.lastMoveTime = Date.now();
                                timerAlreadyReset = true;
                            } else {
                                // No periods left - player times out
                                log(`💀 TIMEOUT (PASS) - Player ${passingPlayerForTime.color} exceeded main time and consumed all byo-yomi periods (spent ${timeSpentOnPass}s, overage ${timeOverage}s, consumed ${periodsConsumed} periods)`);
                                handlePlayerTimeout(io, gameManager, gameState, passingPlayerForTime);
                                return; // Exit early, game is over
                            }
                        } else {
                            // No byo-yomi available - check if unlimited time before timing out
                            const isUnlimitedTime = (gameState.timeControl?.timeControl || 0) === 0;
                            if (!isUnlimitedTime) {
                                log(`💀 TIMEOUT (PASS) - Player ${passingPlayerForTime.color} exceeded main time with no byo-yomi available (spent ${timeSpentOnPass}s, main time was ${passingPlayerForTime.timeRemaining}s)`);
                                handlePlayerTimeout(io, gameManager, gameState, passingPlayerForTime);
                                return; // Exit early, game is over
                            } else {
                                log(`⏰ UNLIMITED TIME (PASS) - Player ${passingPlayerForTime.color} spending time but no timeout (unlimited time mode)`);
                            }
                        }
                    }
                }

                // Reset timer for the next move (only if not already reset in byo-yomi logic above)
                if (!timerAlreadyReset) {
                    gameState.lastMoveTime = Date.now();
                }
            } else {
                // No time spent, just reset the timer for next move
                gameState.lastMoveTime = Date.now();
            }

            // Send time update after deducting time spent on pass
            const passingPlayer = gameState.players.find(p => p.color === color);
            if (passingPlayer) {
                // For blitz games, reset timer for the player who just passed
                if (gameState.gameType === 'blitz' && gameState.timePerMove) {
                    passingPlayer.timeRemaining = gameState.timePerMove;
                    log(`Reset blitz timer for player ${passingPlayer.id} (${color}) to ${gameState.timePerMove} seconds`);

                    // Also reset the next player's timer
                    const nextPlayer = gameState.players.find(p => p.color === gameState.currentTurn);
                    if (nextPlayer) {
                        nextPlayer.timeRemaining = gameState.timePerMove;
                        log(`Set blitz timer for next player ${nextPlayer.id} (${nextPlayer.color}) to ${gameState.timePerMove} seconds`);

                        // Send immediate time update for the next player
                        io.to(gameId).emit('timeUpdate', {
                            gameId,
                            playerId: nextPlayer.id,
                            color: nextPlayer.color,
                            timeRemaining: nextPlayer.timeRemaining
                        });
                    }
                }

                // Send time update to all clients for the passing player
                io.to(gameId).emit('timeUpdate', {
                    gameId,
                    playerId: passingPlayer.id,
                    color: passingPlayer.color,
                    timeRemaining: passingPlayer.timeRemaining,
                    byoYomiPeriodsLeft: passingPlayer.byoYomiPeriodsLeft,
                    byoYomiTimeLeft: passingPlayer.byoYomiTimeLeft,
                    isInByoYomi: passingPlayer.isInByoYomi
                });

                log(`📤 TIME UPDATE SENT (PASS) - Player ${passingPlayer.color}: Main=${passingPlayer.timeRemaining}s, InByoYomi=${passingPlayer.isInByoYomi}, ByoYomiLeft=${passingPlayer.byoYomiTimeLeft}s, Periods=${passingPlayer.byoYomiPeriodsLeft}`);
            }

            // Check if this is the second consecutive pass (game end)
            const historyLength = gameState.history.length;
            if (historyLength >= 2) {
                const lastMove = gameState.history[historyLength - 1];
                const secondLastMove = gameState.history[historyLength - 2];

                if (lastMove.pass && secondLastMove.pass) {
                    // Transition to scoring phase instead of finishing immediately
                    gameState.status = 'scoring';
                    gameState.deadStones = []; // Initialize empty dead stones array
                    gameState.scoreConfirmation = { black: false, white: false }; // Initialize score confirmations

                    // Auto-confirm AI score immediately
                    autoConfirmAIScore(gameState);

                    log(`Game ${gameId} has transitioned to scoring phase after two consecutive passes.`);
                }
            }

            // If client explicitly signals this is an end game move, ensure scoring state
            if (endGame) {
                gameState.status = 'scoring';
                gameState.deadStones = gameState.deadStones || []; // Ensure deadStones array exists
                gameState.scoreConfirmation = gameState.scoreConfirmation || { black: false, white: false }; // Ensure score confirmation exists

                // Auto-confirm AI score immediately
                autoConfirmAIScore(gameState);

                log(`Client signaled end game, ensuring scoring state for game ${gameId}`);
            }

            // Store updated game state
            gameManager.updateGame(gameId, gameState);

            // Use the new broadcast function for move updates
            broadcastGameUpdate(io, gameManager, gameId, gameState);

            // Also broadcast the full game state
            io.to(gameId).emit('gameState', gameState);
            log(`Broadcasting updated game state to all clients in room ${gameId}`);

            if (gameState.status === 'scoring') {
                log(`Broadcasting scoring phase start to all clients in room ${gameId}`);
                io.to(gameId).emit('scoringPhaseStarted', { gameId });
            }
        }
    };

    return {
        handleMakeMove,
        handlePassTurn
    };
};
