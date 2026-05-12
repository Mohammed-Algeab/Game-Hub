/**
 * core/fen.js
 * تحليل وإنتاج FEN — التنسيق القياسي لحالة رقعة الشطرنج
 */

import { Board } from './board.js';
import { COLOR, TYPE, ARABIC_NAME, ARABIC_COLOR } from './pieces.js';

// ─── ثوابت ───────────────────────────────────────────────────────────────────

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** حرف FEN → { type, color } */
const CHAR_TO_PIECE = {
    P: { type: TYPE.PAWN,   color: COLOR.WHITE },
    N: { type: TYPE.KNIGHT, color: COLOR.WHITE },
    B: { type: TYPE.BISHOP, color: COLOR.WHITE },
    R: { type: TYPE.ROOK,   color: COLOR.WHITE },
    Q: { type: TYPE.QUEEN,  color: COLOR.WHITE },
    K: { type: TYPE.KING,   color: COLOR.WHITE },
    p: { type: TYPE.PAWN,   color: COLOR.BLACK },
    n: { type: TYPE.KNIGHT, color: COLOR.BLACK },
    b: { type: TYPE.BISHOP, color: COLOR.BLACK },
    r: { type: TYPE.ROOK,   color: COLOR.BLACK },
    q: { type: TYPE.QUEEN,  color: COLOR.BLACK },
    k: { type: TYPE.KING,   color: COLOR.BLACK },
};

/** { color + type } → حرف FEN */
const PIECE_TO_CHAR = {
    wp:'P', wn:'N', wb:'B', wr:'R', wq:'Q', wk:'K',
    bp:'p', bn:'n', bb:'b', br:'r', bq:'q', bk:'k',
};

// ─── تحليل FEN ───────────────────────────────────────────────────────────────

/**
 * تحليل سلسلة FEN
 * @param {string} fen
 * @returns {{ board: Board, gameState: object }}
 */
export function parseFEN(fen = STARTING_FEN) {
    const parts = fen.trim().split(/\s+/);
    const [position, turn = 'w', castling = '-', enPassant = '-', halfMove = '0', fullMove = '1'] = parts;

    const board = new Board();

    // ملء الرقعة
    const rows = position.split('/');
    for (let r = 0; r < 8; r++) {
        let c = 0;
        for (const ch of (rows[r] ?? '')) {
            if (/\d/.test(ch)) {
                c += parseInt(ch, 10);
            } else {
                const p = CHAR_TO_PIECE[ch];
                if (p) board.set(r, c, { ...p });
                c++;
            }
        }
    }

    const gameState = {
        turn: turn === 'w' ? COLOR.WHITE : COLOR.BLACK,
        castling: {
            [COLOR.WHITE]: {
                kingSide:  castling.includes('K'),
                queenSide: castling.includes('Q'),
            },
            [COLOR.BLACK]: {
                kingSide:  castling.includes('k'),
                queenSide: castling.includes('q'),
            },
        },
        enPassant: parseEnPassant(enPassant),
        halfMoveClock:  parseInt(halfMove,  10) || 0,
        fullMoveNumber: parseInt(fullMove, 10) || 1,
    };

    return { board, gameState };
}

// ─── إنتاج FEN ───────────────────────────────────────────────────────────────

/**
 * تحويل الرقعة وحالة اللعبة إلى سلسلة FEN
 */
export function boardToFEN(board, gameState) {
    // القطع
    let position = '';
    for (let r = 0; r < 8; r++) {
        let empty = 0;
        for (let c = 0; c < 8; c++) {
            const p = board.get(r, c);
            if (!p) {
                empty++;
            } else {
                if (empty) { position += empty; empty = 0; }
                position += PIECE_TO_CHAR[p.color + p.type] ?? '?';
            }
        }
        if (empty) position += empty;
        if (r < 7) position += '/';
    }

    // الدور
    const turn = gameState.turn === COLOR.WHITE ? 'w' : 'b';

    // التبييت
    let castling = '';
    if (gameState.castling?.[COLOR.WHITE]?.kingSide)  castling += 'K';
    if (gameState.castling?.[COLOR.WHITE]?.queenSide) castling += 'Q';
    if (gameState.castling?.[COLOR.BLACK]?.kingSide)  castling += 'k';
    if (gameState.castling?.[COLOR.BLACK]?.queenSide) castling += 'q';
    if (!castling) castling = '-';

    // En passant
    const ep = gameState.enPassant
        ? Board.toAlgebraic(gameState.enPassant.row, gameState.enPassant.col)
        : '-';

    return `${position} ${turn} ${castling} ${ep} ${gameState.halfMoveClock ?? 0} ${gameState.fullMoveNumber ?? 1}`;
}

// ─── وصف بالعربية (لزر النصيحة) ─────────────────────────────────────────────

/**
 * تحويل FEN إلى نص عربي مقروء — يُرسَل للـ AI
 */
export function fenToArabicDescription(fen) {
    const { board, gameState } = parseFEN(fen);
    const lines = [];

    lines.push(`الدور: ${ARABIC_COLOR[gameState.turn]}`);
    lines.push('');
    lines.push('القطع على الرقعة:');

    for (let r = 0; r < 8; r++) {
        const rankNum = 8 - r;
        for (let c = 0; c < 8; c++) {
            const p = board.get(r, c);
            if (!p) continue;
            const file = String.fromCharCode(97 + c);
            const colorAr = ARABIC_COLOR[p.color];
            const typeAr  = ARABIC_NAME[p.type];
            lines.push(`  ${typeAr} ${colorAr} في ${file}${rankNum}`);
        }
    }

    // التبييت
    const wCastle = [];
    const bCastle = [];
    if (gameState.castling?.[COLOR.WHITE]?.kingSide)  wCastle.push('قصير');
    if (gameState.castling?.[COLOR.WHITE]?.queenSide) wCastle.push('طويل');
    if (gameState.castling?.[COLOR.BLACK]?.kingSide)  bCastle.push('قصير');
    if (gameState.castling?.[COLOR.BLACK]?.queenSide) bCastle.push('طويل');

    lines.push('');
    if (wCastle.length) lines.push(`التبييت المتاح للأبيض: ${wCastle.join(', ')}`);
    if (bCastle.length) lines.push(`التبييت المتاح للأسود: ${bCastle.join(', ')}`);

    if (gameState.enPassant) {
        const sq = Board.toAlgebraic(gameState.enPassant.row, gameState.enPassant.col);
        lines.push(`الأكل بالمرور المتاح: ${sq}`);
    }

    return lines.join('\n');
}

// ─── مساعد خاص ───────────────────────────────────────────────────────────────

function parseEnPassant(str) {
    if (!str || str === '-') return null;
    return Board.fromAlgebraic(str);
}
