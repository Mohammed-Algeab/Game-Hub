import { CONFIG } from './config.js';

export class TetrisDesktopControls {
    constructor(game) {
        this.game = game;
        this.das = { left: { active: false, startTime: null, lastRepeat: null }, right: { active: false, startTime: null, lastRepeat: null } };
        this.DAS_DELAY = 170;
        this.DAS_INTERVAL = 50;
        this._boundKeyDown = this._onKeyDown.bind(this);
        this._boundKeyUp = this._onKeyUp.bind(this);
        document.addEventListener('keydown', this._boundKeyDown);
        document.addEventListener('keyup', this._boundKeyUp);
    }

    _matchKey(keyDef, key) {
        return Array.isArray(keyDef) ? keyDef.includes(key) : keyDef === key;
    }

    _onKeyDown(e) {
        if (e.repeat) return;
        const K = CONFIG.KEYS;
        const L = this.game.logic;

        if (e.key === K.LEFT) {
            e.preventDefault();
            L.moveLeft();
            this.das.left.active = true;
            this.das.left.startTime = performance.now();
            this.das.left.lastRepeat = null;
        } else if (e.key === K.RIGHT) {
            e.preventDefault();
            L.moveRight();
            this.das.right.active = true;
            this.das.right.startTime = performance.now();
            this.das.right.lastRepeat = null;
        } else if (e.key === K.DOWN) {
            e.preventDefault();
            L.softDrop();
        } else if (this._matchKey(K.ROTATE_CW, e.key)) {
            e.preventDefault();
            L.rotateCW();
        } else if (this._matchKey(K.ROTATE_CCW, e.key)) {
            e.preventDefault();
            L.rotateCCW();
        } else if (this._matchKey(K.DROP, e.key)) {
            e.preventDefault();
            L.hardDrop();
        } else if (this._matchKey(K.HOLD, e.key)) {
            e.preventDefault();
            L.holdPiece();
        } else if (e.key === K.PAUSE || e.key === K.PAUSE?.toUpperCase?.()) {
            e.preventDefault();
            L.togglePause();
        } else if (e.key === 'Enter' && L.gameOver) {
            this.game.restart();
        }
    }

    _onKeyUp(e) {
        if (e.key === CONFIG.KEYS.LEFT) {
            this.das.left.active = false; this.das.left.startTime = null; this.das.left.lastRepeat = null;
        } else if (e.key === CONFIG.KEYS.RIGHT) {
            this.das.right.active = false; this.das.right.startTime = null; this.das.right.lastRepeat = null;
        }
    }

    update() {
        const now = performance.now();
        const L = this.game.logic;
        if (L.paused || L.gameOver) return;

        if (this.das.left.active && this.das.left.startTime !== null) {
            const elapsed = now - this.das.left.startTime;
            if (elapsed >= this.DAS_DELAY && (this.das.left.lastRepeat === null || now - this.das.left.lastRepeat >= this.DAS_INTERVAL)) {
                L.moveLeft();
                this.das.left.lastRepeat = now;
            }
        }

        if (this.das.right.active && this.das.right.startTime !== null) {
            const elapsed = now - this.das.right.startTime;
            if (elapsed >= this.DAS_DELAY && (this.das.right.lastRepeat === null || now - this.das.right.lastRepeat >= this.DAS_INTERVAL)) {
                L.moveRight();
                this.das.right.lastRepeat = now;
            }
        }
    }

    destroy() {
        document.removeEventListener('keydown', this._boundKeyDown);
        document.removeEventListener('keyup', this._boundKeyUp);
    }
}

export default TetrisDesktopControls;
