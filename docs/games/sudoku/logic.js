import { SUDOKU_CONFIG } from './config.js';
import { SudokuGenerator } from './generator.js';

export class SudokuLogic {
    constructor() {
        this.config = SUDOKU_CONFIG;
        this.generator = new SudokuGenerator(this.config);
        this.newGame('medium');
    }

    _grid(def) {
        return Array.from({ length: this.config.SIZE }, () => Array(this.config.SIZE).fill(def));
    }

    _clone(grid) {
        return grid.map(row => [...row]);
    }

    newGame(difficulty = 'medium') {
        this.difficulty = difficulty;
        const { solution, puzzle } = this.generator.generate(difficulty);
        this.solution = solution;
        this.board = this._clone(puzzle);
        this.given = puzzle.map(row => row.map(v => v !== 0));
        this.notes = Array.from({ length: this.config.SIZE }, () =>
            Array.from({ length: this.config.SIZE }, () => new Set())
        );
        this.selectedRow = -1;
        this.selectedCol = -1;
        this.mistakes = 0;
        this.isComplete = false;
        this.noteMode = false;
        this.startTime = Date.now();
        this.timeElapsed = 0;
    }

    selectCell(row, col) {
        this.selectedRow = row;
        this.selectedCol = col;
    }

    inputNumber(num) {
        const r = this.selectedRow;
        const c = this.selectedCol;
        if (r < 0 || c < 0 || this.given[r][c]) return false;

        if (this.noteMode && num !== 0) {
            const notes = this.notes[r][c];
            if (notes.has(num)) notes.delete(num); else notes.add(num);
            return true;
        }

        this.notes[r][c].clear();
        this.board[r][c] = num;
        if (num !== 0 && num !== this.solution[r][c]) this.mistakes += 1;
        this._checkComplete();
        return true;
    }

    eraseCell() {
        const r = this.selectedRow;
        const c = this.selectedCol;
        if (r < 0 || c < 0 || this.given[r][c]) return;
        this.board[r][c] = 0;
        this.notes[r][c].clear();
        this.isComplete = false;
    }

    toggleNoteMode() {
        this.noteMode = !this.noteMode;
        return this.noteMode;
    }

    isCellError(r, c) {
        const v = this.board[r][c];
        return v !== 0 && !this.given[r][c] && v !== this.solution[r][c];
    }

    _checkComplete() {
        for (let r = 0; r < this.config.SIZE; r++) {
            for (let c = 0; c < this.config.SIZE; c++) {
                if (this.board[r][c] !== this.solution[r][c]) {
                    this.isComplete = false;
                    return;
                }
            }
        }
        this.isComplete = true;
        this.timeElapsed = Math.floor((Date.now() - this.startTime) / 1000);
    }

    getElapsedTime() {
        if (!this.startTime) return 0;
        return this.isComplete ? this.timeElapsed : Math.floor((Date.now() - this.startTime) / 1000);
    }

    formatTime(s) {
        return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    }

    getBoardStateForAI() {
        const stateLines = [];
        const diff = this.config.DIFFICULTY_LABELS[this.difficulty] || this.difficulty;
        stateLines.push('=== حالة لعبة Sudoku ===');
        stateLines.push(`الصعوبة: ${diff} | الأخطاء: ${this.mistakes} | الوقت: ${this.formatTime(this.getElapsedTime())}`);
        stateLines.push('');
        stateLines.push('اللوحة (. = فارغة، [رقم] = خطأ):');

        for (let r = 0; r < this.config.SIZE; r++) {
            if (r > 0 && r % 3 === 0) stateLines.push('  ─────────┼─────────┼─────────');
            let row = `R${r + 1} `;
            for (let c = 0; c < this.config.SIZE; c++) {
                if (c > 0 && c % 3 === 0) row += '│ ';
                const v = this.board[r][c];
                if (v === 0) row += '. ';
                else if (this.isCellError(r, c)) row += `[${v}]`;
                else row += `${v} `;
            }
            stateLines.push(row);
        }

        let empty = 0;
        for (let r = 0; r < this.config.SIZE; r++) {
            for (let c = 0; c < this.config.SIZE; c++) {
                if (this.board[r][c] === 0) empty += 1;
            }
        }
        stateLines.push('');
        stateLines.push(`الخلايا الفارغة المتبقية: ${empty} من أصل 81`);
        return stateLines.join('\n');
    }
}

export default SudokuLogic;
