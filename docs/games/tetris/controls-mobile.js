import { CONFIG } from './config.js';

export class TetrisMobileControls {
    constructor(game) {
        this.game = game;
        this._mobileControls = null;
        this._lastTap = 0;
        this._init();
    }

    _isMobile() {
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua.toLowerCase());
        const isSmallScreen = window.innerWidth < 768;
        const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches || false;
        const hasRealTouch = (navigator.maxTouchPoints || 0) >= 2;
        return isMobileUA || (isSmallScreen && (coarsePointer || hasRealTouch));
    }

    _init() {
        if (!this._isMobile()) return;
        this._initTouchSwipes();
        const container = document.querySelector('.game-page') || document.body;
        this._createPad(container);
    }

    _initTouchSwipes() {
        const canvas = this.game.canvas;
        let touchStartX = 0, touchStartY = 0, touchStartTime = 0;

        canvas.addEventListener('touchstart', e => {
            const t = e.touches[0];
            touchStartX = t.clientX;
            touchStartY = t.clientY;
            touchStartTime = Date.now();
            const now = Date.now();
            if (now - this._lastTap < 300) {
                this.game.logic.hardDrop();
                this._lastTap = 0;
            } else {
                this._lastTap = now;
            }
        }, { passive: true });

        canvas.addEventListener('touchend', e => {
            const t = e.changedTouches[0];
            const dx = t.clientX - touchStartX;
            const dy = t.clientY - touchStartY;
            const dt = Date.now() - touchStartTime;
            const SWIPE = 30;

            if (dt < 400 && Math.max(Math.abs(dx), Math.abs(dy)) > SWIPE) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    if (dx < 0) this.game.logic.moveLeft();
                    else this.game.logic.moveRight();
                } else {
                    if (dy > 0) this.game.logic.softDrop();
                    else this.game.logic.rotateCW();
                }
            }
        }, { passive: true });

        canvas.addEventListener('click', () => {
            if (this.game.logic.gameOver) this.game.restart();
        });
    }

    _createPad(container) {
        const pad = document.createElement('div');
        pad.className = 'tetris-controls';

        const dpad = document.createElement('div');
        dpad.className = 'tetris-dpad';
        dpad.appendChild(this._btn('⬅️', () => this.game.logic.moveLeft()));
        dpad.appendChild(this._btn('⬇️', () => this.game.logic.softDrop()));
        dpad.appendChild(this._btn('➡️', () => this.game.logic.moveRight()));

        const actions = document.createElement('div');
        actions.className = 'tetris-actions';
        const row1 = document.createElement('div');
        row1.className = 'act-row';
        row1.appendChild(this._btn('↺', () => this.game.logic.rotateCCW()));
        row1.appendChild(this._btn('↻', () => this.game.logic.rotateCW()));
        const row2 = document.createElement('div');
        row2.className = 'act-row';
        row2.appendChild(this._btn('H', () => this.game.logic.holdPiece()));
        this._pauseBtn = this._btn('⏸', () => {
    this.game.logic.togglePause();
    this._pauseBtn.textContent = this.game.logic.paused ? '▶️' : '⏸';
}, true);

row2.appendChild(this._pauseBtn);
        row2.appendChild(this._btn('⭕', () => this.game.logic.hardDrop()));
        actions.appendChild(row1);
        actions.appendChild(row2);

        pad.appendChild(dpad);
        pad.appendChild(actions);
        container.appendChild(pad);
        this._mobileControls = pad;
    }

    _btn(label, action, allowPaused = false) {
    const btn = document.createElement('button');
    btn.className = 't-btn';
    btn.type = 'button';
    btn.textContent = label;

    const fire = (e) => {
        if (e?.cancelable) e.preventDefault();
        if (this.game.logic.gameOver) return;
        if (!allowPaused && this.game.logic.paused) return;
        action();
    };

    // Pointer events avoid touch + mouse double firing on mobile browsers.
    if ('PointerEvent' in window) {
        btn.addEventListener('pointerdown', fire);
    } else {
        btn.addEventListener('touchstart', fire, { passive: false });
        btn.addEventListener('mousedown', fire);
    }

    return btn;
}

    update() {}

    destroy() {
        if (this._mobileControls) {
            this._mobileControls.remove();
            this._mobileControls = null;
        }
    }
}

export default TetrisMobileControls;
