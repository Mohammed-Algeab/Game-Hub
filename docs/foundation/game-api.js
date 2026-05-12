/**
 * foundation/game-api.js  —  v2.1.0
 * API أساسية للتفاعل بين الألعاب ونظام Game Hub.
 * تعتمد على GameFoundation v2.1 وتوسعها.
 *
 * ─── التحسينات في v2.1 ───────────────────────────────────────────────────
 *  + showGameWin()          — حالة الفوز (كانت غائبة تماماً)
 *  + addScore(n)            — زيادة النتيجة بدلاً من setScore فقط
 *  + addLevel(n)            — زيادة المستوى
 *  + setDifficulty(diff)    — ضبط الصعوبة مع تحديث gameResult
 *  + getHighScore()         — أعلى نتيجة محفوظة في localStorage
 *  + getPlayerName()        — اسم اللاعب الحالي
 *  + getElapsedTime()       — الوقت المنقضي بالثواني
 *  + onEvent(event, cb)     — خطافات للأحداث (score/levelup/gameover/win/restart)
 *  + destroy()              — تنظيف المؤقتات ومستمعي الأحداث
 *  + Keyboard shortcuts     — Escape للإيقاف/الاستئناف، R للإعادة عند انتهاء اللعبة
 *  + autoSubmitScore option — إرسال النتيجة تلقائياً عند انتهاء اللعبة
 *  + isOnlineMode flag      — هل الإنجازات واللوحة نشطة؟
 *  + hasTimer: true         — يُظهر حاوية المؤقت تلقائياً
 *  + إصلاح _connectChat     — مسار الـ import الصحيح
 *  + إصلاح _doRestart       — ينهي الجلسة بشكل صحيح إن كانت نشطة
 *  + إصلاح resume()         — لا يُشغّل مؤقتاً لم يبدأ
 * ─────────────────────────────────────────────────────────────────────────
 */

import { GameHubAPI, GameHubEvents } from './gamehub-api.js';

export class GameFoundation {

