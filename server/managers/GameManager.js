const { log } = require('../utils/logger');

class GameManager {
    constructor() {
        // Store active games in memory
        this.activeGames = new Map();
        // Map socket IDs to game IDs for quick lookup
        this.socketToGame = new Map();
    }

    createGame(gameState) {
        this.activeGames.set(gameState.id, gameState);
        log(`Game created: ${gameState.id}`);
        return gameState;
    }

    getGame(gameId) {
        return this.activeGames.get(gameId);
    }

    updateGame(gameId, gameState) {
        this.activeGames.set(gameId, gameState);
    }

    removeGame(gameId) {
        this.activeGames.delete(gameId);
        log(`Game removed: ${gameId}`);
    }

    addPlayerToGame(socketId, gameId) {
        this.socketToGame.set(socketId, gameId);
    }

    removePlayerFromGame(socketId) {
        this.socketToGame.delete(socketId);
    }

    getGameIdBySocketId(socketId) {
        return this.socketToGame.get(socketId);
    }

    getAllActiveGames() {
        return this.activeGames;
    }
}

module.exports = new GameManager(); // Export singleton
