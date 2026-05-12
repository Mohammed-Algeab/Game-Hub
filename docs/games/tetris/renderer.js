/**
 * renderer.js - Tetris Canvas Renderer
 */
import { CONFIG } from './config.js';

export class TetrisRenderer {
    constructor(canvas, nextCanvas, holdCanvas) {
        this.canvas     = canvas;
        this.ctx        = canvas.getContext('2d');
        this.nextCanvas = nextCanvas;
        this.nextCtx    = nextCanvas ? nextCanvas.getContext('2d') : null;
        this.holdCanvas = holdCanvas;
        this.holdCtx    = holdCanvas ? holdCanvas.getContext('2d') : null;

        this.cellSize = CONFIG.CELL_SIZE;
        this.calcCellSize();
        this.setupCanvas();

        this._resizeObserver = new ResizeObserver(() => {
            this.calcCellSize();
            this.setupCanvas();
        });
        const container = canvas.closest('.board-container') || canvas.parentElement;
        if (container) this._resizeObserver.observe(container);
    }

    calcCellSize() {
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            // Header ~50px + sidebar ~60px + footer ~0 + D-pad ~88px + gaps ~20px
            const availH = window.innerHeight - 50 - 60 - 88 - 30;
            const availW = window.innerWidth - 16;
            this.cellSize = Math.min(Math.floor(availH / CONFIG.ROWS), Math.floor(availW / CONFIG.COLS), 28);
        } else {
            const maxH = window.innerHeight - 180;
            const maxW = window.innerWidth - 340;
            this.cellSize = Math.min(Math.floor(maxH / CONFIG.ROWS), Math.floor(maxW / CONFIG.COLS), CONFIG.CELL_SIZE);
        }
        this.cellSize = Math.max(this.cellSize, 14);
    }

    setupCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const W = CONFIG.COLS * this.cellSize;
        const H = CONFIG.ROWS * this.cellSize;

        // Main canvas — reset transform before scaling to avoid cumulative scale
        this.canvas.width  = W * dpr;
        this.canvas.height = H * dpr;
        this.canvas.style.width  = W + 'px';
        this.canvas.style.height = H + 'px';
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);

        // Preview canvases — reset + resize + scale each time
        const previewCells = 4;
        const previewSize  = previewCells * this.cellSize;

        if (this.nextCtx && this.nextCanvas) {
            this.nextCanvas.width  = previewSize * dpr;
            this.nextCanvas.height = previewSize * dpr;
            this.nextCanvas.style.width  = previewSize + 'px';
            this.nextCanvas.style.height = previewSize + 'px';
            this.nextCtx.setTransform(1, 0, 0, 1, 0, 0);
            this.nextCtx.scale(dpr, dpr);
        }

        if (this.holdCtx && this.holdCanvas) {
            this.holdCanvas.width  = previewSize * dpr;
            this.holdCanvas.height = previewSize * dpr;
            this.holdCanvas.style.width  = previewSize + 'px';
            this.holdCanvas.style.height = previewSize + 'px';
            this.holdCtx.setTransform(1, 0, 0, 1, 0, 0);
            this.holdCtx.scale(dpr, dpr);
        }
    }

    render(logic) {
        this.clear();
        this.drawBoard(logic.board);
        this.drawGrid();

        if (!logic.gameOver && !logic.paused) {
            this.drawGhost(logic);
            this.drawCurrentPiece(logic);
        }

        this.drawPreview(logic);
        this.drawHold(logic);

        if (logic.paused)   this.drawOverlay('PAUSED', 'اضغط P للمتابعة');
        if (logic.gameOver) {
            const msg = window.innerWidth < 768 ? 'إلمس الشاشة للبدء' : 'اضغط Enter للبدء';
            this.drawOverlay('GAME OVER', msg);
        }
    }

    drawOverlay(title, subtitle) {
        const width  = CONFIG.COLS * this.cellSize;
        const height = CONFIG.ROWS * this.cellSize;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.fillStyle = title === 'GAME OVER' ? '#ff4444' : '#ffffff';
        this.ctx.font = `bold ${Math.floor(this.cellSize * 1.1)}px Tahoma`;
        this.ctx.textAlign    = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(title, width / 2, height / 2 - this.cellSize);

        if (subtitle) {
            this.ctx.fillStyle = '#e0e0e0';
            this.ctx.font = `${Math.floor(this.cellSize * 0.6)}px Tahoma`;
            this.ctx.fillText(subtitle, width / 2, height / 2 + this.cellSize);
        }
    }

    clear() {
        this.ctx.clearRect(0, 0, CONFIG.COLS * this.cellSize, CONFIG.ROWS * this.cellSize);
    }

    drawBoard(board) {
        board.forEach((row, r) => {
            row.forEach((cell, c) => {
                if (cell) this.drawCell(this.ctx, c, r, cell, this.cellSize);
            });
        });
    }

    drawGrid() {
        const cs = this.cellSize;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth   = 0.5;
        for (let c = 0; c <= CONFIG.COLS; c++) {
            this.ctx.beginPath(); this.ctx.moveTo(c * cs, 0); this.ctx.lineTo(c * cs, CONFIG.ROWS * cs); this.ctx.stroke();
        }
        for (let r = 0; r <= CONFIG.ROWS; r++) {
            this.ctx.beginPath(); this.ctx.moveTo(0, r * cs); this.ctx.lineTo(CONFIG.COLS * cs, r * cs); this.ctx.stroke();
        }
    }

    drawGhost(logic) {
        const ghost = logic.getGhostPosition();
        if (!ghost || !logic.currentPiece) return;
        const shape = logic.getCurrentShape();
        shape.forEach((row, r) => {
            row.forEach((cell, c) => {
                if (cell) {
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    this.ctx.fillRect((ghost.col + c) * this.cellSize + 1, (ghost.row + r) * this.cellSize + 1, this.cellSize - 2, this.cellSize - 2);
                }
            });
        });
    }

    drawCurrentPiece(logic) {
        if (!logic.currentPiece) return;
        const shape = logic.getCurrentShape();
        shape.forEach((row, r) => {
            row.forEach((cell, c) => {
                if (cell) this.drawCell(this.ctx, logic.currentPiece.col + c, logic.currentPiece.row + r, logic.currentPiece.color, this.cellSize);
            });
        });
    }

    drawPreview(logic) {
        if (!this.nextCtx || !logic.nextPiece) return;
        const ps = 4 * this.cellSize;
        this.nextCtx.clearRect(0, 0, ps, ps);
        const shape = logic.getNextShape();
        shape.forEach((row, r) => row.forEach((cell, c) => {
            if (cell) this.drawCell(this.nextCtx, c + 1, r + 1, logic.nextPiece.color, this.cellSize);
        }));
    }

    drawHold(logic) {
        if (!this.holdCtx || !logic.heldPiece) return;
        const ps = 4 * this.cellSize;
        this.holdCtx.clearRect(0, 0, ps, ps);
        const shape = logic.getShape(logic.heldPiece.type, 0);
        shape.forEach((row, r) => row.forEach((cell, c) => {
            if (cell) this.drawCell(this.holdCtx, c + 1, r + 1, logic.heldPiece.color, this.cellSize);
        }));
    }

    drawCell(ctx, col, row, color, cs) {
        const x = col * cs, y = row * cs, p = 1;
        ctx.fillStyle = color;
        ctx.fillRect(x + p, y + p, cs - 2 * p, cs - 2 * p);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(x + p, y + p, cs - 2 * p, 3);
        ctx.fillRect(x + p, y + p, 3, cs - 2 * p);
    }
}

export default TetrisRenderer;
