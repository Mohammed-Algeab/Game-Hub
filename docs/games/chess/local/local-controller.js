/**
 * local/local-controller.js
 * يتحكم في سير اللعب المحلي 1v1
 * يربط: board logic ↔ UI (renderer, highlights, anim) ↔ session
 */

import { COLOR, TYPE, opponent }   from '../core/pieces.js';
import { getLegalMoves, applyMove,
         nextGameState, getGameStatus,
         isInCheck }               from '../core/rules.js';
import { HighlightManager }        from '../ui/highlights.js';
import { AnimationManager }        from '../ui/animations.js';
import { DesktopInput }            from '../ui/input-desktop.js';
import { MobileInput }             from '../ui/input-mobile.js';
import { LocalSession }            from './local-session.js';
import { CHESS_CONFIG }            from '../config.js';

export class LocalController {
    /**
     * @param {object} options
     * @param {HTMLCanvasElement}                    options.canvas
     * @param {import('../ui/renderer.js').ChessRenderer} options.renderer
     * @param {object}   options.ui               - { statusEl, moveListEl, timerEl? }
     * @param {Function} options.onGameOver        - (status, winner) callback
     * @param {Function} options.onMoveRecorded    - () callback بعد كل حركة
     * @param {Function} options.onStateChange     - (fen, history) callback عند تغيّر الحالة
     */
    constructor({ canvas, renderer, ui, onGameOver, onMoveRecorded, onStateChange }) {
        this._canvas   = canvas;
        this._renderer = renderer;
        this._ui       = ui;
        this._onGameOver      = onGameOver;
        this._onMoveRecorded  = onMoveRecorded;
        this._onStateChange   = onStateChange;

        this._hl      = new HighlightManager();
        this._anim    = new AnimationManager();
        this._session = new LocalSession();

        this._selected        = null;   // { row, col, moves[] }
        this._pendingPromotion = null;  // الحركة المعلقة ريثما يختار اللاعب قطعة الترقية
        this._isMobile        = window.matchMedia('(pointer: coarse)').matches;

        this._setupInput();
        this._render();
        this._updateUI();
        this._onStateChange?.(this.currentFEN, this._session.history);
    }

    // ─── إعداد الإدخال ───────────────────────────────────────────────────────

    _setupInput() {
        const cb = {
            onSquareClick: (r, c) => this._handleClick(r, c),
            onDragStart:   (r, c) => this._handleClick(r, c),
            onDragEnd:     (fr, fc, tr, tc) => {
                if (this._selected) this._handleClick(tr, tc);
            },
        };

        if (this._isMobile) {
            this._input = new MobileInput(this._canvas, this._renderer, cb);
        } else {
            this._input = new DesktopInput(this._canvas, this._renderer, cb);
        }
    }

    // ─── منطق النقر ──────────────────────────────────────────────────────────

    _handleClick(row, col) {
        if (this._anim.isRunning)       return;
        if (this._pendingPromotion)     return;
        if (this._session.isOver)       return;

        const { board, gameState } = this._session;
        const piece = board.get(row, col);

        // ── هل هناك قطعة مختارة؟ ──
        if (this._selected) {
            const move = this._selected.moves.find(
                m => m.to.row === row && m.to.col === col
            );

            if (move) {
                this._tryExecute(move);
                return;
            }

            // نقر على قطعة أخرى من نفس اللون → تغيير الاختيار
            if (piece && piece.color === gameState.turn) {
                this._selectPiece(row, col);
                return;
            }

            // نقر على مربع فارغ أو قطعة خصم غير مستهدفة → إلغاء
            this._deselect();
            this._render();
            return;
        }

        // ── اختيار قطعة ──
        if (piece && piece.color === gameState.turn) {
            this._selectPiece(row, col);
        }
    }

    _selectPiece(row, col) {
        const moves = getLegalMoves(this._session.board, row, col, this._session.gameState);
        this._selected = { row, col, moves };
        this._hl.selectPiece(row, col, moves);
        this._render();
    }

    _deselect() {
        this._selected = null;
        this._hl.deselect();
    }

    // ─── تنفيذ الحركة ────────────────────────────────────────────────────────

    _tryExecute(move) {
        this._deselect();

        if (move.flags.includes('promotion')) {
            // أوقف اللعب ريثما يختار اللاعب قطعة الترقية
            this._pendingPromotion = move;
            this._showPromotionDialog(move.piece.color);
            this._render();
            return;
        }

        this._executeMove(move);
    }

