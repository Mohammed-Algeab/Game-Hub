export class SudokuDesktopControls {
    constructor(options = {}) {
        this.logic = options.logic;
        this.onUpdate = options.onUpdate || (() => {});
        this.onNewGame = options.onNewGame || (() => {});
        this._boundKeyDown = this._onKeyDown.bind(this);
        document.addEventListener('keydown', this._boundKeyDown);
    }

    _moveSelection(dr, dc) {
        const row = this.logic.selectedRow < 0 ? 4 : this.logic.selectedRow;
        const col = this.logic.selectedCol < 0 ? 4 : this.logic.selectedCol;
        const nr = Math.max(0, Math.min(8, row + dr));
        const nc = Math.max(0, Math.min(8, col + dc));
        this.logic.selectCell(nr, nc);
        this.onUpdate();
    }

    _onKeyDown(e) {
        if (this.logic.isComplete) return;

        if (e.key >= '1' && e.key <= '9') {
            this.logic.inputNumber(Number(e.key));
            this.onUpdate();
            return;
        }

        if (['0', 'Delete', 'Backspace'].includes(e.key)) {
            e.preventDefault();
            this.logic.eraseCell();
            this.onUpdate();
            return;
        }

        if (e.key === 'n' || e.key === 'N') {
            e.preventDefault();
            this.logic.toggleNoteMode();
            this.onUpdate();
            return;
        }

        const moves = {
            ArrowUp: [-1, 0],
            ArrowDown: [1, 0],
            ArrowLeft: [0, -1],
            ArrowRight: [0, 1]
        };
        if (moves[e.key]) {
            e.preventDefault();
            const [dr, dc] = moves[e.key];
            this._moveSelection(dr, dc);
        }
    }

    destroy() {
        document.removeEventListener('keydown', this._boundKeyDown);
    }
}

export default SudokuDesktopControls;
