const { log } = require('./logger');
const { getAdjacentPositions, isWithinBounds, findStoneAt } = require('./gameLogic');

/**
 * Converts a position to a string key for Set lookups
 */
function positionKey(position) {
    return `${position.x},${position.y}`;
}

/**
 * Determines if a position on the board is empty (no stone)
 */
function isEmpty(position, stones) {
    return !stones.some(stone => stone.position.x === position.x && stone.position.y === position.y);
}

/**
 * Checks if a position is in the provided set of positions
 */
function isPositionInSet(position, positionSet) {
    const key = positionKey(position);
    return positionSet.has(key);
}

/**
 * Performs flood fill to determine territory ownership
 * Returns the owner color if territory is surrounded by single color, or null if contested
 */
function findTerritoryOwner(board, startPosition, deadStonePositions) {
    const visited = new Set();
    const territory = [];
    let surroundingColors = new Set();

    function floodFill(position) {
        if (!isWithinBounds(position, board.size)) return;

        const posKey = positionKey(position);
        if (visited.has(posKey)) return;

        visited.add(posKey);

        // Check if there's a stone at this position
        const stone = findStoneAt(position, board.stones);

        if (stone) {
            // If it's a dead stone, treat it as empty space (part of territory)
            if (deadStonePositions.has(posKey)) {
                territory.push(position);

                // Continue flood filling from this position
                const adjacentPositions = getAdjacentPositions(position);
                for (const adjPos of adjacentPositions) {
                    floodFill(adjPos);
                }
            } else {
                // Live stone - record its color as a surrounding color
                surroundingColors.add(stone.color);
            }
        } else {
            // Empty space - part of territory
            territory.push(position);

            // Continue flood filling
            const adjacentPositions = getAdjacentPositions(position);
            for (const adjPos of adjacentPositions) {
                floodFill(adjPos);
            }
        }
    }

    // Start flood filling from the given position
    floodFill(startPosition);

    // Determine owner based on surrounding colors
    let owner = null;

    // If surrounded by only one color (and not null), that color owns the territory
    if (surroundingColors.size === 1) {
        owner = surroundingColors.has('black') ? 'black' :
            surroundingColors.has('white') ? 'white' :
                null;
    }

    return { owner, territory };
}

/**
 * Calculates all territories on the board
 */
function calculateTerritories(board, deadStonePositions) {
    const visited = new Set();
    const territories = [];

    // Check each position on the board
    for (let x = 0; x < board.size; x++) {
        for (let y = 0; y < board.size; y++) {
            const position = { x, y };
            const posKey = positionKey(position);

            // Skip if already visited
            if (visited.has(posKey)) continue;

            // Skip if there's a live stone at this position
            const stone = findStoneAt(position, board.stones);
            if (stone && !deadStonePositions.has(posKey)) continue;

            // Find territory and its owner
            const { owner, territory } = findTerritoryOwner(board, position, deadStonePositions);

            // Mark all territory positions as visited
            territory.forEach(pos => {
                visited.add(positionKey(pos));
            });

            // Add territories with valid owners
            if (owner) {
                territories.push(...territory.map(position => ({ position, owner })));
            }
        }
    }

    return territories;
}

/**
 * Counts live stones by color, excluding dead stones
 */
function countLiveStones(board, deadStonePositions) {
    let black = 0;
    let white = 0;

    board.stones.forEach(stone => {
        const posKey = positionKey(stone.position);
        if (!deadStonePositions.has(posKey)) {
            if (stone.color === 'black') {
                black++;
            } else if (stone.color === 'white') {
                white++;
            }
        }
    });

    return { black, white };
}

/**
 * Counts territory points by color
 */
function countTerritoryPoints(territories) {
    let black = 0;
    let white = 0;

    territories.forEach(territory => {
        if (territory.owner === 'black') {
            black++;
        } else if (territory.owner === 'white') {
            white++;
        }
    });

    return { black, white };
}

/**
 * Calculates score using Chinese rules: 
 * - Territory points + stones on the board + komi
 */
function calculateChineseScore(board, deadStonePositions, capturedStones, komi = 7.5) {
    // Calculate territories
    const territories = calculateTerritories(board, deadStonePositions);
    const territoryPoints = countTerritoryPoints(territories);

    // Count stones on the board
    const liveStones = countLiveStones(board, deadStonePositions);

    // Calculate final scores
    const blackScore = territoryPoints.black + liveStones.black;
    const whiteScore = territoryPoints.white + liveStones.white + komi;

    return {
        territories,
        score: {
            black: blackScore,
            white: whiteScore,
            blackTerritory: territoryPoints.black,
            whiteTerritory: territoryPoints.white,
            blackStones: liveStones.black,
            whiteStones: liveStones.white,
            komi
        },
        winner: blackScore > whiteScore ? 'black' : blackScore < whiteScore ? 'white' : null,
        diff: Math.abs(blackScore - whiteScore)
    };
}

