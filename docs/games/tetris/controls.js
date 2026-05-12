import { TetrisDesktopControls } from './controls-desktop.js';
import { TetrisMobileControls } from './controls-mobile.js';

export class TetrisControls {
    constructor(game) {
        this.desktop = new TetrisDesktopControls(game);
        this.mobile = new TetrisMobileControls(game);
    }

    update() {
        this.desktop?.update?.();
        this.mobile?.update?.();
    }

    destroy() {
        this.desktop?.destroy?.();
        this.mobile?.destroy?.();
    }
}

export default TetrisControls;
