/**
 * core/moves.js
 * توليد الحركات الخام (pseudo-legal) — بدون فلترة الكشف
 *
 * كل حركة: { row, col, flags: string[] }
 * الـ flags المحتملة: 'capture' | 'double' | 'enPassant' | 'promotion' | 'castleKing' | 'castleQueen'
 */

import { COLOR, TYPE } from './pieces.js';

/**
 * حركات قطعة في (row, col) — خام بدون فحص الكشف
 * @param {import('./board.js').Board} board
 * @param {number} row
 * @param {number} col
 * @param {object|null} gameState - يحتوي castling و enPassant
 * @param {boolean} attackOnly - لفحص التهديد فقط (البيدق: قطري فقط)
 */
export function getRawMoves(board, row, col, gameState, attackOnly = false) {
    const piece = board.get(row, col);
    if (!piece) return [];

    const { type, color } = piece;

    switch (type) {
        case TYPE.PAWN:
            return attackOnly
                ? getPawnAttacks(board, row, col, color)
                : getPawnMoves(board, row, col, color, gameState);
        case TYPE.KNIGHT:
            return getKnightMoves(board, row, col, color);
        case TYPE.BISHOP:
            return getSlidingMoves(board, row, col, color, DIAGONALS);
        case TYPE.ROOK:
            return getSlidingMoves(board, row, col, color, STRAIGHTS);
        case TYPE.QUEEN:
            return getSlidingMoves(board, row, col, color, [...DIAGONALS, ...STRAIGHTS]);
        case TYPE.KING:
            return getKingMoves(board, row, col, color, gameState, attackOnly);
        default:
            return [];
    }
}

// ─── اتجاهات الحركة ──────────────────────────────────────────────────────────

const DIAGONALS = [[1,1],[1,-1],[-1,1],[-1,-1]];
const STRAIGHTS = [[1,0],[-1,0],[0,1],[0,-1]];

// ─── البيدق ──────────────────────────────────────────────────────────────────

/** مربعات تهديد البيدق فقط (قطري) */
function getPawnAttacks(board, row, col, color) {
    const dir  = color === COLOR.WHITE ? -1 : 1;
    const moves = [];
    for (const dc of [-1, 1]) {
        const nr = row + dir, nc = col + dc;
        if (board.inBounds(nr, nc))
            moves.push({ row: nr, col: nc, flags: [] });
    }
    return moves;
}

function getPawnMoves(board, row, col, color, gameState) {
    const moves  = [];
    const dir    = color === COLOR.WHITE ? -1 : 1;
    const start  = color === COLOR.WHITE ? 6 : 1;
    const promRow = color === COLOR.WHITE ? 0 : 7;

    // تقدم واحد
    const r1 = row + dir;
    if (board.inBounds(r1, col) && !board.get(r1, col)) {
        pushPawn(moves, r1, col, [], promRow);

        // تقدم اثنان من الموضع الابتدائي
        const r2 = row + 2 * dir;
        if (row === start && board.inBounds(r2, col) && !board.get(r2, col))
            moves.push({ row: r2, col, flags: ['double'] });
    }

    // أكل قطري
    for (const dc of [-1, 1]) {
        const nr = row + dir, nc = col + dc;
        if (!board.inBounds(nr, nc)) continue;
        const target = board.get(nr, nc);

        if (target && target.color !== color) {
            pushPawn(moves, nr, nc, ['capture'], promRow);
        } else if (!target && isEnPassant(gameState, nr, nc)) {
            moves.push({ row: nr, col: nc, flags: ['enPassant', 'capture'] });
        }
    }

    return moves;
}

function pushPawn(moves, row, col, flags, promRow) {
    if (row === promRow)
        moves.push({ row, col, flags: [...flags, 'promotion'] });
    else
        moves.push({ row, col, flags });
}

function isEnPassant(gameState, row, col) {
    const ep = gameState?.enPassant;
    return ep && ep.row === row && ep.col === col;
}

// ─── الحصان ──────────────────────────────────────────────────────────────────

const KNIGHT_JUMPS = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];

function getKnightMoves(board, row, col, color) {
    const moves = [];
    for (const [dr, dc] of KNIGHT_JUMPS) {
        const nr = row + dr, nc = col + dc;
        if (!board.inBounds(nr, nc)) continue;
        const target = board.get(nr, nc);
        if (!target || target.color !== color)
            moves.push({ row: nr, col: nc, flags: target ? ['capture'] : [] });
    }
    return moves;
}

// ─── قطع الانزلاق (فيل، رخ، وزير) ───────────────────────────────────────────

function getSlidingMoves(board, row, col, color, directions) {
    const moves = [];
    for (const [dr, dc] of directions) {
        let nr = row + dr, nc = col + dc;
        while (board.inBounds(nr, nc)) {
            const target = board.get(nr, nc);
            if (target) {
                if (target.color !== color)
                    moves.push({ row: nr, col: nc, flags: ['capture'] });
                break;
            }
            moves.push({ row: nr, col: nc, flags: [] });
            nr += dr; nc += dc;
        }
    }
    return moves;
}

// ─── الملك ───────────────────────────────────────────────────────────────────

const KING_STEPS = [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];

function getKingMoves(board, row, col, color, gameState, attackOnly) {
    const moves = [];

    for (const [dr, dc] of KING_STEPS) {
        const nr = row + dr, nc = col + dc;
        if (!board.inBounds(nr, nc)) continue;
        const target = board.get(nr, nc);
        if (!target || target.color !== color)
            moves.push({ row: nr, col: nc, flags: target ? ['capture'] : [] });
    }

    // التبييت — لا يُضاف في وضع التهديد
    if (!attackOnly && gameState) {
        addCastlingMoves(moves, board, row, col, color, gameState);
    }

    return moves;
}

function addCastlingMoves(moves, board, row, col, color, gameState) {
    const kingRow  = color === COLOR.WHITE ? 7 : 0;
    if (row !== kingRow || col !== 4) return;

    const rights = gameState.castling?.[color];
    if (!rights) return;

    // تبييت قصير (ملك → g)
    if (rights.kingSide &&
        !board.get(kingRow, 5) &&
        !board.get(kingRow, 6))
        moves.push({ row: kingRow, col: 6, flags: ['castleKing'] });

    // تبييت طويل (ملك → c)
    if (rights.queenSide &&
        !board.get(kingRow, 3) &&
        !board.get(kingRow, 2) &&
        !board.get(kingRow, 1))
        moves.push({ row: kingRow, col: 2, flags: ['castleQueen'] });
}
