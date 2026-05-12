/**
 * ui/input-desktop.js
 * إدخال الماوس: نقر + سحب وإفلات
 */

import { CHESS_CONFIG } from '../config.js';

export class DesktopInput {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {import('./renderer.js').ChessRenderer} renderer
     * @param {object} callbacks
     * @param {Function} callbacks.onSquareClick  - (row, col) عند النقر على مربع
     * @param {Function} callbacks.onDragStart    - (row, col) عند بدء السحب
     * @param {Function} callbacks.onDragEnd      - (fromRow, fromCol, toRow, toCol) عند الإفلات
     * @param {Function} callbacks.onHover        - (row, col)|null عند التحريك
     */
    constructor(canvas, renderer, callbacks = {}) {
        this._canvas   = canvas;
        this._renderer = renderer;
        this._cb       = callbacks;

        this._dragging    = false;
        this._dragFrom    = null;   // { row, col }
        this._dragCurrent = null;   // { x, y } بكسل

        this._bind();
    }

    _bind() {
        const c = this._canvas;
        this._onMouseDown = this._handleMouseDown.bind(this);
        this._onMouseMove = this._handleMouseMove.bind(this);
        this._onMouseUp   = this._handleMouseUp.bind(this);
        this._onMouseLeave = () => { this._cb.onHover?.(null); };

        c.addEventListener('mousedown',  this._onMouseDown);
        c.addEventListener('mousemove',  this._onMouseMove);
        c.addEventListener('mouseup',    this._onMouseUp);
        c.addEventListener('mouseleave', this._onMouseLeave);
        // منع تحديد النص عند السحب
        c.addEventListener('selectstart', e => e.preventDefault());
    }

    _pos(e) {
        const rect = this._canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (this._canvas.width  / rect.width),
            y: (e.clientY - rect.top)  * (this._canvas.height / rect.height),
        };
    }

    _handleMouseDown(e) {
        if (e.button !== 0) return;       // يسار فقط
        const { x, y } = this._pos(e);
        const sq = this._renderer.pixelToSquare(x, y);
        if (!sq) return;

        this._dragging    = false;
        this._dragFrom    = sq;
        this._dragCurrent = { x, y };

        if (CHESS_CONFIG.allowDrag) {
            this._cb.onDragStart?.(sq.row, sq.col);
        }
    }

    _handleMouseMove(e) {
        const { x, y } = this._pos(e);
        const sq = this._renderer.pixelToSquare(x, y);
        this._cb.onHover?.(sq);

        if (!this._dragFrom) return;

        if (!this._dragging) {
            // نعتبره سحباً بعد تحريك > 4px
            const dx = x - this._dragCurrent.x;
            const dy = y - this._dragCurrent.y;
            if (Math.sqrt(dx * dx + dy * dy) > 4) this._dragging = true;
        }

        if (this._dragging) {
            this._dragCurrent = { x, y };
            this._cb.onDragMove?.(x, y, sq);
        }
    }

    _handleMouseUp(e) {
        const { x, y } = this._pos(e);
        const to = this._renderer.pixelToSquare(x, y);

        if (this._dragging && this._dragFrom && to) {
            // سحب وإفلات
            this._cb.onDragEnd?.(
                this._dragFrom.row, this._dragFrom.col,
                to.row, to.col
            );
        } else if (this._dragFrom) {
            // نقر عادي
            this._cb.onSquareClick?.(this._dragFrom.row, this._dragFrom.col);
        }

        this._dragging    = false;
        this._dragFrom    = null;
        this._dragCurrent = null;
    }

    destroy() {
        const c = this._canvas;
        c.removeEventListener('mousedown',  this._onMouseDown);
        c.removeEventListener('mousemove',  this._onMouseMove);
        c.removeEventListener('mouseup',    this._onMouseUp);
        c.removeEventListener('mouseleave', this._onMouseLeave);
    }
}
