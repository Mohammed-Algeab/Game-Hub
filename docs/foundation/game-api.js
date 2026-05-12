/**
 * foundation/game-api.js
 * API أساسية للتفاعل بين الألعاب ونظام Game Hub.
 * تعتمد على GameFoundation v2 وتوسعها.
 * تم دمج GameHubAPI للمصادقة والإنجازات ولوحة الصدارة.
 */

import { GameHubAPI, GameHubEvents } from './gamehub-api.js';

export class GameFoundation {

    /**
     * @param {object} config
     * @param {string}   config.name          اسم اللعبة
     * @param {string}   [config.storageKey]  مفتاح localStorage
     * @param {Function} [config.onRestart]   callback عند إعادة التشغيل
     * @param {Function} [config.onPause]     callback عند الإيقاف
     * @param {Function} [config.onResume]    callback عند الاستئناف
     * @param {boolean}  [config.hasScore]    إظهار النتيجة (افتراضي true)
     * @param {boolean}  [config.hasTimer]    إظهار المؤقت (افتراضي false)
     */
    constructor(config = {}) {
        this.gameName   = config.name       || 'New Game';
        this.storageKey = config.storageKey || `gamehub-state-${this.gameName}`;
        this._onRestart = config.onRestart  || (() => window.location.reload());
        this._onPause   = config.onPause    || null;
        this._onResume  = config.onResume   || null;
        this._hasScore  = config.hasScore  ?? true;
        this._hasTimer  = config.hasTimer  ?? false;

        // حالة داخلية
        this._score    = 0;
        this._level    = 1;
        this._isPaused = false;
        this._isOver   = false;
        this._aiCtx    = {};

        // مؤقت
        this._timerEl      = null;
        this._timerSeconds = 0;
        this._timerInterval = null;
        this._timerUp      = true;   // true=تصاعدي، false=تنازلي

        this.isMobile = window.matchMedia('(pointer: coarse)').matches;

        // ─── GameHub Integration ──────────────────────────────────────────
        this._gameSession = null;
        this._gameId = config.gameId || this.gameName.toLowerCase().replace(/\s+/g, '-');
        this._gameResult = {
            score: 0,
            level: 1,
            isWin: false,
            difficulty: 'normal',
            highestTile: 0,
            snakeLength: 0,
            linesCleared: 0,
            timeSeconds: 0
        };

        this._init();
        this._initGameHub();
    }

    // ─── تهيئة GameHub ────────────────────────────────────────────────────
    async _initGameHub() {
        try {
            await GameHubAPI.auth.init();
            await GameHubAPI.profile.load();
            await GameHubAPI.achievements.init();
            
            // إشعار عند تفعيل إنجاز
            GameHubAPI.achievements.onUnlock((achievement) => {
                GameHubAPI.notify.achievement(achievement);
            });
            
            // إشعار عند ترقية المستوى
            GameHubAPI.profile.onChange((event, data) => {
                if (event === 'levelUp') {
                    GameHubAPI.notify.levelUp(data.oldLevel, data.newLevel);
                }
            });
        } catch (err) {
            console.warn('[GameFoundation] GameHub init skipped:', err.message);
        }
    }

    // ─── بدء جلسة اللعبة ──────────────────────────────────────────────────
    async startGameSession(difficulty = 'normal') {
        try {
            this._gameSession = await GameHubAPI.onGameStart(this._gameId, { difficulty });
            this._gameResult.difficulty = difficulty;
        } catch (err) {
            console.warn('[GameFoundation] Could not start game session:', err.message);
        }
    }

    // ─── إنهاء جلسة اللعبة ────────────────────────────────────────────────
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

    // ─── تحديث نتيجة اللعبة ───────────────────────────────────────────────
    setGameResult(key, value) {
        if (this._gameResult.hasOwnProperty(key)) {
            this._gameResult[key] = value;
        }
    }

    // ─── تسجيل نتيجة في Leaderboard ───────────────────────────────────────
    async submitScore(score, options = {}) {
        try {
            await GameHubAPI.leaderboard.submit(this._gameId, score, {
                ...options,
                level: this._gameResult.level,
                difficulty: this._gameResult.difficulty
            });
        } catch (err) {
            console.warn('[GameFoundation] Could not submit score:', err.message);
        }
    }

    // ─── التحقق من الإنجازات ──────────────────────────────────────────────
    async checkAchievements(conditionType, value, extra = {}) {
        try {
            const unlocked = await GameHubAPI.achievements.updateProgress(
                this._gameId, conditionType, value, extra
            );
            return unlocked;
        } catch (err) {
            console.warn('[GameFoundation] Could not check achievements:', err.message);
            return [];
        }
    }

    // ─── إظهار إشعار ──────────────────────────────────────────────────────
    notify(type, title, message) {
        if (GameHubAPI.notify[type]) {
            GameHubAPI.notify[type](title, message);
        }
    }

    // ─── تهيئة ───────────────────────────────────────────────────────────────

    _init() {
        this._connectChat();
        this._bindButtons();
        this._hideUnused();
    }

    _connectChat() {
        try {
            // تهيئة Chat بشكل آمن (لا تكسر اللعبة إن غاب Chat)
           import('../js/chat.js').then(({ initChat, setChatGameContext }) => {                this._setChatCtx = setChatGameContext;
                initChat();
                this._pushAIContext();
            }).catch(() => {});
        } catch { /* chat اختياري */ }
    }

    _bindButtons() {
        const safe = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);

