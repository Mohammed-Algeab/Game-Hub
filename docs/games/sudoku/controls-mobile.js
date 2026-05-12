export class SudokuMobileControls {
    constructor(options = {}) {
        this.logic = options.logic;
        this.gridEl = options.gridEl;
        this.onUpdate = options.onUpdate || (() => {});
        this._touchStart = null;

        if (this.gridEl) {
            this.gridEl.style.touchAction = 'manipulation';
            this.gridEl.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: true });
            this.gridEl.addEventListener('touchend', this._onTouchEnd.bind(this), { passive: false });
        }
    }

    _onTouchStart(e) {
        const touch = e.touches[0];
        this._touchStart = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now()
        };
    }

    _onTouchEnd(e) {
        if (!this._touchStart) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - this._touchStart.x;
        const dy = touch.clientY - this._touchStart.y;
        const dt = Date.now() - this._touchStart.time;

        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (absDx < 18 && absDy < 18 && dt < 350) {
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            const cell = target?.closest?.('.sudoku-cell');
            if (cell) {
                this.logic.selectCell(Number(cell.dataset.row), Number(cell.dataset.col));
                this.onUpdate();
            }
            return;
        }

        if (Math.max(absDx, absDy) > 35) {
            const row = this.logic.selectedRow < 0 ? 4 : this.logic.selectedRow;
            const col = this.logic.selectedCol < 0 ? 4 : this.logic.selectedCol;
            if (absDx > absDy) {
                this.logic.selectCell(row, Math.max(0, Math.min(8, col + (dx > 0 ? 1 : -1))));
            } else {
                this.logic.selectCell(Math.max(0, Math.min(8, row + (dy > 0 ? 1 : -1))), col);
            }
            this.onUpdate();
        }
    }

    destroy() {}
}

export default SudokuMobileControls;
