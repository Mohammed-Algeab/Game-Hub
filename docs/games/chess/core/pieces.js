/**
 * core/pieces.js
 * ثوابت القطع والألوان — لا توجد تبعيات
 */

export const COLOR = Object.freeze({ WHITE: 'w', BLACK: 'b' });

export const TYPE = Object.freeze({
    PAWN:   'p',
    KNIGHT: 'n',
    BISHOP: 'b',
    ROOK:   'r',
    QUEEN:  'q',
    KING:   'k',
});

/** رموز Unicode للقطع */
export const UNICODE = Object.freeze({
    wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
    bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚',
});

/** أسماء القطع بالعربية */
export const ARABIC_NAME = Object.freeze({
    p: 'بيدق',
    n: 'حصان',
    b: 'فيل',
    r: 'رخ',
    q: 'وزير',
    k: 'ملك',
});

/** أسماء الألوان بالعربية */
export const ARABIC_COLOR = Object.freeze({
    w: 'أبيض',
    b: 'أسود',
});

/** إنشاء قطعة */
export function makePiece(type, color) {
    return { type, color };
}

/** مفتاح القطعة (مثلاً 'wp' أو 'bk') */
export function pieceKey(piece) {
    return piece ? piece.color + piece.type : null;
}

/** رمز Unicode للقطعة */
export function pieceSymbol(piece) {
    return piece ? (UNICODE[pieceKey(piece)] ?? '') : '';
}

/** اللون المقابل */
export function opponent(color) {
    return color === COLOR.WHITE ? COLOR.BLACK : COLOR.WHITE;
}

/** هل القطعة بيضاء؟ */
export function isWhite(piece) {
    return piece?.color === COLOR.WHITE;
}

/** هل القطعتان من نفس اللون؟ */
export function sameColor(a, b) {
    return a && b && a.color === b.color;
}