    _executeMove(move) {
        const { board: boardBefore, gameState: gsBefore } = this._session;

        // تطبيق الحركة
        const { board: newBoard, captured } = applyMove(boardBefore, move);
        const newGS = nextGameState(boardBefore, move, gsBefore);

        // تسجيل في الجلسة
        this._session.recordMove(move, boardBefore, gsBefore, captured);

        // تشغيل الانيميشن
        this._anim.animate(
            move.from, move.to, move.piece,
            this._renderer.squareSize,
            this._renderer.flipped,
            (animState) => {
                // رسم مؤقت أثناء الحركة
                this._renderer.render(boardBefore, this._hl, animState);
            },
            () => {
                // اكتملت الحركة
                const status = getGameStatus(newBoard, newGS.turn, newGS);
                const winner = status === 'checkmate' ? opponent(newGS.turn) : null;

                this._session.update(newBoard, newGS, status, winner);

                // تحديث الإضاءات
                this._hl.setLastMove(move.from, move.to);
                this._hl.setCheck(
                    isInCheck(newBoard, newGS.turn)
                        ? newBoard.findKing(newGS.turn)
                        : null
                );

                // قلب الرقعة على الديسكتوب فقط
                if (!this._isMobile && CHESS_CONFIG.flipOnBlack) {
                    this._renderer.flip(newGS.turn === COLOR.BLACK);
                }

                this._render();
                this._updateUI();
                this._onMoveRecorded?.();
                this._onStateChange?.(this.currentFEN, this._session.history);

                if (status !== 'playing' && status !== 'check') {
                    this._onGameOver?.(status, winner);
                }
            }
        );
    }

    // ─── ترقية البيدق ────────────────────────────────────────────────────────

    _showPromotionDialog(color) {
        const dlg = document.getElementById('promotion-dialog');
        if (!dlg) return;

        const symbols = color === COLOR.WHITE
            ? { q:'♕', r:'♖', b:'♗', n:'♘' }
            : { q:'♛', r:'♜', b:'♝', n:'♞' };

        dlg.querySelectorAll('.prom-btn').forEach(btn => {
            const t = btn.dataset.type;
            btn.textContent = symbols[t];
        });

        dlg.classList.remove('hidden');

        // إزالة listener القديم وإضافة جديد
        const newDlg = dlg.cloneNode(true);
        dlg.parentNode.replaceChild(newDlg, dlg);

        newDlg.addEventListener('click', (e) => {
            const btn = e.target.closest('.prom-btn');
            if (!btn || !this._pendingPromotion) return;

            const move = { ...this._pendingPromotion, promotion: btn.dataset.type };
            this._pendingPromotion = null;
            newDlg.classList.add('hidden');
            this._executeMove(move);
        });
    }

    // ─── أوامر خارجية ────────────────────────────────────────────────────────

    undo() {
        if (this._anim.isRunning || this._session.history.isEmpty) return;

        this._session.undo();
        this._selected = null;
        this._hl.reset();

        // استعادة إضاءة آخر حركة
        const last = this._session.lastMove;
        if (last) this._hl.setLastMove(last.from, last.to);

        // فحص الكشف
        const { board, gameState } = this._session;
        this._hl.setCheck(
            isInCheck(board, gameState.turn) ? board.findKing(gameState.turn) : null
        );

        // إعادة ضبط قلب الرقعة
        if (!this._isMobile && CHESS_CONFIG.flipOnBlack) {
            this._renderer.flip(gameState.turn === COLOR.BLACK);
        }

        this._render();
        this._updateUI();
        this._onStateChange?.(this.currentFEN, this._session.history);
    }

    newGame() {
        this._anim.cancel();
        this._session.newGame();
        this._selected         = null;
        this._pendingPromotion = null;
        this._hl.reset();
        this._renderer.flip(false);
        this._render();
        this._updateUI();
        this._onStateChange?.(this.currentFEN, this._session.history);
        document.getElementById('promotion-dialog')?.classList.add('hidden');
    }

    // ─── الرسم وتحديث UI ─────────────────────────────────────────────────────

    _render() {
        this._renderer.render(this._session.board, this._hl);
    }

    _updateUI() {
        this._updateStatus();
        this._updateMoveList();
    }

    _updateStatus() {
        const el = this._ui?.statusEl;
        if (!el) return;

        const { status, winner, gameState } = this._session;
        const turnAr = gameState.turn === COLOR.WHITE ? 'الأبيض' : 'الأسود';
        const winnerAr = winner === COLOR.WHITE ? 'الأبيض' : 'الأسود';

        const messages = {
            playing:      `♟ دور ${turnAr}`,
            check:        `⚠️ كشف على ${turnAr}!`,
            checkmate:    `🏆 كش مات! فاز ${winnerAr}`,
            stalemate:    '🤝 تعادل — وقفة!',
            insufficient: '🤝 تعادل — قطع غير كافية',
            'fifty-move': '🤝 تعادل — قاعدة الخمسين',
        };

        el.textContent = messages[status] ?? `دور ${turnAr}`;
    }

    _updateMoveList() {
        const el = this._ui?.moveListEl;
        if (!el) return;

        const san = this._session.history.toSANList();
        let html  = '';

        for (let i = 0; i < san.length; i += 2) {
            const num = Math.floor(i / 2) + 1;
            html += `
                <div class="move-row">
                    <span class="move-num">${num}.</span>
                    <span class="move-w">${san[i]   ?? ''}</span>
                    <span class="move-b">${san[i+1] ?? ''}</span>
                </div>`;
        }

        el.innerHTML  = html;
        el.scrollTop  = el.scrollHeight;
    }

    // ─── بيانات للخارج (AI advice) ───────────────────────────────────────────

    get currentFEN()    { return this._session.currentFEN; }
    get moveHistory()   { return this._session.history; }
    get session()       { return this._session; }

    // ─── تنظيف ───────────────────────────────────────────────────────────────

    destroy() {
        this._input?.destroy();
        this._anim.cancel();
    }
}
