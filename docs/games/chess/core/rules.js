/**
 * core/rules.js
 * قواعد الشطرنج: حركات قانونية، كشف، كش مات، تعادل
 */

import { COLOR, TYPE, opponent } from './pieces.js';
import { getRawMoves } from './moves.js';

// ─── تطبيق الحركة ────────────────────────────────────────────────────────────

/**
 * تطبيق حركة على نسخة من الرقعة — لا تعدّل الرقعة الأصلية
 * @returns {{ board: Board, captured: object|null }}
 */
export function applyMove(board, move) {
    const b = board.clone();
    const piece = b.get(move.from.row, move.from.col);
    const { flags } = move;

    // حركة أساسية
    const captured = b.movePiece(
        move.from.row, move.from.col,
        move.to.row,   move.to.col
    );

    // أكل بالمرور (en passant)
    if (flags.includes('enPassant')) {
        b.remove(move.from.row, move.to.col);
    }

    // تبييت — نقل الرخ
    if (flags.includes('castleKing')) {
        b.movePiece(move.to.row, 7, move.to.row, 5);
    }
    if (flags.includes('castleQueen')) {
        b.movePiece(move.to.row, 0, move.to.row, 3);
    }

    // ترقية البيدق
    if (flags.includes('promotion')) {
        b.set(move.to.row, move.to.col, {
            type:  move.promotion ?? TYPE.QUEEN,
            color: piece.color,
        });
    }

    return { board: b, captured };
}

/**
 * بناء gameState جديد بعد تنفيذ الحركة
 */
export function nextGameState(board, move, prevState) {
    const piece = board.get(move.from.row, move.from.col);
    const { flags } = move;
    const color = piece.color;
    const opp   = opponent(color);

    // حقوق التبييت
    const castling = {
        [COLOR.WHITE]: { ...prevState.castling?.[COLOR.WHITE] },
        [COLOR.BLACK]: { ...prevState.castling?.[COLOR.BLACK] },
    };

    // الملك تحرك — يلغي كل حقوق التبييت لهذا اللون
    if (piece.type === TYPE.KING) {
        castling[color] = { kingSide: false, queenSide: false };
    }
    // الرخ تحرك أو أُكلت — يلغي الجانب المحدد
    if (piece.type === TYPE.ROOK) {
        const homeRow = color === COLOR.WHITE ? 7 : 0;
        if (move.from.row === homeRow) {
            if (move.from.col === 7) castling[color].kingSide  = false;
            if (move.from.col === 0) castling[color].queenSide = false;
        }
    }
    // إذا أُكلت رخ الخصم
    if (flags.includes('capture')) {
        const oppHomeRow = opp === COLOR.WHITE ? 7 : 0;
        if (move.to.row === oppHomeRow) {
            if (move.to.col === 7) castling[opp].kingSide  = false;
            if (move.to.col === 0) castling[opp].queenSide = false;
        }
    }

    // en passant المحتمل للحركة القادمة
    let enPassant = null;
    if (piece.type === TYPE.PAWN && flags.includes('double')) {
        enPassant = {
            row: (move.from.row + move.to.row) / 2,
            col: move.from.col,
        };
    }

    // عداد نصف الحركة (50 حركة)
    const isCapture = flags.some(f => f === 'capture' || f === 'enPassant');
    const isPawnMove = piece.type === TYPE.PAWN;
    const halfMoveClock = (isCapture || isPawnMove) ? 0 : (prevState.halfMoveClock ?? 0) + 1;

    return {
        turn: opp,
        castling,
        enPassant,
        halfMoveClock,
        fullMoveNumber: color === COLOR.BLACK
            ? (prevState.fullMoveNumber ?? 1) + 1
            : (prevState.fullMoveNumber ?? 1),
    };
}

// ─── فحص التهديد والكشف ──────────────────────────────────────────────────────

/**
 * هل المربع (row,col) مُهدَّد من قِبل attackerColor؟
 */
export function isSquareAttacked(board, row, col, attackerColor) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board.get(r, c);
            if (!p || p.color !== attackerColor) continue;
            // attackOnly=true → البيادق تُهدد قطرياً فقط
            const moves = getRawMoves(board, r, c, null, true);
            if (moves.some(m => m.row === row && m.col === col)) return true;
        }
    }
    return false;
}