/**
 * Calculates score using Japanese rules: 
 * - Territory points + prisoners + dead opponent stones + komi (for white)
 */
function calculateJapaneseScore(board, deadStonePositions, capturedStones, komi = 6.5) {
    // Calculate territories
    const territories = calculateTerritories(board, deadStonePositions);
    const territoryPoints = countTerritoryPoints(territories);

    // Count dead stones by color
    let deadBlackStones = 0;
    let deadWhiteStones = 0;

    board.stones.forEach(stone => {
        const posKey = positionKey(stone.position);
        if (deadStonePositions.has(posKey)) {
            if (stone.color === 'black') {
                deadBlackStones++;
            } else if (stone.color === 'white') {
                deadWhiteStones++;
            }
        }
    });

    // Japanese scoring: Territory + Prisoners (stones you captured from opponent + dead opponent stones)
    const blackScore = territoryPoints.black + capturedStones.capturedByBlack + deadWhiteStones;
    const whiteScore = territoryPoints.white + capturedStones.capturedByWhite + deadBlackStones + komi;

    return {
        territories,
        score: {
            black: blackScore,
            white: whiteScore,
            blackTerritory: territoryPoints.black,
            whiteTerritory: territoryPoints.white,
            blackCaptures: capturedStones.capturedByBlack, // Stones that black captured (white stones)
            whiteCaptures: capturedStones.capturedByWhite, // Stones that white captured (black stones)
            deadBlackStones,
            deadWhiteStones,
            komi
        },
        winner: blackScore > whiteScore ? 'black' : blackScore < whiteScore ? 'white' : null,
        diff: Math.abs(blackScore - whiteScore)
    };
}

/**
 * Calculates score using Korean rules: 
 * - Territory scoring (same as Japanese rules, not area scoring)
 * - Territory points + prisoners + komi
 * - Default komi is 6.5
 */
function calculateKoreanScore(board, deadStonePositions, capturedStones, komi = 6.5) {
    // Calculate territories
    const territories = calculateTerritories(board, deadStonePositions);
    const territoryPoints = countTerritoryPoints(territories);

    // Count dead stones by color
    let deadBlackStones = 0;
    let deadWhiteStones = 0;

    board.stones.forEach(stone => {
        const posKey = positionKey(stone.position);
        if (deadStonePositions.has(posKey)) {
            if (stone.color === 'black') {
                deadBlackStones++;
            } else if (stone.color === 'white') {
                deadWhiteStones++;
            }
        }
    });

    // Korean scoring: Territory + Prisoners (same as Japanese)
    const blackScore = territoryPoints.black + capturedStones.capturedByBlack + deadWhiteStones;
    const whiteScore = territoryPoints.white + capturedStones.capturedByWhite + deadBlackStones + komi;

    return {
        territories,
        score: {
            black: blackScore,
            white: whiteScore,
            blackTerritory: territoryPoints.black,
            whiteTerritory: territoryPoints.white,
            blackCaptures: capturedStones.capturedByBlack,
            whiteCaptures: capturedStones.capturedByWhite,
            deadBlackStones,
            deadWhiteStones,
            komi
        },
        winner: blackScore > whiteScore ? 'black' : blackScore < whiteScore ? 'white' : null,
        diff: Math.abs(blackScore - whiteScore)
    };
}

/**
 * Calculates score using AGA (American Go Association) rules: 
 * - Hybrid approach: Territory + live stones - own losses + komi
 * - Territory points + living stones on the board + komi
 * - Own losses = own prisoners + own dead stones
 * - Default komi is 7.5
 */
function calculateAGAScore(board, deadStonePositions, capturedStones, komi = 7.5) {
    // Calculate territories
    const territories = calculateTerritories(board, deadStonePositions);
    const territoryPoints = countTerritoryPoints(territories);

    // Count stones on the board
    const liveStones = countLiveStones(board, deadStonePositions);

    // Count dead stones by color
    let deadBlackStones = 0;
    let deadWhiteStones = 0;

    board.stones.forEach(stone => {
        const posKey = positionKey(stone.position);
        if (deadStonePositions.has(posKey)) {
            if (stone.color === 'black') {
                deadBlackStones++;
            } else if (stone.color === 'white') {
                deadWhiteStones++;
            }
        }
    });

    // AGA scoring: Territory + live stones - own prisoners - own dead stones
    const blackScore = territoryPoints.black + liveStones.black - capturedStones.capturedByWhite - deadBlackStones;
    const whiteScore = territoryPoints.white + liveStones.white - capturedStones.capturedByBlack - deadWhiteStones + komi;

    return {
        territories,
        score: {
            black: blackScore,
            white: whiteScore,
            blackTerritory: territoryPoints.black,
            whiteTerritory: territoryPoints.white,
            blackStones: liveStones.black,
            whiteStones: liveStones.white,
            blackCaptures: capturedStones.capturedByBlack, // Stones that black captured (white stones)
            whiteCaptures: capturedStones.capturedByWhite, // Stones that white captured (black stones)
            deadBlackStones,
            deadWhiteStones,
            komi
        },
        winner: blackScore > whiteScore ? 'black' : blackScore < whiteScore ? 'white' : null,
        diff: Math.abs(blackScore - whiteScore)
    };
}

