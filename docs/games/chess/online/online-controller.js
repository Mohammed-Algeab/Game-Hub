/**
 * online/online-controller.js
 * يربط RoomClient بـ Chess Core وUI لإنتاج تجربة أونلاين كاملة
 */

import { COLOR }                    from '../core/pieces.js';
import { parseFEN, boardToFEN, STARTING_FEN } from '../core/fen.js';
import { getLegalMoves, applyMove,
         nextGameState, getGameStatus,
         isInCheck }                from '../core/rules.js';
import { MoveHistory }              from '../core/history.js';
import { HighlightManager }         from '../ui/highlights.js';
import { AnimationManager }         from '../ui/animations.js';
import { DesktopInput }             from '../ui/input-desktop.js';
import { MobileInput }              from '../ui/input-mobile.js';
import { RoomClient }               from './room-client.js';

export class OnlineController {
    /**
     * @param {object} options
     * @param {HTMLCanvasElement}  options.canvas
     * @param {ChessRenderer}      options.renderer
     * @param {object}             options.ui       - { statusEl, moveListEl, roomEl }
     * @param {string}             options.serverUrl
     * @param {object}             options.callbacks
     * @param {Function}           options.callbacks.onGameOver
     * @param {Function}           options.callbacks.onDrawOffer
     * @param {Function}           options.callbacks.onPlayerLeft
     * @param {Function}           options.callbacks.onConnectionError
     * @param {Function}           options.callbacks.onRoomReady  - (code, color)
     */
    constructor({ canvas, renderer, ui, serverUrl, callbacks = {} }) {
        this._canvas   = canvas;
        this._renderer = renderer;
        this._ui       = ui;
        this._cb       = callbacks;

        this._hl      = new HighlightManager();
        this._anim    = new AnimationManager();
        this._history = new MoveHistory();
        this._isMobile = window.matchMedia('(pointer: coarse)').matches;

        this._board     = null;
        this._gameState = null;
        this._myColor   = null;   // 'w' | 'b'
        this._selected  = null;
        this._gameStarted = false;

        this._client = new RoomClient(serverUrl, {
            onConnected:    ()  => this._onConnected(),
            onDisconnected: ()  => this._onDisconnected(),
            onRoomState:    (s) => this._onRoomState(s),
            onMove:         (m) => this._onOpponentMove(m),
            onGameOver:     (d) => this._onGameOver(d),
            onPlayerLeft:   ()  => this._onPlayerLeft(),
            onDrawOffer:    ()  => this._cb.onDrawOffer?.(),
            onDrawDeclined: ()  => this._setStatus('رفض الخصم عرض التعادل'),
            onChat:         (d) => this._onChat(d),
            onError:        (e) => this._cb.onConnectionError?.(e),
        });
    }

    // ─── الاتصال ─────────────────────────────────────────────────────────────

    async connect() {
        this._setStatus('جارٍ الاتصال بالخادم...');
        try {
            await this._client.connect();
        } catch (err) {
            this._setStatus('❌ فشل الاتصال — تحقق من اتصالك');
            this._cb.onConnectionError?.(err.message);
            throw err;
        }
    }

    async createRoom() {
        try {
            const { code, color } = await this._client.createRoom();
            this._myColor = color;
            this._client.setColor(color);
            this._client.setRoomCode(code);
            this._setStatus('⏳ بانتظار خصم... شارك الكود');
            this._cb.onRoomReady?.(code, color);
        } catch (err) {
            this._setStatus('❌ ' + err.message);
        }
    }

    async joinRoom(code) {
        try {
            const res = await this._client.joinRoom(code);
            this._myColor = res.color;
            this._client.setColor(res.color);
            this._client.setRoomCode(res.code);
        } catch (err) {
            this._setStatus('❌ ' + err.message);
            throw err;
        }
    }

    // ─── أحداث الخادم ────────────────────────────────────────────────────────

    _onConnected() {
        this._setStatus('✅ متصل — أنشئ غرفة أو انضم لواحدة');
    }

    _onDisconnected() {
        this._setStatus('🔌 انقطع الاتصال...');
    }

    _onRoomState(state) {
        // اللعبة بدأت عندما ينضم اللاعبان
        if (state.status === 'playing' && !this._gameStarted) {
            this._startGame(state.fen);
        }
        if (state.status === 'over') {
            this._onGameOver({ status: 'over', winner: state.winner });
        }
    }

    _onOpponentMove({ from, to, promotion, fen }) {
        if (!this._gameStarted) return;

        // بناء الحركة من الـ FEN
        const { board: newBoard, gameState: newGS } = this._applyFEN(fen);
        const piece = this._board.get(from.row, from.col) ??
                      newBoard.get(to.row, to.col);   // fallback

        const move = {
            from, to,
            flags:     [],
            piece:     piece ?? { type: 'p', color: this._myColor === 'w' ? 'b' : 'w' },
            promotion: promotion ?? null,
        };

        this._anim.animate(
            from, to, move.piece,
            this._renderer.squareSize, this._renderer.flipped,
            (animState) => this._renderer.render(this._board, this._hl, animState),
            () => {
                this._board     = newBoard;
                this._gameState = newGS;
                this._hl.setLastMove(from, to);
                this._hl.setCheck(
                    isInCheck(newBoard, newGS.turn)
                        ? newBoard.findKing(newGS.turn)
                        : null
                );
                this._render();
                this._updateStatus();
                this._updateMoveList();
            }
        );
    }