/** هل الملك في كشف؟ */
export function isInCheck(board, color) {
    const king = board.findKing(color);
    if (!king) return false;
    return isSquareAttacked(board, king.row, king.col, opponent(color));
}

// ─── الحركات القانونية ───────────────────────────────────────────────────────

/**
 * جميع الحركات القانونية لقطعة في (row, col)
 * @returns {object[]} قائمة حركات مع { from, to, flags, piece }
 */
export function getLegalMoves(board, row, col, gameState) {
    const piece = board.get(row, col);
    if (!piece) return [];

    const raw  = getRawMoves(board, row, col, gameState, false);
    const legal = [];

    for (const target of raw) {
        const move = buildMove(row, col, target, piece);

        // فحص خاص بالتبييت
        if (target.flags.includes('castleKing') || target.flags.includes('castleQueen')) {
            if (!isCastlingLegal(board, move, piece.color)) continue;
        }

        // تطبيق الحركة وفحص أنها لا تُبقي الملك في كشف
        const { board: after } = applyMove(board, move);
        if (!isInCheck(after, piece.color)) legal.push(move);
    }

    return legal;
}

/** جميع الحركات القانونية للون كامل */
export function getAllLegalMoves(board, color, gameState) {
    const moves = [];
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            const p = board.get(r, c);
            if (p?.color === color)
                moves.push(...getLegalMoves(board, r, c, gameState));
        }
    return moves;
}

// ─── حالات انتهاء اللعبة ──────────────────────────────────────────────────────

export function isCheckmate(board, color, gameState) {
    return isInCheck(board, color) && getAllLegalMoves(board, color, gameState).length === 0;
}

export function isStalemate(board, color, gameState) {
    return !isInCheck(board, color) && getAllLegalMoves(board, color, gameState).length === 0;
}

/** تعادل بسبب قطع غير كافية */
export function isInsufficientMaterial(board) {
    const pieces = { w: [], b: [] };
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            const p = board.get(r, c);
            if (p) pieces[p.color].push({ type: p.type, col: c, row: r });
        }

    const w = pieces.w, b = pieces.b;

    // ملك ضد ملك
    if (w.length === 1 && b.length === 1) return true;

    // ملك + (فيل أو حصان) ضد ملك
    const isKingPlusMinor = arr =>
        arr.length === 2 &&
        arr.some(p => p.type === TYPE.BISHOP || p.type === TYPE.KNIGHT);

    if (w.length === 1 && isKingPlusMinor(b)) return true;
    if (b.length === 1 && isKingPlusMinor(w)) return true;

    // ملك + فيل ضد ملك + فيل (نفس لون المربع)
    if (w.length === 2 && b.length === 2) {
        const wb = w.find(p => p.type === TYPE.BISHOP);
        const bb = b.find(p => p.type === TYPE.BISHOP);
        if (wb && bb && ((wb.row + wb.col) % 2) === ((bb.row + bb.col) % 2)) return true;
    }

    return false;
}

/** تعادل قاعدة الخمسين حركة */
export function isFiftyMoveRule(gameState) {
    return (gameState?.halfMoveClock ?? 0) >= 100; // 50 حركة لكل لون = 100 نصف حركة
}

/**
 * فحص شامل لحالة اللعبة
 * @returns {'playing'|'check'|'checkmate'|'stalemate'|'insufficient'|'fifty-move'}
 */
export function getGameStatus(board, color, gameState) {
    if (isCheckmate(board, color, gameState))      return 'checkmate';
    if (isStalemate(board, color, gameState))      return 'stalemate';
    if (isInsufficientMaterial(board))             return 'insufficient';
    if (isFiftyMoveRule(gameState))                return 'fifty-move';
    if (isInCheck(board, color))                   return 'check';
    return 'playing';
}

// ─── دوال مساعدة خاصة ────────────────────────────────────────────────────────

function buildMove(row, col, target, piece) {
    return {
        from:  { row, col },
        to:    { row: target.row, col: target.col },
        flags: target.flags,
        piece: { ...piece },
        promotion: null, // يُحدَّد لاحقاً عند الترقية
    };
}

function isCastlingLegal(board, move, color) {
    // لا يجوز التبييت وهو في كشف
    if (isInCheck(board, color)) return false;

    // لا يجوز المرور بمربع مهدَّد
    const passCol = move.flags.includes('castleKing') ? 5 : 3;
    return !isSquareAttacked(board, move.from.row, passCol, opponent(color));
}
