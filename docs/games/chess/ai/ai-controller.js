/**
 * ai/ai-controller.js
 * يتحكم في سير اللعبة ضد الكمبيوتر
 * اللاعب = أبيض دائماً، AI = أسود
 */

import { COLOR }              from '../core/pieces.js';
import { getLegalMoves, applyMove,
         nextGameState, getGameStatus,
         isInCheck }          from '../core/rules.js';
import { parseFEN, STARTING_FEN, boardToFEN } from '../core/fen.js';
import { MoveHistory }        from '../core/history.js';
import { HighlightManager }   from '../ui/highlights.js';
import { AnimationManager }   from '../ui/animations.js';
import { DesktopInput }       from '../ui/input-desktop.js';
import { MobileInput }        from '../ui/input-mobile.js';
import { findMoveForDifficulty } from './search.js';
import { AdviceButton }       from './advice-button.js';
import { CHESS_CONFIG }       from '../config.js';

const PLAYER_COLOR = COLOR.WHITE;
const AI_COLOR     = COLOR.BLACK;

export class AIController {
    /**
     * @param {object} options
     * @param {HTMLCanvasElement}   options.canvas
     * @param {ChessRenderer}       options.renderer
     * @param {object}              options.ui       - { statusEl, moveListEl }
     * @param {string}              options.difficulty - 'easy'|'medium'|'hard'|'expert'
     * @param {string}              options.endpoint  - Worker URL للنصيحة
     * @param {Function}            options.onGameOver
     */
    constructor({ canvas, renderer, ui, difficulty = 'medium', endpoint, onGameOver, onStateChange }) {
        this._canvas     = canvas;
        this._renderer   = renderer;
        this._ui         = ui;
        this._difficulty = difficulty;
        this._onGameOver = onGameOver;
        this._onStateChange = onStateChange;

        this._hl      = new HighlightManager();
        this._anim    = new AnimationManager();
        this._history = new MoveHistory();

        this._isMobile = window.matchMedia('(pointer: coarse)').matches;
        this._aiThinking = false;
        this._selected   = null;

        let parsed = parseFEN(STARTING_FEN);
        this._board     = parsed.board;
        this._gameState = parsed.gameState;

        this._setupInput();
        this._render();
        this._updateUI();
        this._onStateChange?.(this.currentFEN, this._history);

        // زر النصيحة (اختياري)
        const btnEl = document.getElementById('btn-advice');
        const outEl = document.getElementById('advice-box');
        if (btnEl && outEl && endpoint) {
            this._advice = new AdviceButton({
                buttonEl:    btnEl,
                outputEl:    outEl,
                getBoard:    () => this._board,
                getGameState:() => this._gameState,
                getHistory:  () => this._history,
                endpoint,
            });
        }
    }

    // ─── إدخال ───────────────────────────────────────────────────────────────

    _setupInput() {
        const cb = {
            onSquareClick: (r, c) => this._handleClick(r, c),
            onDragStart:   (r, c) => this._handleClick(r, c),
            onDragEnd:     (fr, fc, tr, tc) => {
                if (this._selected) this._handleClick(tr, tc);
            },
        };
        this._input = this._isMobile
            ? new MobileInput(this._canvas, this._renderer, cb)
            : new DesktopInput(this._canvas, this._renderer, cb);
    }

    _handleClick(row, col) {
        if (this._anim.isRunning)          return;
        if (this._aiThinking)              return;
        if (this._gameState.turn !== PLAYER_COLOR) return;

        const piece = this._board.get(row, col);

        if (this._selected) {
            const move = this._selected.moves.find(
                m => m.to.row === row && m.to.col === col
            );
            if (move) { this._executePlayerMove(move); return; }

            if (piece?.color === PLAYER_COLOR) {
                this._selectPiece(row, col); return;
            }
            this._deselect();
            this._render();
            return;
        }

        if (piece?.color === PLAYER_COLOR) this._selectPiece(row, col);
    }

    _selectPiece(row, col) {
        const moves = getLegalMoves(this._board, row, col, this._gameState);
        this._selected = { row, col, moves };
        this._hl.selectPiece(row, col, moves);
        this._render();
    }

    _deselect() {
        this._selected = null;
        this._hl.deselect();
    }

    // ─── تنفيذ حركة اللاعب ───────────────────────────────────────────────────

    _executePlayerMove(move) {
        this._deselect();

        if (move.flags.includes('promotion')) {
            move = { ...move, promotion: 'q' }; // ترقية تلقائية للوزير (يمكن تحسينها)
        }

        this._commitMove(move, () => {
            // بعد حركة اللاعب، يفكر AI
            if (!this._isGameOver()) {
                setTimeout(() => this._aiMove(), 300);
            }
        });
    }

