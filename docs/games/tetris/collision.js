import { CONFIG } from './config.js';

export function getShape(pieceType, rotation = 0) {
    const shapes = CONFIG.PIECES[pieceType];
    if (!shapes) return null;
    return shapes[rotation % shapes.length];
}

export function isCollision(board, pieceType, rotation, x, y) {
    const shape = getShape(pieceType, rotation);
    if (!shape) return false;

    for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
            if (!shape[row][col]) continue;
            const boardX = x + col;
            const boardY = y + row;

            if (boardX < 0 || boardX >= CONFIG.COLS || boardY >= CONFIG.ROWS) return true;
            if (boardY >= 0 && board[boardY][boardX]) return true;
        }
    }
    return false;
}

export function clearCompletedLines(board) {
    let linesCleared = 0;
    for (let row = CONFIG.ROWS - 1; row >= 0; row--) {
        if (board[row].every(cell => cell !== null)) {
            board.splice(row, 1);
            board.unshift(Array(CONFIG.COLS).fill(null));
            linesCleared += 1;
            row += 1;
        }
    }
    return linesCleared;
}

export function getGhostRow(board, pieceType, rotation, x, startY) {
    let ghostY = startY;
    while (!isCollision(board, pieceType, rotation, x, ghostY + 1)) ghostY += 1;
    return ghostY;
}

export function getKickIndex(from, to) {
    const transitions = [
        [0, 7],
        [1, 2],
        [3, 4],
        [6, 5]
    ];
    const diff = (to - from + 4) % 4;
    return transitions[from][diff === 1 ? 0 : 1];
}

export function tryWallKick(board, currentPiece, fromRotation, toRotation) {
    const kicks = currentPiece.type === 'I' ? CONFIG.WALL_KICK_I : CONFIG.WALL_KICK_JLSTZ;
    const kickIndex = getKickIndex(fromRotation, toRotation);
    const tests = kicks[kickIndex] || kicks[0];

    for (const [dx, dy] of tests) {
        const nextX = currentPiece.col + dx;
        const nextY = currentPiece.row - dy;
        if (!isCollision(board, currentPiece.type, toRotation, nextX, nextY)) {
            return { col: nextX, row: nextY, rotation: toRotation };
        }
    }

    return null;
}
