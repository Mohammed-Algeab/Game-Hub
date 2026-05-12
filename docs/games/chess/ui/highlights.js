/**
 * ui/highlights.js
 * إدارة الإضاءات على الرقعة
 */

export class HighlightManager {
    constructor() {
        this.reset();
    }

    reset() {
        this.selected    = null;              // { row, col } — المربع المختار
        this.validMoves  = [];                // [{ row, col, flags }] — حركات ممكنة
        this.lastFrom    = null;              // { row, col } — من (آخر حركة)
        this.lastTo      = null;              // { row, col } — إلى  (آخر حركة)
        this.checkSquare = null;             // { row, col } — الملك في كشف
    }

    /** اختيار قطعة وعرض حركاتها الممكنة */
    selectPiece(row, col, legalMoves) {
        this.selected   = { row, col };
        this.validMoves = legalMoves.map(m => ({
            row:   m.to.row,
            col:   m.to.col,
            flags: m.flags,
        }));
    }

    /** إلغاء الاختيار */
    deselect() {
        this.selected   = null;
        this.validMoves = [];
    }

    /** تسجيل آخر حركة */
    setLastMove(from, to) {
        this.lastFrom = { ...from };
        this.lastTo   = { ...to };
    }

    /** تحديد مربع الكشف */
    setCheck(square) {
        this.checkSquare = square ? { ...square } : null;
    }

    /** هل هذا المربع مختار؟ */
    isSelected(row, col) {
        return this.selected?.row === row && this.selected?.col === col;
    }

    /** هل هذا المربع ضمن الحركات الممكنة؟ */
    getValidMove(row, col) {
        return this.validMoves.find(m => m.row === row && m.col === col) ?? null;
    }

    /** هل المربع هو من / إلى آخر حركة؟ */
    isLastMove(row, col) {
        return (this.lastFrom?.row === row && this.lastFrom?.col === col) ||
               (this.lastTo?.row   === row && this.lastTo?.col   === col);
    }

    /** هل الملك في كشف في هذا المربع؟ */
    isCheck(row, col) {
        return this.checkSquare?.row === row && this.checkSquare?.col === col;
    }
}
