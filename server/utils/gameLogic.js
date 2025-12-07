const { log } = require('./logger');

// Helper function to get handicap stone positions
function getHandicapStones(boardSize, handicap) {
    if (handicap < 2 || handicap > 9) return [];

    // Standard handicap stone positions for different board sizes
    const HANDICAP_POSITIONS = {
        21: [
            { x: 3, y: 3 },     // bottom left
            { x: 17, y: 17 },   // top right
            { x: 17, y: 3 },    // bottom right
            { x: 3, y: 17 },    // top left
            { x: 10, y: 10 },   // center
            { x: 10, y: 3 },    // bottom center
            { x: 10, y: 17 },   // top center
            { x: 3, y: 10 },    // left center
            { x: 17, y: 10 },   // right center
        ],
        19: [
            { x: 3, y: 3 },    // bottom left
            { x: 15, y: 15 },  // top right
            { x: 15, y: 3 },   // bottom right
            { x: 3, y: 15 },   // top left
            { x: 9, y: 9 },    // center
            { x: 9, y: 3 },    // bottom center
            { x: 9, y: 15 },   // top center
            { x: 3, y: 9 },    // left center
            { x: 15, y: 9 },   // right center
        ],
        15: [
            { x: 3, y: 3 },     // bottom left
            { x: 11, y: 11 },   // top right
            { x: 11, y: 3 },    // bottom right
            { x: 3, y: 11 },    // top left
            { x: 7, y: 7 },     // center
            { x: 7, y: 3 },     // bottom center
            { x: 7, y: 11 },    // top center
            { x: 3, y: 7 },     // left center
            { x: 11, y: 7 },    // right center
        ],
        13: [
            { x: 3, y: 3 },    // bottom left
            { x: 9, y: 9 },    // top right
            { x: 9, y: 3 },    // bottom right
            { x: 3, y: 9 },    // top left
            { x: 6, y: 6 },    // center
            { x: 6, y: 3 },    // bottom center
            { x: 6, y: 9 },    // top center
            { x: 3, y: 6 },    // left center
            { x: 9, y: 6 },    // right center
        ],
        9: [
            { x: 2, y: 2 },    // bottom left
            { x: 6, y: 6 },    // top right
            { x: 6, y: 2 },    // bottom right
            { x: 2, y: 6 },    // top left
            { x: 4, y: 4 },    // center
            { x: 4, y: 2 },    // bottom center
            { x: 4, y: 6 },    // top center
            { x: 2, y: 4 },    // left center
            { x: 6, y: 4 },    // right center
        ]
    };

    const positions = HANDICAP_POSITIONS[boardSize];
    if (!positions) return [];

    // Get the handicap positions (limit to requested handicap)
    const handicapPositions = positions.slice(0, handicap);

    // Create stones for each position
    return handicapPositions.map(position => ({
        position,
        color: 'black'
    }));
}

// Helper function to get adjacent positions
function getAdjacentPositions(position) {
    return [
        { x: position.x, y: position.y - 1 }, // up
        { x: position.x + 1, y: position.y }, // right
        { x: position.x, y: position.y + 1 }, // down
        { x: position.x - 1, y: position.y }, // left
    ];
}

// Check if a position is within the bounds of the board
function isWithinBounds(position, boardSize) {
    return position.x >= 0 && position.x < boardSize && position.y >= 0 && position.y < boardSize;
}

// Find stone at a position
function findStoneAt(position, stones) {
    return stones.find(
        stone => stone.position.x === position.x && stone.position.y === position.y
    );
}

// Get connected group of stones
function getConnectedGroup(position, stones, boardSize) {
    const stone = findStoneAt(position, stones);
    if (!stone) return [];

    const color = stone.color;
    const visited = new Set();
    const group = [];

    function visit(pos) {
        const key = `${pos.x},${pos.y}`;
        if (visited.has(key)) return;

        visited.add(key);

        const stoneAtPos = findStoneAt(pos, stones);
        if (!stoneAtPos || stoneAtPos.color !== color) return;

        group.push(pos);

        // Visit adjacent positions
        const adjacentPositions = getAdjacentPositions(pos).filter(p =>
            isWithinBounds(p, boardSize)
        );

        adjacentPositions.forEach(visit);
    }

    visit(position);
    return group;
}

// Check if a position is empty
function isEmpty(position, stones) {
    return !stones.some(
        stone => stone.position.x === position.x && stone.position.y === position.y
    );
}

// Count liberties for a group of stones
function countLiberties(group, stones, boardSize) {
    const liberties = new Set();

    group.forEach(position => {
        const adjacentPositions = getAdjacentPositions(position).filter(p =>
            isWithinBounds(p, boardSize)
        );

        adjacentPositions.forEach(adjPos => {
            if (isEmpty(adjPos, stones)) {
                liberties.add(`${adjPos.x},${adjPos.y}`);
            }
        });
    });

    return liberties.size;
}

// Capture stones that have no liberties after a move
function captureDeadStones(gameState, updatedStones, lastMovePosition, playerColor) {
    const boardSize = gameState.board.size;
    const oppositeColor = playerColor === 'black' ? 'white' : 'black';

    // Check all adjacent positions for opponent stones
    const adjacentPositions = getAdjacentPositions(lastMovePosition).filter(p =>
        isWithinBounds(p, boardSize)
    );

    let capturedCount = 0;
    let remainingStones = [...updatedStones];
    let koPosition = undefined;
    let capturedGroups = [];

    // Check each adjacent position for enemy groups that might be captured
    adjacentPositions.forEach(adjPos => {
        const stoneAtPos = findStoneAt(adjPos, remainingStones);

        // If there's an opponent's stone at this position
        if (stoneAtPos && stoneAtPos.color === oppositeColor) {
            // Get the entire connected group
            const group = getConnectedGroup(adjPos, remainingStones, boardSize);

            // Check if this group has any liberties
            const liberties = countLiberties(group, remainingStones, boardSize);

            // If the group has no liberties, remove all stones in the group
            if (liberties === 0) {
                // Track this group before removing
                capturedGroups.push([...group]);

                // Remove captured stones
                remainingStones = remainingStones.filter(stone =>
                    !group.some(pos => pos.x === stone.position.x && pos.y === stone.position.y)
                );

                capturedCount += group.length;
                log(`Captured ${group.length} ${oppositeColor} stones`);

                // Check for KO: if we captured exactly one stone
                if (group.length === 1) {
                    koPosition = group[0];
                    log(`KO position set at (${koPosition.x}, ${koPosition.y})`);
                }
            }
        }
    });

    // Also check if the placed stone's group has liberties
    const newStoneGroup = getConnectedGroup(lastMovePosition, remainingStones, boardSize);
    const newStoneLiberties = countLiberties(newStoneGroup, remainingStones, boardSize);

    let isSuicide = false;
    if (newStoneLiberties === 0) {
        log(`Suicide move detected!`);
        isSuicide = true;
    }

    // Refine KO logic: strict Ko requires capturing 1 stone, by a group of 1 stone, leaving 1 liberty
    if (capturedCount !== 1 || newStoneGroup.length !== 1 || newStoneLiberties !== 1) {
        koPosition = undefined;
    }

    return { remainingStones, capturedCount, koPosition, isSuicide };
}

module.exports = {
    getHandicapStones,
    getAdjacentPositions,
    isWithinBounds,
    findStoneAt,
    getConnectedGroup,
    isEmpty,
    countLiberties,
    captureDeadStones
};
