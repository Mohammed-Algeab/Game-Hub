/**
 * ui/input-mobile.js
 * إدخال اللمس للموبايل — نقر فقط (بدون سحب)
 * اللوحة ثابتة على الموبايل مهما كان الدور
 */

export class MobileInput {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {import('./renderer.js').ChessRenderer} renderer
     * @param {object} callbacks
     * @param {Function} callbacks.onSquareClick - (row, col)
     */
    constructor(canvas, renderer, callbacks = {}) {
        this._canvas   = canvas;
        this._renderer = renderer;
        this._cb       = callbacks;

        this._touchStart = null;   // { x, y, time }

        this._bind();
    }

    _bind() {
        this._onTouchStart = this._handleTouchStart.bind(this);
        this._onTouchEnd   = this._handleTouchEnd.bind(this);
        this._onTouchMove  = this._handleTouchMove.bind(this);

        this._canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
        this._canvas.addEventListener('touchend',   this._onTouchEnd,   { passive: false });
        this._canvas.addEventListener('touchmove',  this._onTouchMove,  { passive: false });
    }

    _pos(touch) {
        const rect = this._canvas.getBoundingClientRect();
        return {
            x: (touch.clientX - rect.left) * (this._canvas.width  / rect.width),
            y: (touch.clientY - rect.top)  * (this._canvas.height / rect.height),
        };
    }

    _handleTouchStart(e) {
        e.preventDefault();
        const t = e.changedTouches[0];
        const { x, y } = this._pos(t);
        this._touchStart = { x, y, time: Date.now() };
    }

    _handleTouchMove(e) {
        e.preventDefault(); // منع التمرير أثناء اللعب
    }

    _handleTouchEnd(e) {
        e.preventDefault();
        if (!this._touchStart) return;

        const t = e.changedTouches[0];
        const { x, y } = this._pos(t);

        // نتأكد أنه نقر (لم يتحرك كثيراً)
        const dx = x - this._touchStart.x;
        const dy = y - this._touchStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const elapsed = Date.now() - this._touchStart.time;

        if (dist < 12 && elapsed < 500) {
            const sq = this._renderer.pixelToSquare(x, y);
            if (sq) this._cb.onSquareClick?.(sq.row, sq.col);
        }

        this._touchStart = null;
    }

    destroy() {
        this._canvas.removeEventListener('touchstart', this._onTouchStart);
        this._canvas.removeEventListener('touchend',   this._onTouchEnd);
        this._canvas.removeEventListener('touchmove',  this._onTouchMove);
    }
}