/**
 * Calculates score using Ing (SST) rules: 
 * - Area scoring (living stones + empty territory)
 * - Prisoners do NOT affect the score in area scoring
 * - Each player counts their stones on the board plus territory
 * - Default komi is 8 points (called "compensation points")
 */
function calculateIngScore(board, deadStonePositions, capturedStones, komi = 8) {
    // Calculate territories
    const territories = calculateTerritories(board, deadStonePositions);
    const territoryPoints = countTerritoryPoints(territories);

    // Count stones on the board
    const liveStones = countLiveStones(board, deadStonePositions);

    // Ing SST scoring: Area scoring (Living stones + Empty territory)
    // Prisoners do NOT affect the score in area scoring
    const blackScore = territoryPoints.black + liveStones.black;
    const whiteScore = territoryPoints.white + liveStones.white + komi;

    return {
        territories,
        score: {
            black: blackScore,
            white: whiteScore,
            blackTerritory: territoryPoints.black,
            whiteTerritory: territoryPoints.white,
            blackStones: liveStones.black,
            whiteStones: liveStones.white,
            komi
        },
        winner: blackScore > whiteScore ? 'black' : blackScore < whiteScore ? 'white' : null,
        diff: Math.abs(blackScore - whiteScore)
    };
}

/**
 * Main scoring function that delegates to the appropriate scoring rule
 */
function calculateScore(gameState) {
    const { board, komi, capturedStones, deadStones, scoringRule = 'japanese' } = gameState;

    // Convert deadStones array to Set for efficient lookups
    const deadStonePositions = new Set();
    if (deadStones) {
        deadStones.forEach(pos => {
            deadStonePositions.add(positionKey(pos));
        });
    }

    // Prepare captured stones in the format expected by scoring functions
    const captures = {
        capturedByBlack: capturedStones?.capturedByBlack || 0,
        capturedByWhite: capturedStones?.capturedByWhite || 0
    };

    // Determine komi based on scoring rule if not provided
    const effectiveKomi = komi !== undefined ? komi :
        (scoringRule === 'chinese' || scoringRule === 'aga' ? 7.5 :
            scoringRule === 'ing' ? 8 :
                6.5); // Japanese and Korean default to 6.5

    // Call the appropriate scoring function
    let result;
    switch (scoringRule) {
        case 'chinese':
            result = calculateChineseScore(board, deadStonePositions, captures, effectiveKomi);
            break;
        case 'korean':
            result = calculateKoreanScore(board, deadStonePositions, captures, effectiveKomi);
            break;
        case 'aga':
            result = calculateAGAScore(board, deadStonePositions, captures, effectiveKomi);
            break;
        case 'ing':
            result = calculateIngScore(board, deadStonePositions, captures, effectiveKomi);
            break;
        case 'japanese':
        default:
            result = calculateJapaneseScore(board, deadStonePositions, captures, effectiveKomi);
            break;
    }

    // Return in the format expected by the server handlers and client
    return {
        black: {
            total: result.score.black,
            territory: result.score.blackTerritory,
            prisoners: result.score.blackCaptures || 0,
            stones: result.score.blackStones,
            captures: result.score.blackCaptures || 0,
            deadStones: result.score.deadBlackStones || 0
        },
        white: {
            total: result.score.white,
            territory: result.score.whiteTerritory,
            prisoners: result.score.whiteCaptures || 0,
            stones: result.score.whiteStones,
            captures: result.score.whiteCaptures || 0,
            deadStones: result.score.deadWhiteStones || 0,
            komi: effectiveKomi
        },
        // Return territories as array (not object) - client expects Territory[]
        territory: result.territories,
        winner: result.winner,
        diff: result.diff
    };
}

module.exports = {
    calculateScore,
    calculateChineseScore,
    calculateJapaneseScore,
    calculateKoreanScore,
    calculateAGAScore,
    calculateIngScore
};
