/**
 * ui/renderer.js
 * رسم رقعة الشطرنج بالكامل على Canvas
 */

import { CHESS_CONFIG }    from '../config.js';
import { pieceSymbol }     from '../core/pieces.js';
import { pixelToSquare }   from './animations.js';

export class ChessRenderer {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {object} [cfg] - تجاوز إعدادات CHESS_CONFIG
     */
    constructor(canvas, cfg = {}) {
        this.canvas  = canvas;
        this.ctx     = canvas.getContext('2d');
        this.cfg     = { ...CHESS_CONFIG, ...cfg };
        this.flipped = false;           // هل الرقعة مقلوبة؟
        this._sq     = this.cfg.squareSize;  // حجم المربع الحالي

        this._resizeObserver = new ResizeObserver(() => this._onResize());
        this._resizeObserver.observe(canvas.parentElement ?? canvas);
        this._onResize();
    }

    // ─── الحجم التكيفي ────────────────────────────────────────────────────────

    _onResize() {
        const container = this.canvas.parentElement ?? document.body;
        const available = Math.min(container.clientWidth, container.clientHeight, window.innerHeight * 0.85);
        const raw = Math.floor(available / 8);
        this._sq  = Math.max(this.cfg.minSquareSize, Math.min(raw, this.cfg.maxSquareSize));

        const size = this._sq * 8;
        this.canvas.width  = size;
        this.canvas.height = size;
        this.canvas.style.width  = size + 'px';
        this.canvas.style.height = size + 'px';

        this._lastRenderArgs && this.render(...this._lastRenderArgs);
    }

    get squareSize() { return this._sq; }

    /** قلب الرقعة */
    flip(flipped) {
        this.flipped = flipped;
        this._lastRenderArgs && this.render(...this._lastRenderArgs);
    }

    // ─── الرسم الرئيسي ────────────────────────────────────────────────────────

    /**
     * رسم كامل للرقعة
     * @param {import('../core/board.js').Board} board
     * @param {import('./highlights.js').HighlightManager} highlights
     * @param {object|null} animState - حالة الحركة من AnimationManager
     */
    render(board, highlights, animState = null) {
        this._lastRenderArgs = [board, highlights, animState];
        const ctx = this.ctx;
        const sq  = this._sq;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this._drawSquares(highlights);
        if (this.cfg.showCoordinates) this._drawCoords();
        this._drawPieces(board, animState);
        if (animState) this._drawAnimatedPiece(animState);
    }

    // ─── رسم المربعات ─────────────────────────────────────────────────────────

