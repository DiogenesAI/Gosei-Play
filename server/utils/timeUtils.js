function formatTimeDisplay(player) {
    if (player.isInByoYomi) {
        const minutes = Math.floor(player.byoYomiTimeLeft / 60);
        const seconds = player.byoYomiTimeLeft % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}s (BY-${player.byoYomiPeriodsLeft})`;
    } else {
        const minutes = Math.floor(player.timeRemaining / 60);
        const seconds = player.timeRemaining % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}s (Main)`;
    }
}

function calculateMoveTime(gameState) {
    if (!gameState.lastMoveTime) {
        return 0;
    }
    return Math.floor((Date.now() - gameState.lastMoveTime) / 1000);
}

function formatMoveTimeDisplay(timeSpentSeconds) {
    const minutes = Math.floor(timeSpentSeconds / 60);
    const seconds = timeSpentSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}s`;
}

module.exports = {
    formatTimeDisplay,
    calculateMoveTime,
    formatMoveTimeDisplay
};
