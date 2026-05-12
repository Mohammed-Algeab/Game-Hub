import { SUDOKU_CONFIG } from './config.js';

export class SudokuRenderer {
    constructor(options = {}) {
        this.logic = options.logic;
        this.gridEl = options.gridEl;
        this.numpadEl = options.numpadEl;
        this.timerEl = options.timerEl;
        this.mistakesEl = options.mistakesEl;
        this.diffLabelEl = options.diffLabelEl;
        this.winOverlayEl = options.winOverlayEl;
        this.winTimeEl = options.winTimeEl;
        this.winMistakesEl = options.winMistakesEl;
        this.onCellSelect = options.onCellSelect || (() => {});
        this.onNumberPress = options.onNumberPress || (() => {});
        this.onErase = options.onErase || (() => {});
        this.onNoteToggle = options.onNoteToggle || (() => {});
        this.onNewGame = options.onNewGame || (() => {});
    }

    updateGridSizeVar() {
        const scroll = document.getElementById('sudoku-scroll');
        if (!scroll) return;
        const avH = scroll.clientHeight - 120 - 50 - 30;
        const avW = scroll.clientWidth;
        const size = Math.min(486, avW, Math.max(avH, 200));
        document.documentElement.style.setProperty('--sudoku-grid-size', size + 'px');
    }

    buildGrid() {
        if (!this.gridEl) return;
        this.gridEl.innerHTML = '';
        for (let r = 0; r < SUDOKU_CONFIG.SIZE; r++) {
            for (let c = 0; c < SUDOKU_CONFIG.SIZE; c++) {
                const cell = document.createElement('div');
                cell.className = 'sudoku-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                if (c === 2 || c === 5) cell.classList.add('box-right');
                if (r === 2 || r === 5) cell.classList.add('box-bottom');
                cell.addEventListener('click', () => this.onCellSelect(r, c));
                this.gridEl.appendChild(cell);
            }
        }
    }

    buildNumpad() {
        if (!this.numpadEl) return;
        this.numpadEl.innerHTML = '';
        for (let n = 1; n <= 9; n++) {
            const btn = document.createElement('button');
            btn.className = 'num-btn';
            btn.dataset.num = n;
            btn.textContent = n;
            btn.addEventListener('click', () => this.onNumberPress(n));
            this.numpadEl.appendChild(btn);
        }

        const eraseBtn = this._mkBtn('num-btn erase-btn', '⌫', () => this.onErase());
        const noteBtn = this._mkBtn('num-btn note-btn', '✏️\nملاحظة', () => this.onNoteToggle(), 'note-btn');
        const newBtn = this._mkBtn('num-btn new-game-btn', '🔄\nجديدة', () => this.onNewGame());
        this.numpadEl.append(eraseBtn, noteBtn, newBtn);
    }

    _mkBtn(cls, html, fn, id = null) {
        const b = document.createElement('button');
        b.className = cls;
        b.innerHTML = html;
        if (id) b.id = id;
        b.addEventListener('click', fn);
        return b;
    }

    updateGrid() {
        if (!this.gridEl || !this.logic) return;
        const cells = this.gridEl.querySelectorAll('.sudoku-cell');
        const sr = this.logic.selectedRow;
        const sc = this.logic.selectedCol;
        const selectedValue = (sr >= 0 && sc >= 0) ? this.logic.board[sr][sc] : 0;

        cells.forEach(cell => {
            const r = Number(cell.dataset.row);
            const c = Number(cell.dataset.col);
            const value = this.logic.board[r][c];
            const notes = this.logic.notes[r][c];

            cell.classList.remove('given', 'player', 'error', 'hint', 'selected', 'highlight', 'same-num');

            if (this.logic.given[r][c]) cell.classList.add('given');
            else if (value !== 0) cell.classList.add('player');
            if (this.logic.isCellError(r, c)) cell.classList.add('error');

            if (r === sr && c === sc) {
                cell.classList.add('selected');
            } else if (sr >= 0) {
                const sameBox = Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3);
                if (r === sr || c === sc || sameBox) cell.classList.add('highlight');
            }
            if (selectedValue && value === selectedValue && value !== 0) cell.classList.add('same-num');

            if (value !== 0) {
                cell.textContent = value;
            } else if (notes.size > 0) {
                cell.innerHTML = '';
                const ng = document.createElement('div');
                ng.className = 'cell-notes';
                for (let n = 1; n <= 9; n++) {
                    const d = document.createElement('div');
                    d.className = 'note-digit';
                    d.textContent = notes.has(n) ? n : '';
                    ng.appendChild(d);
                }
                cell.appendChild(ng);
            } else {
                cell.textContent = '';
            }
        });

        if (this.mistakesEl) this.mistakesEl.textContent = this.logic.mistakes;
        this.updateNumpadCounts();
    }

    updateNumpadCounts() {
        if (!this.numpadEl) return;
        for (let n = 1; n <= 9; n++) {
            let count = 0;
            for (let r = 0; r < SUDOKU_CONFIG.SIZE; r++) {
                for (let c = 0; c < SUDOKU_CONFIG.SIZE; c++) {
                    if (this.logic.board[r][c] === n) count += 1;
                }
            }
            const btn = this.numpadEl.querySelector(`[data-num="${n}"]`);
            if (btn) btn.classList.toggle('completed', count >= 9);
        }
    }

    updateTimer() {
        if (this.timerEl && this.logic) {
            this.timerEl.textContent = this.logic.formatTime(this.logic.getElapsedTime());
        }
    }

    setDifficultyLabel(label) {
        if (this.diffLabelEl) this.diffLabelEl.textContent = label;
    }

    showWin() {
        if (!this.winOverlayEl || !this.winTimeEl || !this.winMistakesEl) return;
        this.winTimeEl.textContent = this.logic.formatTime(this.logic.timeElapsed);
        this.winMistakesEl.textContent = this.logic.mistakes;
        this.winOverlayEl.style.display = 'flex';
    }

    hideWin() {
        if (this.winOverlayEl) this.winOverlayEl.style.display = 'none';
    }
}

export default SudokuRenderer;