    _onGameOver({ status, winner }) {
        const winnerColor = winner === 'w' ? COLOR.WHITE : winner === 'b' ? COLOR.BLACK : null;
        this._cb.onGameOver?.(status, winner);
        this._gameStarted = false;
    }

    _onPlayerLeft() {
        this._setStatus('🏃 غادر الخصم — فزت!');
        this._cb.onPlayerLeft?.();
    }

    _onChat({ from, text }) {
        const chatEl = this._ui?.chatEl;
        if (!chatEl) return;
        const label = from === this._myColor ? 'أنت' : 'خصمك';
        const msg   = document.createElement('div');
        msg.className = `chat-msg chat-${from === this._myColor ? 'me' : 'them'}`;
        msg.innerHTML = `<span class="chat-from">${label}:</span> ${this._escHtml(text)}`;
        chatEl.appendChild(msg);
        chatEl.scrollTop = chatEl.scrollHeight;
    }

    // ─── منطق اللعبة ─────────────────────────────────────────────────────────

    _startGame(fen = STARTING_FEN) {
        this._gameStarted = true;
        const parsed = parseFEN(fen);
        this._board     = parsed.board;
        this._gameState = parsed.gameState;
        this._history.clear();
        this._hl.reset();
        this._selected = null;

        // قلب الرقعة للأسود
        this._renderer.flip(this._myColor === 'b');
        this._setupInput();

        const colorAr = this._myColor === 'w' ? 'أبيض ♔' : 'أسود ♚';
        this._setStatus(`بدأت اللعبة! أنت ${colorAr}`);
        this._render();
    }

    _setupInput() {
        this._input?.destroy();
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
        if (!this._gameStarted)  return;
        if (this._anim.isRunning) return;
        if (this._gameState.turn !== this._myColor) return;

        const piece = this._board.get(row, col);

        if (this._selected) {
            const move = this._selected.moves.find(
                m => m.to.row === row && m.to.col === col
            );
            if (move) { this._executeMove(move); return; }

            if (piece?.color === this._myColor) {
                this._selectPiece(row, col); return;
            }
            this._deselect();
            this._render();
            return;
        }

        if (piece?.color === this._myColor) this._selectPiece(row, col);
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

    async _executeMove(move) {
        if (move.flags.includes('promotion')) {
            move = { ...move, promotion: 'q' }; // TODO: dialog ترقية
        }

        this._deselect();
        const boardBefore = this._board;

        const { board: newBoard } = applyMove(boardBefore, move);
        const newGS = nextGameState(boardBefore, move, this._gameState);
        const san   = '';  // TODO: SAN من history

        // إرسال للخادم
        try {
            await this._client.sendMove({
                from:       move.from,
                to:         move.to,
                promotion:  move.promotion,
                fen:        boardToFEN(newBoard, newGS),
                san,
            });
        } catch {
            this._setStatus('❌ فشل إرسال الحركة');
            return;
        }

        // تحديث محلي
        this._history.push(move, boardBefore, this._gameState);
        this._board     = newBoard;
        this._gameState = newGS;

        this._hl.setLastMove(move.from, move.to);
        this._hl.setCheck(
            isInCheck(newBoard, newGS.turn)
                ? newBoard.findKing(newGS.turn)
                : null
        );

        this._render();
        this._updateStatus();
        this._updateMoveList();

        // فحص نهاية اللعبة
        const status = getGameStatus(newBoard, newGS.turn, newGS);
        if (status !== 'playing' && status !== 'check') {
            const winner = status === 'checkmate' ? this._myColor : null;
            this._client.sendGameOver(status, winner);
            this._cb.onGameOver?.(status, winner);
        }
    }

    _applyFEN(fen) {
        return parseFEN(fen);
    }

    // ─── إجراءات ─────────────────────────────────────────────────────────────

    offerDraw()   { this._client.offerDraw(); }
    acceptDraw()  { this._client.acceptDraw(); }
    declineDraw() { this._client.declineDraw(); }
    resign() {
        this._client.resign();
        this._gameStarted = false;
    }
    sendChat(text) { this._client.sendChat(text); }

    // ─── UI ──────────────────────────────────────────────────────────────────

    _render() { this._renderer.render(this._board, this._hl); }

    _setStatus(text) {
        const el = this._ui?.statusEl;
        if (el) el.textContent = text;
    }

    _updateStatus() {
        if (!this._gameStarted) return;
        const status  = getGameStatus(this._board, this._gameState.turn, this._gameState);
        const isMyTurn = this._gameState.turn === this._myColor;
        const messages = {
            playing:      isMyTurn ? '🟢 دورك!' : '⏳ دور الخصم',
            check:        isMyTurn ? '⚠️ أنت في كشف!' : '⚠️ الخصم في كشف!',
            checkmate:    isMyTurn ? '🏆 كش مات — فاز الخصم' : '🏆 كش مات — فزت!',
            stalemate:    '🤝 تعادل — وقفة',
            insufficient: '🤝 تعادل — قطع غير كافية',
            'fifty-move': '🤝 تعادل — قاعدة الخمسين',
        };
        this._setStatus(messages[status] ?? (isMyTurn ? '🟢 دورك!' : '⏳ دور الخصم'));
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
                <span class="move-w">${san[i] ?? ''}</span>
                <span class="move-b">${san[i+1] ?? ''}</span>
            </div>`;
        }
        el.innerHTML = html;
        el.scrollTop = el.scrollHeight;
    }

    _escHtml(text) {
        return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    destroy() {
        this._input?.destroy();
        this._anim.cancel();
        this._client.disconnect();
    }
}
