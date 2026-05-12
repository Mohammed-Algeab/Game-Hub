import { SUDOKU_CONFIG } from './config.js';

export class SudokuGenerator {
    constructor(config = SUDOKU_CONFIG) {
        this.config = config;
    }

    _grid(def = 0) {
        return Array.from({ length: this.config.SIZE }, () => Array(this.config.SIZE).fill(def));
    }

    _clone(grid) {
        return grid.map(row => [...row]);
    }

    _shuffle(values) {
        const arr = [...values];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    _swapRows(board, r1, r2) {
        [board[r1], board[r2]] = [board[r2], board[r1]];
    }

    _swapCols(board, c1, c2) {
        for (let r = 0; r < 9; r++) {
            [board[r][c1], board[r][c2]] = [board[r][c2], board[r][c1]];
        }
    }

    _randomizeSolvedBoard(board) {
        for (let band = 0; band < 3; band++) {
            const rows = this._shuffle([0, 1, 2]).map(v => v + band * 3);
            this._swapRows(board, band * 3, rows[0]);
            this._swapRows(board, band * 3 + 1, rows[1]);
            this._swapRows(board, band * 3 + 2, rows[2]);

            const cols = this._shuffle([0, 1, 2]).map(v => v + band * 3);
            this._swapCols(board, band * 3, cols[0]);
            this._swapCols(board, band * 3 + 1, cols[1]);
            this._swapCols(board, band * 3 + 2, cols[2]);
        }

        const digitMap = this._shuffle([1,2,3,4,5,6,7,8,9]);
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                board[r][c] = digitMap[board[r][c] - 1];
            }
        }
    }

    _isValid(board, row, col, num) {
        for (let i = 0; i < this.config.SIZE; i++) {
            if (board[row][i] === num || board[i][col] === num) return false;
        }

        const startRow = Math.floor(row / this.config.BOX_SIZE) * this.config.BOX_SIZE;
        const startCol = Math.floor(col / this.config.BOX_SIZE) * this.config.BOX_SIZE;
        for (let r = 0; r < this.config.BOX_SIZE; r++) {
            for (let c = 0; c < this.config.BOX_SIZE; c++) {
                if (board[startRow + r][startCol + c] === num) return false;
            }
        }
        return true;
    }

    _solve(board, limit = 1, preserveFirst = false) {
        let solutions = 0;
        let firstSolution = null;

        const findCell = () => {
            let best = null;
            let bestCount = 10;
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (board[r][c] !== 0) continue;
                    let count = 0;
                    for (let n = 1; n <= 9; n++) {
                        if (this._isValid(board, r, c, n)) count++;
                    }
                    if (count === 0) return [r, c, 0];
                    if (count < bestCount) {
                        bestCount = count;
                        best = [r, c, count];
                    }
                }
            }
            return best;
        };

        const backtrack = () => {
            if (solutions >= limit) return;
            const cell = findCell();
            if (!cell) {
                solutions++;
                if (preserveFirst && !firstSolution) firstSolution = this._clone(board);
                return;
            }

            const [row, col, count] = cell;
            if (count === 0) return;

            for (const n of this._shuffle([1,2,3,4,5,6,7,8,9])) {
                if (!this._isValid(board, row, col, n)) continue;
                board[row][col] = n;
                backtrack();
                board[row][col] = 0;
                if (solutions >= limit) return;
            }
        };

        backtrack();
        if (preserveFirst && firstSolution) {
            for (let r = 0; r < 9; r++) board[r] = [...firstSolution[r]];
        }
        return solutions;
    }

    _generateSolvedBoard() {
        const board = this._grid(0);

        for (let box = 0; box < 3; box++) {
            const start = box * 3;
            const nums = this._shuffle([1,2,3,4,5,6,7,8,9]);
            let idx = 0;
            for (let r = start; r < start + 3; r++) {
                for (let c = start; c < start + 3; c++) {
                    board[r][c] = nums[idx++];
                }
            }
        }

        this._solve(board, 1, true);
        this._randomizeSolvedBoard(board);
        return board;
    }

    _removeCells(solution, difficulty) {
        const puzzle = this._clone(solution);
        const targetRemovals = this.config.DIFFICULTY_REMOVALS[difficulty] || this.config.DIFFICULTY_REMOVALS.medium;
        const positions = [];

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) positions.push([r, c]);
        }

        let removed = 0;
        for (const [r, c] of this._shuffle(positions)) {
            if (removed >= targetRemovals) break;
            const backup = puzzle[r][c];
            puzzle[r][c] = 0;

            const test = this._clone(puzzle);
            if (this._solve(test, 2) === 1) {
                removed++;
            } else {
                puzzle[r][c] = backup;
            }
        }

        return puzzle;
    }

    generate(difficulty = 'medium') {
        const solution = this._generateSolvedBoard();
        const puzzle = this._removeCells(solution, difficulty);
        return { solution, puzzle };
    }
}

export default SudokuGenerator;
