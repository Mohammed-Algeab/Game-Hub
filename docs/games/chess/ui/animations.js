/**
 * ui/animations.js
 * نظام تحريك القطع بـ requestAnimationFrame
 */

import { CHESS_CONFIG } from '../config.js';

export class AnimationManager {
    constructor() {
        this._current = null;   // الحركة الجارية حالياً
        this._rafId   = null;
    }

    /**
     * تحريك قطعة من مربع لآخر
     * @param {object} from      - { row, col }
     * @param {object} to        - { row, col }
     * @param {object} piece     - { type, color }
     * @param {number} squareSize
     * @param {boolean} flipped  - هل الرقعة مقلوبة؟
     * @param {Function} onDraw  - callback لإعادة الرسم — يستقبل state الحركة
     * @param {Function} onDone  - callback عند الانتهاء
     */
    animate(from, to, piece, squareSize, flipped, onDraw, onDone) {
        this.cancel();

        const cfg      = CHESS_CONFIG.animation;
        const startTime = performance.now();

        const fromPx = squareToPixel(from.row, from.col, squareSize, flipped);
        const toPx   = squareToPixel(to.row,   to.col,   squareSize, flipped);

        this._current = { piece, fromPx, toPx, from, to };

        const tick = (now) => {
            const elapsed  = now - startTime;
            const raw      = Math.min(elapsed / cfg.duration, 1);
            const progress = cfg.easing(raw);

            const x = fromPx.x + (toPx.x - fromPx.x) * progress;
            const y = fromPx.y + (toPx.y - fromPx.y) * progress;

            onDraw({ piece, x, y, squareSize, from, to });

            if (raw < 1) {
                this._rafId = requestAnimationFrame(tick);
            } else {
                this._current = null;
                this._rafId   = null;
                onDone?.();
            }
        };

        this._rafId = requestAnimationFrame(tick);
    }

    /** إلغاء الحركة الجارية */
    cancel() {
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId   = null;
            this._current = null;
        }
    }

    get isRunning()    { return this._current !== null; }
    get animatingFrom(){ return this._current?.from ?? null; }
    get animatingTo()  { return this._current?.to   ?? null; }
}

// ─── مساعد: مربع → إحداثيات بكسل (مركز المربع) ─────────────────────────────

export function squareToPixel(row, col, squareSize, flipped = false) {
    const r = flipped ? 7 - row : row;
    const c = flipped ? 7 - col : col;
    return {
        x: c * squareSize + squareSize / 2,
        y: r * squareSize + squareSize / 2,
    };
}

/** إحداثيات بكسل → مربع رقعة */
export function pixelToSquare(px, py, squareSize, flipped = false) {
    const c = Math.floor(px / squareSize);
    const r = Math.floor(py / squareSize);
    if (c < 0 || c > 7 || r < 0 || r > 7) return null;
    return {
        row: flipped ? 7 - r : r,
        col: flipped ? 7 - c : c,
    };
}
