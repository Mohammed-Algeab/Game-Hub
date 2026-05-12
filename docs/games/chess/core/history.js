/**
 * core/history.js
 * سجل الحركات — التدوين الجبري القياسي (SAN) وإمكانية التراجع
 */

import { COLOR, TYPE, ARABIC_NAME, ARABIC_COLOR } from './pieces.js';
import { Board } from './board.js';
import { getLegalMoves, getAllLegalMoves } from './rules.js';
import { boardToFEN } from './fen.js';

// ─── كلاس السجل ──────────────────────────────────────────────────────────────

export class MoveHistory {
    constructor() {
        /**
         * @type {Array<{
         *   move:       object,
         *   boardBefore:     import('./board.js').Board,
         *   gameStateBefore: object,
         *   san:        string,
         *   fen:        string,
         *   captured:   object|null,
         * }>}
         */
        this._entries = [];
    }

    // ─── خصائص ───────────────────────────────────────────────────────────────

    get length()  { return this._entries.length; }
    get isEmpty() { return this._entries.length === 0; }
    get last()    { return this._entries[this._entries.length - 1] ?? null; }
    get all()     { return [...this._entries]; }

    // ─── إضافة وحذف ─────────────────────────────────────────────────────────

    /**
     * تسجيل حركة
     * @param {object} move       - الحركة { from, to, flags, piece }
     * @param {Board}  boardBefore - الرقعة قبل تنفيذ الحركة
     * @param {object} gameStateBefore
     * @param {object|null} captured - القطعة المأخوذة (إن وجدت)
     */
    push(move, boardBefore, gameStateBefore, captured = null) {
        const san = toSAN(move, boardBefore, gameStateBefore);
        const fen = boardToFEN(boardBefore, gameStateBefore);
        this._entries.push({ move, boardBefore, gameStateBefore, san, fen, captured });
    }

    /** حذف آخر حركة مسجلة (للتراجع) */
    pop() {
        return this._entries.pop() ?? null;
    }

    clear() {
        this._entries = [];
    }

    // ─── تصدير للـ AI ────────────────────────────────────────────────────────

    /**
     * قائمة الحركات بتدوين SAN (للـ AI)
     * مثال: ['e4', 'e5', 'Nf3', 'Nc6']
     */
    toSANList() {
        return this._entries.map(e => e.san);
    }

    /**
     * حركات بالتدوين الكامل PGN
     * مثال: "1. e4 e5 2. Nf3 Nc6"
     */
    toPGN() {
        let pgn = '';
        for (let i = 0; i < this._entries.length; i++) {
            if (i % 2 === 0) pgn += `${Math.floor(i / 2) + 1}. `;
            pgn += this._entries[i].san + ' ';
        }
        return pgn.trim();
    }

    /**
     * وصف عربي للحركات الأخيرة — يُرسَل للـ AI مع زر النصيحة
     * @param {number} n آخر n حركة (افتراضي 10)
     */
    toArabicSummary(n = 10) {
        if (this._entries.length === 0) return 'لا توجد حركات سابقة بعد.';

        const recent = this._entries.slice(-n);
        const offset = this._entries.length - recent.length;

        return recent.map((e, i) => {
            const globalIdx = offset + i;
            const moveNum   = Math.floor(globalIdx / 2) + 1;
            const colorAr   = ARABIC_COLOR[e.move.piece.color];
            const typeAr    = ARABIC_NAME[e.move.piece.type];
            const from      = Board.toAlgebraic(e.move.from.row, e.move.from.col);
            const to        = Board.toAlgebraic(e.move.to.row,   e.move.to.col);
            const extra     = e.move.flags.includes('capture')   ? ' (أكل)' :
                              e.move.flags.includes('castleKing') ? ' (تبييت قصير)' :
                              e.move.flags.includes('castleQueen')? ' (تبييت طويل)' : '';
            return `${moveNum}. ${colorAr} — ${typeAr} من ${from} إلى ${to}${extra}`;
        }).join('\n');
    }

    /**
     * FEN الموقف الحالي (آخر سجل)
     * إذا لم تكن هناك حركات تُعاد null
     */
    getCurrentFEN() {
        return this.last?.fen ?? null;
    }
}

// ─── تدوين SAN ───────────────────────────────────────────────────────────────

/**
 * تحويل حركة إلى تدوين SAN مع التمييز الكامل
 */
function toSAN(move, board, gameState) {
    const { from, to, flags, piece, promotion } = move;

    // تبييت
    if (flags.includes('castleKing'))  return 'O-O';
    if (flags.includes('castleQueen')) return 'O-O-O';

    const toSq   = Board.toAlgebraic(to.row, to.col);
    const isCapt = flags.includes('capture') || flags.includes('enPassant');

    // البيدق
    if (piece.type === TYPE.PAWN) {
        let san = '';
        if (isCapt) san += String.fromCharCode(97 + from.col) + 'x';
        san += toSq;
        if (flags.includes('promotion')) {
            const promo = { q:'Q', r:'R', b:'B', n:'N' }[promotion ?? TYPE.QUEEN];
            san += '=' + promo;
        }
        return san;
    }

    // باقي القطع
    const prefix = { n:'N', b:'B', r:'R', q:'Q', k:'K' }[piece.type] ?? '';
    const disambig = getDisambiguation(board, move, gameState);
    const capture  = isCapt ? 'x' : '';

    return prefix + disambig + capture + toSq;
}

/**
 * تمييز الحركة عندما تستطيع أكثر من قطعة من نفس النوع الوصول للمربع نفسه
 */
function getDisambiguation(board, move, gameState) {
    const { from, to, piece } = move;

    // جميع القطع الأخرى من نفس النوع واللون
    const siblings = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (r === from.row && c === from.col) continue;
            const p = board.get(r, c);
            if (!p || p.type !== piece.type || p.color !== piece.color) continue;
            const legal = getLegalMoves(board, r, c, gameState);
            if (legal.some(m => m.to.row === to.row && m.to.col === to.col))
                siblings.push({ row: r, col: c });
        }
    }

    if (siblings.length === 0) return '';

    const sameFile = siblings.some(s => s.col === from.col);
    const sameRank = siblings.some(s => s.row === from.row);

    if (!sameFile) return String.fromCharCode(97 + from.col);          // عمود كافٍ
    if (!sameRank) return String(8 - from.row);                        // صف كافٍ
    return String.fromCharCode(97 + from.col) + String(8 - from.row); // كلاهما
}
