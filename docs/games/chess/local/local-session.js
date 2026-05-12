/**
 * local/local-session.js
 * حالة جلسة اللعب المحلي 1v1
 * مسؤول عن حفظ واسترجاع حالة اللعبة فقط — بلا منطق UI
 */

import { parseFEN, boardToFEN, STARTING_FEN } from '../core/fen.js';
import { MoveHistory }  from '../core/history.js';
import { COLOR }        from '../core/pieces.js';

const STORAGE_KEY = 'gamehub-chess-local';

export class LocalSession {
    constructor() {
        this.board      = null;
        this.gameState  = null;
        this.history    = new MoveHistory();
        this.status     = 'playing';   // 'playing'|'check'|'checkmate'|'stalemate'|'insufficient'|'fifty-move'
        this.winner     = null;        // COLOR.WHITE | COLOR.BLACK | null
        this.startTime  = null;
        this._init();
    }

    // ─── تهيئة ───────────────────────────────────────────────────────────────

    _init() {
        const saved = this._load();
        if (saved) {
            this._restore(saved);
        } else {
            this.newGame();
        }
    }

    newGame() {
        const { board, gameState } = parseFEN(STARTING_FEN);
        this.board     = board;
        this.gameState = gameState;
        this.history.clear();
        this.status    = 'playing';
        this.winner    = null;
        this.startTime = Date.now();
        this._save();
    }

    // ─── تسجيل حركة ─────────────────────────────────────────────────────────

    /**
     * تسجيل حركة منفذة بالفعل
     * @param {object} move
     * @param {import('../core/board.js').Board} boardBefore
     * @param {object} gameStateBefore
     * @param {object|null} captured
     */
    recordMove(move, boardBefore, gameStateBefore, captured = null) {
        this.history.push(move, boardBefore, gameStateBefore, captured);
        this._save();
    }

    /**
     * تحديث board و gameState بعد تنفيذ الحركة
     */
    update(newBoard, newGameState, newStatus, winner = null) {
        this.board     = newBoard;
        this.gameState = newGameState;
        this.status    = newStatus;
        this.winner    = winner;
        this._save();
    }

    // ─── تراجع ───────────────────────────────────────────────────────────────

    /**
     * التراجع عن آخر حركة
     * @returns {{ board, gameState }|null}
     */
    undo() {
        if (this.history.isEmpty) return null;
        const entry = this.history.pop();
        this.board     = entry.boardBefore;
        this.gameState = entry.gameStateBefore;
        this.status    = 'playing';
        this.winner    = null;
        this._save();
        return { board: this.board, gameState: this.gameState };
    }

    // ─── معلومات مساعدة ──────────────────────────────────────────────────────

    get turn()         { return this.gameState?.turn ?? COLOR.WHITE; }
    get isOver()       { return ['checkmate', 'stalemate', 'insufficient', 'fifty-move'].includes(this.status); }
    get moveCount()    { return this.history.length; }
    get currentFEN()   { return boardToFEN(this.board, this.gameState); }
    get lastMove()     { return this.history.last?.move ?? null; }

    /** وقت اللعبة بالثواني */
    get elapsedSeconds() {
        return this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
    }

    // ─── حفظ واسترجاع (localStorage) ────────────────────────────────────────

    _save() {
        try {
            const data = {
                fen:       this.currentFEN,
                pgn:       this.history.toPGN(),
                status:    this.status,
                winner:    this.winner,
                startTime: this.startTime,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch {
            // localStorage غير متاح — نتجاهل
        }
    }

    _load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    _restore(data) {
        try {
            const { board, gameState } = parseFEN(data.fen ?? STARTING_FEN);
            this.board     = board;
            this.gameState = gameState;
            this.status    = data.status    ?? 'playing';
            this.winner    = data.winner    ?? null;
            this.startTime = data.startTime ?? Date.now();
            // لا نسترجع history كاملاً لتعقيدها — نبدأ سجلاً فارغاً بنفس الـ FEN
        } catch {
            this.newGame();
        }
    }

    clearSaved() {
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
    }
}