    /**
     * @param {object}   config
     * @param {string}   config.name             اسم اللعبة
     * @param {string}   [config.gameId]          معرف اللعبة (افتراضي: name slug)
     * @param {string}   [config.storageKey]      مفتاح localStorage
     * @param {Function} [config.onRestart]       callback عند إعادة التشغيل
     * @param {Function} [config.onPause]         callback عند الإيقاف
     * @param {Function} [config.onResume]        callback عند الاستئناف
     * @param {boolean}  [config.hasScore=true]   إظهار النتيجة
     * @param {boolean}  [config.hasTimer=false]  إظهار المؤقت
     * @param {boolean}  [config.isOnlineMode=false] هل الإنجازات/اللوحة نشطة؟
     * @param {boolean}  [config.autoSubmitScore=false] إرسال النتيجة تلقائياً عند انتهاء اللعبة
     * @param {string}   [config.chatPath]        مسار chat.js النسبي (افتراضي: '../js/chat.js')
     */
    constructor(config = {}) {
        this.gameName   = config.name        || 'New Game';
        this.storageKey = config.storageKey  || `gamehub-state-${this.gameName}`;
        this._onRestart = config.onRestart   || (() => window.location.reload());
        this._onPause   = config.onPause     || null;
        this._onResume  = config.onResume    || null;
        this._hasScore  = config.hasScore   ?? true;
        this._hasTimer  = config.hasTimer   ?? false;
        this._isOnlineMode    = config.isOnlineMode    ?? false;
        this._autoSubmitScore = config.autoSubmitScore ?? false;
        this._chatPath  = config.chatPath    || '../js/chat.js';

        // حالة داخلية
        this._score    = 0;
        this._level    = 1;
        this._isPaused = false;
        this._isOver   = false;
        this._aiCtx    = {};

        // مؤقت
        this._timerEl       = null;
        this._timerSeconds  = 0;
        this._timerInterval = null;
        this._timerActive   = false;
        this._timerUp       = true;

        // خطافات الأحداث الداخلية
        this._eventListeners = {};

        // مستمع لوحة المفاتيح (نحتفظ به لإزالته عند destroy)
        this._keyHandler = null;

        this.isMobile = window.matchMedia('(pointer: coarse)').matches;

        // ─── GameHub Integration ──────────────────────────────────────────
        this._gameSession = null;
        this._gameId = config.gameId || this.gameName.toLowerCase().replace(/\s+/g, '-');
        this._gameResult = {
            score:        0,
            level:        1,
            isWin:        false,
            difficulty:   'normal',
            highestTile:  0,
            snakeLength:  0,
            linesCleared: 0,
            timeSeconds:  0,
        };

        this._init();
        this._initGameHub();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // تهيئة GameHub
    // ═══════════════════════════════════════════════════════════════════════

    async _initGameHub() {
        try {
            await GameHubAPI.auth.init();
            await GameHubAPI.profile.load();
            await GameHubAPI.achievements.init();

            GameHubAPI.achievements.onUnlock((achievement) => {
                GameHubAPI.notify.achievement(achievement);
            });

            GameHubAPI.profile.onChange((event, data) => {
                if (event === 'levelUp') {
                    GameHubAPI.notify.levelUp(data.oldLevel, data.newLevel);
                }
            });
        } catch (err) {
            console.warn('[GameFoundation] GameHub init skipped:', err.message);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // دورة حياة جلسة اللعبة
    // ═══════════════════════════════════════════════════════════════════════

    /** بدء جلسة اللعبة */
    async startGameSession(difficulty = 'normal') {
        try {
            this._gameSession = await GameHubAPI.onGameStart(this._gameId, { difficulty });
            this._gameResult.difficulty = difficulty;
        } catch (err) {
            console.warn('[GameFoundation] Could not start game session:', err.message);
        }
    }

    /** إنهاء جلسة اللعبة مع إرسال النتائج */
    async endGameSession(result = {}) {
        if (!this._gameSession) return;

        this._gameResult = { ...this._gameResult, ...result };

        try {
            await GameHubAPI.onGameEnd(this._gameSession, this._gameResult);
        } catch (err) {
            console.warn('[GameFoundation] Could not end game session:', err.message);
        }

        this._gameSession = null;
    }

    /** ضبط حقل في نتيجة اللعبة */
    setGameResult(key, value) {
        if (key in this._gameResult) {
            this._gameResult[key] = value;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Leaderboard & Achievements
    // ═══════════════════════════════════════════════════════════════════════

    /** إرسال النتيجة إلى لوحة الصدارة */
    async submitScore(score, options = {}) {
        try {
            await GameHubAPI.leaderboard.submit(this._gameId, score, {
                ...options,
                level:      this._gameResult.level,
                difficulty: this._gameResult.difficulty,
            });
        } catch (err) {
            console.warn('[GameFoundation] Could not submit score:', err.message);
        }
    }

    /** التحقق من الإنجازات يدوياً */
    async checkAchievements(conditionType, value, extra = {}) {
        try {
            return await GameHubAPI.achievements.updateProgress(
                this._gameId, conditionType, value, extra
            );
        } catch (err) {
            console.warn('[GameFoundation] Could not check achievements:', err.message);
            return [];
        }
    }

    /** إظهار إشعار */
    notify(type, title, message) {
        if (typeof GameHubAPI.notify[type] === 'function') {
            GameHubAPI.notify[type](title, message);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // تهيئة UI
    // ═══════════════════════════════════════════════════════════════════════

    _init() {
        this._connectChat();
        this._bindButtons();
        this._bindKeyboard();
        this._hideUnused();
    }

    _connectChat() {
        try {
            import(this._chatPath)
                .then(({ initChat, setChatGameContext }) => {
                    this._setChatCtx = setChatGameContext;
                    initChat();
                    this._pushAIContext();
                })
                .catch(() => { /* chat اختياري */ });
        } catch { /* chat اختياري */ }
    }

    _bindButtons() {
        const safe = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);

        safe('btn-restart',   () => this._doRestart());
        safe('modal-restart', () => this._doRestart());
        safe('btn-pause',     () => this.toggle());
        safe('btn-ai-hint',   () => this._requestHint());
    }

    /**
     * اختصارات لوحة المفاتيح:
     *   Escape  — إيقاف / استئناف
     *   R       — إعادة اللعبة (فقط عند انتهائها)
     */
    _bindKeyboard() {
        this._keyHandler = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'Escape') this.toggle();
            if ((e.key === 'r' || e.key === 'R') && this._isOver) this._doRestart();
        };
        document.addEventListener('keydown', this._keyHandler);
    }

    _hideUnused() {
        if (!this._hasScore) {
            document.getElementById('score-container')?.style.setProperty('display', 'none');
        }
        if (!this._hasTimer) {
            document.getElementById('timer-container')?.style.setProperty('display', 'none');
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // النتيجة والمستوى والحالة
    // ═══════════════════════════════════════════════════════════════════════

    /** ضبط النتيجة */
    setScore(n) {
        this._score = n;
        const el = document.getElementById('score-value');
        if (el) el.textContent = n;
        this._updateHighScore(n);
        this._pushAIContext();
        this._emitEvent('score', { score: n });
    }

    /**
     * زيادة النتيجة بمقدار معين
     * @param {number} n - المقدار (سالب للتقليل)
     * @returns {number} النتيجة الجديدة
     */
    addScore(n) {
        this.setScore(this._score + n);
        return this._score;
    }

    /** ضبط المستوى */
    setLevel(n) {
        this._level = n;
        const el = document.getElementById('level-value');
        if (el) el.textContent = n;
        this._pushAIContext();
        this._emitEvent('levelup', { level: n });
    }

    /**
     * زيادة المستوى بمقدار معين
     * @param {number} [n=1]
     * @returns {number} المستوى الجديد
     */
    addLevel(n = 1) {
        this.setLevel(this._level + n);
        return this._level;
    }

    /** ضبط نص الحالة */
    setStatus(text) {
        const el = document.getElementById('status-text');
        if (el) el.textContent = text;
    }

    /**
     * ضبط الصعوبة وتحديث gameResult
     * @param {'easy'|'normal'|'hard'|string} diff
     */
    setDifficulty(diff) {
        this._gameResult.difficulty = diff;
    }

    get score()   { return this._score; }
    get level()   { return this._level; }
    get isPaused()  { return this._isPaused; }
    get isGameOver(){ return this._isOver; }

    // ═══════════════════════════════════════════════════════════════════════
    // Pause / Resume
    // ═══════════════════════════════════════════════════════════════════════

    pause() {
        if (this._isPaused || this._isOver) return;
        this._isPaused = true;
        this.stopTimer();
        this._updatePauseBtn();
        this._onPause?.();

        const overlay = document.getElementById('game-overlay');
        if (overlay) {
            overlay.textContent = '⏸ متوقف — اضغط لإكمال';
            overlay.classList.remove('hidden');
            overlay.onclick = () => this.resume();
        }
    }

    resume() {
        if (!this._isPaused) return;
        this._isPaused = false;

        // أعد المؤقت فقط إن كان قد بدأ مسبقاً
        if (this._timerActive) {
            this._timerInterval = setInterval(() => {
                if (this._isPaused) return;
                this._timerUp ? this._timerSeconds++ : this._timerSeconds--;
                this._renderTimer();
                this._timerOnTick?.(this._timerSeconds);
                if (!this._timerUp && this._timerSeconds <= 0) {
                    this.stopTimer();
                    this._timerOnEnd?.();
                }
            }, 1000);
        }

        this._updatePauseBtn();
        this._onResume?.();

        const overlay = document.getElementById('game-overlay');
        overlay?.classList.add('hidden');
    }

    toggle() { this._isPaused ? this.resume() : this.pause(); }

    _updatePauseBtn() { this.resetPauseBtn(); }

    /** تحديث نص زر الإيقاف/الاستئناف (دالة عامة) */
    resetPauseBtn() {
        const btn = document.getElementById('btn-pause');
        if (btn) btn.textContent = this._isPaused ? '▶ استمرار' : '⏸ إيقاف';
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Game Over / Game Win
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * إظهار شاشة نهاية اللعبة (خسارة)
     * @param {object|number|string} result  { score, title, message, icon } أو نتيجة رقمية
     * @param {string} [message]
     */
    showGameOver(result, message) {
        this._endGame(result, message, false);
        document.getElementById('gameover-modal')?.classList.remove('hidden');
        this._pushAIContext({ event: 'game_over' });
        this._emitEvent('gameover', { score: this._score });
    }

    /**
     * إظهار شاشة الفوز ✨
     * @param {object|number|string} result  { score, title, message, icon } أو نتيجة رقمية
     * @param {string} [message]
     */
    showGameWin(result, message) {
        this._endGame(result, message, true);
        // نحاول gameover-modal أولاً، ثم gamewin-modal إن وُجد
        const winModal  = document.getElementById('gamewin-modal');
        const overModal = document.getElementById('gameover-modal');
        (winModal || overModal)?.classList.remove('hidden');
        this._pushAIContext({ event: 'game_win' });
        this._emitEvent('win', { score: this._score });
    }

    /** منطق مشترك بين showGameOver و showGameWin */
    _endGame(result, message, isWin) {
        this._isOver = true;
        this.stopTimer();

        let score, title, msg, icon;

        if (typeof result === 'object' && result !== null) {
            score = result.score   ?? this._score;
            title = result.title   ?? (isWin ? '🎉 فزت!' : 'انتهت اللعبة!');
            msg   = result.message ?? message ?? '';
            icon  = result.icon    ?? (isWin ? '🏆' : '🏁');
        } else {
            score = result ?? this._score;
            title = isWin ? '🎉 فزت!' : 'انتهت اللعبة!';
            msg   = message ?? '';
            icon  = isWin ? '🏆' : '🏁';
        }

        this._setModal({ score, title, msg, icon });

        // إرسال النتيجة تلقائياً إن كانت الخاصية مفعّلة والوضع أونلاين
        if (this._autoSubmitScore && this._isOnlineMode) {
            this.submitScore(score);
        }

        this.endGameSession({
            score,
            isWin,
            timeSeconds: this._timerSeconds,
        });
    }

    hideGameOver() {
        this._isOver = false;
        document.getElementById('gameover-modal')?.classList.add('hidden');
        document.getElementById('gamewin-modal')?.classList.add('hidden');
    }

    _setModal({ score, title, msg, icon }) {
        const set     = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
        const setHtml = (id, v) => { const e = document.getElementById(id); if (e) e.innerHTML  = v; };
        setHtml('gameover-icon',  icon);
        set('gameover-title', title);
        set('gameover-msg',   msg);
        set('final-score',    score);
    }

    _doRestart() {
        // أنهِ الجلسة إن كانت لا تزال نشطة
        if (this._gameSession) {
            this.endGameSession({ score: this._score, isWin: false });
        }

        this._score    = 0;
        this._level    = 1;
        this._isPaused = false;
        this._isOver   = false;
        this.stopTimer();
        this._timerSeconds = 0;
        this._timerActive  = false;
        this.hideGameOver();
        this.setScore(0);
        this._updatePauseBtn();
        document.getElementById('game-overlay')?.classList.add('hidden');
        this._emitEvent('restart', {});
        this._onRestart();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // مؤقت الوقت
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @param {object}   [opts]
     * @param {boolean}  [opts.countDown=false]  تنازلي؟
     * @param {number}   [opts.from=0]           ابدأ من (بالثواني)
     * @param {Function} [opts.onTick]           callback كل ثانية
     * @param {Function} [opts.onEnd]            callback عند الوصول لـ 0 (تنازلي)
     */
    startTimer(opts = {}) {
        this.stopTimer();
        this._timerActive  = true;
        this._timerUp      = !(opts.countDown ?? false);
        this._timerSeconds = opts.from ?? 0;
        this._timerEl      = document.getElementById('timer-value');
        this._timerOnTick  = opts.onTick ?? null;
        this._timerOnEnd   = opts.onEnd  ?? null;

        this._timerInterval = setInterval(() => {
            if (this._isPaused) return;
            this._timerUp ? this._timerSeconds++ : this._timerSeconds--;
            this._renderTimer();
            this._timerOnTick?.(this._timerSeconds);
            if (!this._timerUp && this._timerSeconds <= 0) {
                this.stopTimer();
                this._timerOnEnd?.();
            }
        }, 1000);
    }

    stopTimer() {
        clearInterval(this._timerInterval);
        this._timerInterval = null;
        this._timerActive   = false;
    }

    /** الوقت المنقضي بالثواني */
    getElapsedTime() { return this._timerSeconds; }

    _renderTimer() {
        if (!this._timerEl) return;
        const abs = Math.abs(this._timerSeconds);
        const m = String(Math.floor(abs / 60)).padStart(2, '0');
        const s = String(abs % 60).padStart(2, '0');
        this._timerEl.textContent = `${m}:${s}`;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // High Score
    // ═══════════════════════════════════════════════════════════════════════

    /** أعلى نتيجة محفوظة للعبة الحالية */
    getHighScore() {
        try {
            return parseInt(localStorage.getItem(`${this.storageKey}-highscore`) || '0', 10);
        } catch { return 0; }
    }

    _updateHighScore(score) {
        try {
            if (score > this.getHighScore()) {
                localStorage.setItem(`${this.storageKey}-highscore`, String(score));
                const el = document.getElementById('highscore-value');
                if (el) el.textContent = score;
            }
        } catch { /* */ }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // معلومات اللاعب
    // ═══════════════════════════════════════════════════════════════════════

    /** اسم اللاعب الحالي (display_name أو username) */
    getPlayerName() {
        try {
            const profile = GameHubAPI.profile.get();
            return profile?.display_name || profile?.username || 'لاعب';
        } catch { return 'لاعب'; }
    }

    /** هل اللاعب مسجل دخول (غير ضيف)؟ */
    get isAuthenticated() {
        try { return GameHubAPI.auth.isAuthenticated(); } catch { return false; }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // نظام الأحداث الداخلية
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * الاستماع لحدث داخلي
     * @param {'score'|'levelup'|'gameover'|'win'|'restart'} event
     * @param {Function} cb
     * @returns {Function} دالة لإلغاء الاستماع
     *
     * @example
     * game.onEvent('score', ({ score }) => updateUI(score));
     * game.onEvent('win',   ({ score }) => showCelebration(score));
     */
    onEvent(event, cb) {
        if (!this._eventListeners[event]) this._eventListeners[event] = [];
        this._eventListeners[event].push(cb);
        return () => {
            this._eventListeners[event] =
                this._eventListeners[event].filter(fn => fn !== cb);
        };
    }

    _emitEvent(event, data) {
        (this._eventListeners[event] || []).forEach(cb => {
            try { cb(data); } catch (e) { console.error(e); }
        });
        // إعادة النشر على GameHubEvents للتكامل مع باقي الأنظمة
        GameHubEvents.emit(`game:${event}`, { gameId: this._gameId, ...data });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // سياق الـ AI
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * تحديث سياق اللعبة الذي يراه Chat AI
     * @param {object} ctx - بيانات مخصصة للعبة
     */
    updateAIContext(ctx = {}) {
        this._aiCtx = { ...this._aiCtx, ...ctx };
        this._pushAIContext();
    }

    _pushAIContext(extra = {}) {
        const full = {
            game:   this.gameName,
            score:  this._score,
            level:  this._level,
            paused: this._isPaused,
            over:   this._isOver,
            timer:  this._timerSeconds,
            ...this._aiCtx,
            ...extra,
        };
        this._setChatCtx?.({
            name:  this.gameName,
            state: JSON.stringify(full),
        });
    }

    _requestHint() {
        if (window.chatWidget) {
            window.chatWidget.open?.();
            window.chatWidget.sendMessage?.(
                `أحتاج نصيحة في لعبة ${this.gameName}. الوضع الحالي: ${JSON.stringify(this._aiCtx)}`
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // حفظ الحالة في localStorage
    // ═══════════════════════════════════════════════════════════════════════

    saveState(data) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                data,
                score: this._score,
                level: this._level,
                timer: this._timerSeconds,
                ts:    Date.now(),
            }));
        } catch { /* localStorage غير متاح */ }
    }

    loadState() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return null;
            return JSON.parse(raw).data ?? null;
        } catch { return null; }
    }

    clearState() {
        try { localStorage.removeItem(this.storageKey); } catch { /* */ }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // تنظيف
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * تنظيف كامل عند إزالة اللعبة من الصفحة
     * (مفيد للألعاب ذات SPA أو المكونات الديناميكية)
     */
    destroy() {
        this.stopTimer();
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        this._eventListeners = {};
        if (this._gameSession) {
            this.endGameSession({ score: this._score, isWin: false });
        }
        console.log(`[GameFoundation] ${this.gameName} destroyed.`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // أدوات مساعدة
    // ═══════════════════════════════════════════════════════════════════════

    /** هل الجهاز موبايل؟ */
    get mobile() { return this.isMobile; }

    /** نسخة الـ Foundation */
    static get version() { return '2.1.0'; }
}

// للمشاريع غير المعتمدة على ES Modules
if (typeof window !== 'undefined') window.GameFoundation = GameFoundation;
