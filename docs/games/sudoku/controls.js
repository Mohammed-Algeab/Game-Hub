import { SudokuDesktopControls } from './controls-desktop.js';
import { SudokuMobileControls } from './controls-mobile.js';

export class SudokuControls {
    constructor(options = {}) {
        this.desktop = new SudokuDesktopControls(options);
        this.mobile = new SudokuMobileControls(options);
    }

    destroy() {
        this.desktop?.destroy?.();
        this.mobile?.destroy?.();
    }
}

export default SudokuControls;