    // ─── حركة AI ────────────────────────────────────────────────────────────

    async _aiMove() {
        if (this._aiThinking || this._gameState.turn !== AI_COLOR) return;
        this._aiThinking = true;
        this._updateStatus('🤖 AI يفكر...');

        // نفّذ البحث في الخلفية لتجنب تجميد الواجهة
        await new Promise(resolve => setTimeout(resolve, 50));

        const result = findMoveForDifficulty(this._board, this._gameState, this._difficulty);
        this._aiThinking = false;

        if (!result?.move) return;

        this._commitMove(result.move, () => {});
    }

    // ─── تنفيذ حركة (مشترك) ──────────────────────────────────────────────────

    _commitMove(move, onDone) {
        const boardBefore = this._board;
        const gsBefore    = this._gameState;

        const { board: newBoard } = applyMove(boardBefore, move);
        const newGS = nextGameState(boardBefore, move, gsBefore);

        this._history.push(move, boardBefore, gsBefore);

        this._anim.animate(
            move.from, move.to, move.piece,
            this._renderer.squareSize, false,
            animState => this._renderer.render(boardBefore, this._hl, animState),
            () => {
                this._board     = newBoard;
                this._gameState = newGS;

                this._hl.setLastMove(move.from, move.to);
                this._hl.setCheck(
                    isInCheck(newBoard, newGS.turn)
                        ? newBoard.findKing(newGS.turn)
                        : null
                );

                this._render();
                this._updateUI();
                this._onStateChange?.(this.currentFEN, this._history);

                const status = getGameStatus(newBoard, newGS.turn, newGS);
                if (status !== 'playing' && status !== 'check') {
                    const winner = status === 'checkmate'
                        ? (newGS.turn === COLOR.WHITE ? AI_COLOR : PLAYER_COLOR)
                        : null;
                    this._onGameOver?.(status, winner);
                }

                onDone();
            }
        );
    }

    // ─── التحكم ──────────────────────────────────────────────────────────────

    newGame() {
        this._anim.cancel();
        const parsed = parseFEN(STARTING_FEN);
        this._board      = parsed.board;
        this._gameState  = parsed.gameState;
        this._history.clear();
        this._selected   = null;
        this._aiThinking = false;
        this._hl.reset();
        this._render();
        this._updateUI();
        this._onStateChange?.(this.currentFEN, this._history);
        document.getElementById('advice-box')?.classList.add('hidden');
    }

    setDifficulty(level) {
        this._difficulty = level;
    }

    // ─── UI ──────────────────────────────────────────────────────────────────

    _isGameOver() {
        const s = getGameStatus(this._board, this._gameState.turn, this._gameState);
        return s !== 'playing' && s !== 'check';
    }

    _render() {
        this._renderer.render(this._board, this._hl);
    }

    _updateUI() {
        this._updateStatus();
        this._updateMoveList();
    }

    _updateStatus(override) {
        const el = this._ui?.statusEl;
        if (!el) return;
        if (override) { el.textContent = override; return; }

        const status   = getGameStatus(this._board, this._gameState.turn, this._gameState);
        const isPlayer = this._gameState.turn === PLAYER_COLOR;
        const turnLabel = isPlayer ? 'دورك ♙' : '🤖 AI';

        const messages = {
            playing:      turnLabel,
            check:        isPlayer ? '⚠️ أنت في كشف!' : '⚠️ AI في كشف!',
            checkmate:    `🏆 ${isPlayer ? 'فاز AI' : 'فزت!'} — كش مات`,
            stalemate:    '🤝 تعادل — وقفة!',
            insufficient: '🤝 تعادل — قطع غير كافية',
            'fifty-move': '🤝 تعادل — قاعدة الخمسين',
        };
        el.textContent = messages[status] ?? turnLabel;
    }

    _updateMoveList() {
        const el = this._ui?.moveListEl;
        if (!el) return;
        const san = this._history.toSANList();
        let html  = '';
        for (let i = 0; i < san.length; i += 2) {
            const num = Math.floor(i / 2) + 1;
            html += `<div class="move-row">
                <span class="move-num">${num}.</span>
                <span class="move-w">${san[i]   ?? ''}</span>
                <span class="move-b">${san[i+1] ?? ''}</span>
            </div>`;
        }
        el.innerHTML = html;
        el.scrollTop = el.scrollHeight;
    }

    // ─── بيانات خارجية ───────────────────────────────────────────────────────

    get currentFEN()  { return this._board && this._gameState ? boardToFEN(this._board, this._gameState) : ''; }
    get moveHistory() { return this._history; }

    destroy() {
        this._input?.destroy();
        this._anim.cancel();
    }
}
