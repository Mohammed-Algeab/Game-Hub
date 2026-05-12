/**
 * core/board.js
 * رقعة الشطرنج — شبكة 8×8
 *
 * نظام الإحداثيات:
 *   row 0 = الصف 8 (الجانب الأسود)
 *   row 7 = الصف 1 (الجانب الأبيض)
 *   col 0 = العمود a  ،  col 7 = العمود h
 */

import { makePiece, TYPE, COLOR } from './pieces.js';

export class Board {
    constructor() {
        /** @type {Array<Array<{type:string,color:string}|null>>} */
        this._grid = Array.from({ length: 8 }, () => Array(8).fill(null));
    }

    // ─── قراءة / كتابة ──────────────────────────────────────────────────────

    get(row, col) {
        return this._grid[row]?.[col] ?? null;
    }

    set(row, col, piece) {
        this._grid[row][col] = piece;
    }

    remove(row, col) {
        this._grid[row][col] = null;
    }

    /** هل الإحداثيات داخل الرقعة؟ */
    inBounds(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    // ─── نسخ ────────────────────────────────────────────────────────────────

    clone() {
        const b = new Board();
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++) {
                const p = this._grid[r][c];
                b._grid[r][c] = p ? { ...p } : null;
            }
        return b;
    }

    // ─── حركة قطعة ──────────────────────────────────────────────────────────

    /**
     * نقل قطعة من (r1,c1) إلى (r2,c2)
     * @returns {object|null} القطعة المأخوذة (إن وجدت)
     */
    movePiece(r1, c1, r2, c2) {
        const captured = this._grid[r2][c2];
        this._grid[r2][c2] = this._grid[r1][c1];
        this._grid[r1][c1] = null;
        return captured ?? null;
    }

    // ─── بحث ────────────────────────────────────────────────────────────────

    /** إيجاد موقع الملك */
    findKing(color) {
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++) {
                const p = this._grid[r][c];
                if (p?.type === TYPE.KING && p.color === color)
                    return { row: r, col: c };
            }
        return null;
    }

    /** جميع قطع لون معين مع مواقعها */
    getPieces(color) {
        const list = [];
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++) {
                const p = this._grid[r][c];
                if (p && (!color || p.color === color))
                    list.push({ piece: p, row: r, col: c });
            }
        return list;
    }

    // ─── الوضع الابتدائي ─────────────────────────────────────────────────────

    /** ترتيب قطع بداية اللعبة */
    setupInitial() {
        const W = COLOR.WHITE, B = COLOR.BLACK;
        const { PAWN: P, KNIGHT: N, BISHOP: Bi, ROOK: R, QUEEN: Q, KING: K } = TYPE;
        const back = [R, N, Bi, Q, K, Bi, N, R];

        for (let c = 0; c < 8; c++) {
            this.set(0, c, makePiece(back[c], B));   // صف 8 — أسود
            this.set(1, c, makePiece(P, B));           // صف 7 — بيادق سوداء
            this.set(6, c, makePiece(P, W));           // صف 2 — بيادق بيضاء
            this.set(7, c, makePiece(back[c], W));    // صف 1 — أبيض
        }
        return this;
    }

    // ─── أدوات مساعدة ───────────────────────────────────────────────────────

    /** تحويل row/col إلى تدوين الشطرنج مثل "e4" */
    static toAlgebraic(row, col) {
        return String.fromCharCode(97 + col) + (8 - row);
    }

    /** تحويل تدوين الشطرنج مثل "e4" إلى { row, col } */
    static fromAlgebraic(sq) {
        return {
            col: sq.charCodeAt(0) - 97,
            row: 8 - parseInt(sq[1]),
        };
    }

    /** طباعة نصية للتشخيص */
    toString() {
        const CHARS = {
            wp:'P',wn:'N',wb:'B',wr:'R',wq:'Q',wk:'K',
            bp:'p',bn:'n',bb:'b',br:'r',bq:'q',bk:'k',
        };
        return this._grid.map((row, r) =>
            (8 - r) + ' ' + row.map(p => p ? CHARS[p.color + p.type] : '.').join(' ')
        ).join('\n') + '\n  a b c d e f g h';
    }
}