        safe('btn-restart',   () => this._doRestart());
        safe('modal-restart', () => this._doRestart());
        safe('btn-pause',     () => this.toggle());
        safe('btn-ai-hint',   () => this._requestHint());
    }

    _hideUnused() {
        if (!this._hasScore) {
            document.getElementById('score-container')?.style.setProperty('display','none');
        }
    }

    // ─── النتيجة والحالة والمستوى ─────────────────────────────────────────────

    setScore(n) {
        this._score = n;
        const el = document.getElementById('score-value');
        if (el) el.textContent = n;
        this._pushAIContext();
    }

    setStatus(text) {
        const el = document.getElementById('status-text');
        if (el) el.textContent = text;
    }

    setLevel(n) {
        this._level = n;
        const el = document.getElementById('level-value');
        if (el) el.textContent = n;
        this._pushAIContext();
    }

    get isPaused()  { return this._isPaused; }
    get isGameOver(){ return this._isOver; }

    // ─── Pause / Resume ───────────────────────────────────────────────────────

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
        if (this._timerActive) this.startTimer();
        this._updatePauseBtn();
        this._onResume?.();

        const overlay = document.getElementById('game-overlay');
        overlay?.classList.add('hidden');
    }

    toggle() { this._isPaused ? this.resume() : this.pause(); }

    _updatePauseBtn() {
        const btn = document.getElementById('btn-pause');
        if (btn) btn.textContent = this._isPaused ? '▶ استمرار' : '⏸ إيقاف';
    }

    // ─── Game Over ────────────────────────────────────────────────────────────

    /**
     * @param {object|number|string} result
     *   إذا كان object: { score, title, message, icon }
     *   إذا كان number: يُعامل كنتيجة
     */
    showGameOver(result, message) {
        this._isOver = true;
        this.stopTimer();

        let score, title, msg, icon;

        if (typeof result === 'object' && result !== null) {
            score = result.score   ?? this._score;
            title = result.title   ?? 'انتهت اللعبة!';
            msg   = result.message ?? message ?? '';
            icon  = result.icon    ?? '🏁';
        } else {
            score = result ?? this._score;
            title = 'انتهت اللعبة!';
            msg   = message ?? '';
            icon  = '🏁';
        }

        this._setModal({ score, title, msg, icon });
        document.getElementById('gameover-modal')?.classList.remove('hidden');
        this._pushAIContext({ event: 'game_over', score });

        // ─── GameHub: إنهاء الجلسة ───────────────────────────────────────
        this.endGameSession({ score, isWin: false });
    }

    hideGameOver() {
        this._isOver = false;
        document.getElementById('gameover-modal')?.classList.add('hidden');
    }

    _setModal({ score, title, msg, icon }) {
        const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
        const setHtml = (id, v) => { const e = document.getElementById(id); if (e) e.innerHTML = v; };
        setHtml('gameover-icon', icon);
        set('gameover-title', title);
        set('gameover-msg',   msg);
        set('final-score',    score);
    }

    _doRestart() {
        this._score    = 0;
        this._level    = 1;
        this._isPaused = false;
        this._isOver   = false;
        this.stopTimer();
        this._timerSeconds = 0;
        this.hideGameOver();
        this.setScore(0);
        this._updatePauseBtn();
        document.getElementById('game-overlay')?.classList.add('hidden');
        this._onRestart();
    }

    // ─── مؤقت ────────────────────────────────────────────────────────────────

    /**
     * @param {object} [opts]
     * @param {boolean} [opts.countDown=false] - تنازلي؟
     * @param {number}  [opts.from=0]          - ابدأ من (بالثواني)
     * @param {Function}[opts.onTick]          - callback كل ثانية (seconds)
     * @param {Function}[opts.onEnd]           - callback عند الوصول 0 (تنازلي)
     */
    startTimer(opts = {}) {
        this.stopTimer();
        this._timerActive  = true;
        this._timerUp      = !(opts.countDown ?? false);
        this._timerSeconds = opts.from ?? (this._timerUp ? 0 : 0);
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

    _renderTimer() {
        if (!this._timerEl) return;
        const abs = Math.abs(this._timerSeconds);
        const m = String(Math.floor(abs / 60)).padStart(2, '0');
        const s = String(abs % 60).padStart(2, '0');
        this._timerEl.textContent = `${m}:${s}`;
    }

    // ─── سياق الـ AI ─────────────────────────────────────────────────────────

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
            game:    this.gameName,
            score:   this._score,
            level:   this._level,
            paused:  this._isPaused,
            over:    this._isOver,
            timer:   this._timerSeconds,
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

    // ─── حفظ الحالة ──────────────────────────────────────────────────────────

    saveState(data) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                data,
                score: this._score,
                level: this._level,
                ts:    Date.now(),
            }));
        } catch { /* localStorage غير متاح */ }
    }

    loadState() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return null;
            const saved = JSON.parse(raw);
            return saved.data ?? null;
        } catch { return null; }
    }

    clearState() {
        try { localStorage.removeItem(this.storageKey); } catch { /* */ }
    }

    // ─── أدوات مساعدة ────────────────────────────────────────────────────────

    /** هل الجهاز موبايل؟ */
    get mobile() { return this.isMobile; }

    /** نسخة الـ Foundation */
    static get version() { return '2.0.0'; }
}

// للمشاريع غير المعتمدة على ES Modules
if (typeof window !== 'undefined') window.GameFoundation = GameFoundation;