    _drawSquares(hl) {
        const ctx = this.ctx;
        const sq  = this._sq;
        const C   = this.cfg.colors;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const { row, col } = this._toBoard(r, c);
                const isLight = (row + col) % 2 === 0;
                const x = c * sq, y = r * sq;

                // لون المربع الأساسي
                ctx.fillStyle = isLight ? C.light : C.dark;
                ctx.fillRect(x, y, sq, sq);

                // آخر حركة
                if (hl?.isLastMove(row, col)) {
                    ctx.fillStyle = isLight ? C.lastFrom : C.lastTo;
                    ctx.fillRect(x, y, sq, sq);
                }

                // كشف الملك
                if (hl?.isCheck(row, col)) {
                    this._drawRadialCheck(x, y, sq);
                }

                // قطعة مختارة
                if (hl?.isSelected(row, col)) {
                    ctx.fillStyle = C.selected;
                    ctx.fillRect(x, y, sq, sq);
                }

                // حركة ممكنة
                const vm = hl?.getValidMove(row, col);
                if (vm) {
                    const isCapture = vm.flags.includes('capture') || vm.flags.includes('enPassant');
                    if (isCapture) {
                        this._drawCaptureRing(x, y, sq, C.validCapture);
                    } else {
                        this._drawDot(x, y, sq, C.validDot);
                    }
                }
            }
        }
    }

    /** تدرج أحمر لمربع الكشف */
    _drawRadialCheck(x, y, sq) {
        const cx = x + sq / 2, cy = y + sq / 2;
        const grad = this.ctx.createRadialGradient(cx, cy, sq * 0.1, cx, cy, sq * 0.6);
        grad.addColorStop(0,   'rgba(220, 50, 50, 0.9)');
        grad.addColorStop(0.6, 'rgba(220, 50, 50, 0.5)');
        grad.addColorStop(1,   'rgba(220, 50, 50, 0)');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(x, y, sq, sq);
    }

    /** نقطة الحركة الممكنة */
    _drawDot(x, y, sq, color) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.arc(x + sq / 2, y + sq / 2, sq * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    }

    /** دائرة الأكل الممكن */
    _drawCaptureRing(x, y, sq, color) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.arc(x + sq / 2, y + sq / 2, sq * 0.46, 0, Math.PI * 2);
        ctx.arc(x + sq / 2, y + sq / 2, sq * 0.36, 0, Math.PI * 2, true);
        ctx.fillStyle = color;
        ctx.fill();
    }

    // ─── رسم الإحداثيات ───────────────────────────────────────────────────────

    _drawCoords() {
        const ctx = this.ctx;
        const sq  = this._sq;
        const C   = this.cfg.colors;
        const fontSize = Math.max(10, Math.round(sq * 0.18));
        ctx.font = `bold ${fontSize}px ${this.cfg.pieceFont}`;

        for (let i = 0; i < 8; i++) {
            const { row, col } = this._toBoard(i, i);
            const isLightOnRank = (i + 0) % 2 === 0;   // لون المربع a-file
            const isLightOnFile = (7 + i) % 2 === 0;   // لون المربع rank-8

            // أرقام الصفوف (يسار)
            ctx.fillStyle = isLightOnRank ? C.coordOnLight : C.coordOnDark;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(String(8 - row), i * sq + 3, i * sq + 2);

            // حروف الأعمدة (يمين أسفل)
            ctx.fillStyle = isLightOnFile ? C.coordOnLight : C.coordOnDark;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(String.fromCharCode(97 + col), (i + 1) * sq - 3, 8 * sq - 2);
        }
    }

    // ─── رسم القطع ────────────────────────────────────────────────────────────

    _drawPieces(board, animState) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const { row, col } = this._toBoard(r, c);
                const piece = board.get(row, col);
                if (!piece) continue;

                // لا نرسم القطعة المتحركة في موضعها الأصلي
                const aFrom = animState?.from;
                if (aFrom && aFrom.row === row && aFrom.col === col) continue;

                this._drawPiece(piece, c * this._sq, r * this._sq, this._sq);
            }
        }
    }

    /** رسم قطعة متحركة فوق الكل */
    _drawAnimatedPiece(animState) {
        const { piece, x, y, squareSize } = animState;
        const sq = squareSize ?? this._sq;
        this._drawPiece(piece, x - sq / 2, y - sq / 2, sq);
    }

    /** رسم قطعة واحدة في موضع بكسل */
    _drawPiece(piece, x, y, sq) {
        const ctx      = this.ctx;
        const symbol   = pieceSymbol(piece);
        const fontSize = Math.round(sq * 0.72);
        ctx.font         = `${fontSize}px ${this.cfg.pieceFont}`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';

        // ظل خفيف للقراءة
        ctx.shadowColor   = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur    = Math.round(sq * 0.08);
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        ctx.fillStyle = '#000';
        ctx.fillText(symbol, x + sq / 2, y + sq / 2);

        ctx.shadowColor   = 'transparent';
        ctx.shadowBlur    = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    // ─── تحويل إحداثيات ──────────────────────────────────────────────────────

    /** إحداثيات الرسم (r,c) → إحداثيات اللوحة مع الأخذ بعين الاعتبار القلب */
    _toBoard(r, c) {
        return this.flipped
            ? { row: 7 - r, col: 7 - c }
            : { row: r, col: c };
    }

    /** إحداثيات بكسل → مربع الرقعة */
    pixelToSquare(px, py) {
        const c = Math.floor(px / this._sq);
        const r = Math.floor(py / this._sq);
        if (c < 0 || c > 7 || r < 0 || r > 7) return null;
        return this._toBoard(r, c);
    }

    // ─── تنظيف ───────────────────────────────────────────────────────────────

    destroy() {
        this._resizeObserver?.disconnect();
    }
}
