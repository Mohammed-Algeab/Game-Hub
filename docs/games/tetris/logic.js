import { CONFIG } from './config.js';
import { getShape, isCollision, clearCompletedLines, getGhostRow, tryWallKick } from './collision.js';

export class TetrisLogic {
    constructor() {
        this.reset();
    }

    reset() {
        this.board = Array(CONFIG.ROWS).fill(null).map(() => Array(CONFIG.COLS).fill(null));
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.gameOver = false;
        this.paused = false;
        this.heldPiece = null;
        this.canHold = true;
        this.currentPiece = null;
        this.currentRotation = 0;
        this.nextPiece = null;
        this.nextRotation = 0;
        this.linesThisSession = 0;
        this.generateNextPiece();
        this.spawnPiece();
    }

    randomPiece() {
        const types = Object.keys(CONFIG.PIECES);
        return types[Math.floor(Math.random() * types.length)];
    }

    createPieceObject(type, rotation = 0) {
        const shape = getShape(type, rotation);
        const color = CONFIG.COLORS[type];
        return { type, shape, color, row: 0, col: 0, rotation };
    }

    generateNextPiece() {
        const type = this.randomPiece();
        const rotation = Math.floor(Math.random() * 4);
        this.nextPiece = this.createPieceObject(type, rotation);
        this.nextRotation = rotation;
    }

    spawnPiece() {
        if (this.gameOver) return;
        this.currentPiece = { ...this.nextPiece };
        const spawn = CONFIG.SPAWN[this.currentPiece.type];
        this.currentPiece.row = spawn.y;
        this.currentPiece.col = spawn.x;
        this.currentRotation = this.nextRotation;
        this.currentPiece.rotation = this.nextRotation;
        this.generateNextPiece();
        this.canHold = true;

        if (isCollision(this.board, this.currentPiece.type, this.currentRotation, this.currentPiece.col, this.currentPiece.row)) {
            this.gameOver = true;
        }
    }

    getShape(pieceType, rotation) {
        return getShape(pieceType, rotation);
    }

    isCollision(x, y, rotation, pieceType = this.currentPiece?.type) {
        if (!pieceType) return false;
        return isCollision(this.board, pieceType, rotation, x, y);
    }

    lockPiece() {
        if (!this.currentPiece) return;
        const shape = this.getShape(this.currentPiece.type, this.currentRotation);
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const boardY = this.currentPiece.row + row;
                    const boardX = this.currentPiece.col + col;
                    if (boardY >= 0) this.board[boardY][boardX] = this.currentPiece.color;
                }
            }
        }

        const linesCleared = clearCompletedLines(this.board);
        if (linesCleared > 0) {
            this.lines += linesCleared;
            this.score += CONFIG.SCORE[linesCleared] || 0;
            this.level = Math.floor(this.lines / CONFIG.LEVEL_LINES) + 1;
        }

        this.spawnPiece();
    }

    moveLeft() {
        if (this.gameOver || this.paused) return false;
        if (!this.isCollision(this.currentPiece.col - 1, this.currentPiece.row, this.currentRotation)) {
            this.currentPiece.col -= 1;
            return true;
        }
        return false;
    }

    moveRight() {
        if (this.gameOver || this.paused) return false;
        if (!this.isCollision(this.currentPiece.col + 1, this.currentPiece.row, this.currentRotation)) {
            this.currentPiece.col += 1;
            return true;
        }
        return false;
    }

    softDrop() {
        if (this.gameOver || this.paused) return false;
        if (!this.isCollision(this.currentPiece.col, this.currentPiece.row + 1, this.currentRotation)) {
            this.currentPiece.row += 1;
            this.score += CONFIG.SOFT_DROP_SCORE;
            return true;
        }
        this.lockPiece();
        return false;
    }

    hardDrop() {
        if (this.gameOver || this.paused) return 0;
        let dropDistance = 0;
        while (!this.isCollision(this.currentPiece.col, this.currentPiece.row + 1, this.currentRotation)) {
            this.currentPiece.row += 1;
            dropDistance += 1;
        }
        this.score += dropDistance * CONFIG.HARD_DROP_MULTIPLIER * this.level;
        this.lockPiece();
        return dropDistance;
    }

    rotateCW() {
        if (this.gameOver || this.paused) return false;
        const newRotation = (this.currentRotation + 1) % 4;
        const kick = tryWallKick(this.board, this.currentPiece, this.currentRotation, newRotation);
        if (kick) {
            this.currentPiece.col = kick.col;
            this.currentPiece.row = kick.row;
            this.currentRotation = kick.rotation;
            this.currentPiece.rotation = kick.rotation;
            this.currentPiece.shape = this.getShape(this.currentPiece.type, kick.rotation);
            return true;
        }
        return false;
    }

    rotateCCW() {
        if (this.gameOver || this.paused) return false;
        const newRotation = (this.currentRotation + 3) % 4;
        const kick = tryWallKick(this.board, this.currentPiece, this.currentRotation, newRotation);
        if (kick) {
            this.currentPiece.col = kick.col;
            this.currentPiece.row = kick.row;
            this.currentRotation = kick.rotation;
            this.currentPiece.rotation = kick.rotation;
            this.currentPiece.shape = this.getShape(this.currentPiece.type, kick.rotation);
            return true;
        }
        return false;
    }

    holdPiece() {
        if (!this.canHold || !this.currentPiece || this.gameOver || this.paused) return;
        if (this.heldPiece === null) {
            this.heldPiece = this.createPieceObject(this.currentPiece.type, 0);
            this.spawnPiece();
        } else {
            const currentType = this.currentPiece.type;
            const spawn = CONFIG.SPAWN[this.heldPiece.type];
            this.currentPiece = { ...this.heldPiece };
            this.currentPiece.row = spawn.y;
            this.currentPiece.col = spawn.x;
            this.currentRotation = 0;
            this.currentPiece.rotation = 0;
            this.currentPiece.shape = this.getShape(this.currentPiece.type, 0);
            this.heldPiece = this.createPieceObject(currentType, 0);
            if (this.isCollision(this.currentPiece.col, this.currentPiece.row, this.currentRotation)) {
                this.gameOver = true;
            }
        }
        this.canHold = false;
    }

    togglePause() {
        if (this.gameOver) return;
        this.paused = !this.paused;
    }

    getGhostPosition() {
        if (!this.currentPiece) return null;
        return { row: getGhostRow(this.board, this.currentPiece.type, this.currentRotation, this.currentPiece.col, this.currentPiece.row), col: this.currentPiece.col };
    }

    getDropInterval() {
        const speed = CONFIG.INITIAL_SPEED - (this.level - 1) * CONFIG.SPEED_DECREMENT;
        return Math.max(speed, CONFIG.MIN_SPEED);
    }

    getCurrentShape() {
        if (!this.currentPiece) return null;
        return this.getShape(this.currentPiece.type, this.currentRotation);
    }

    getNextShape() {
        if (!this.nextPiece) return null;
        return this.getShape(this.nextPiece.type, 0);
    }

    getHeldShape() {
        return this.heldPiece ? this.getShape(this.heldPiece.type, 0) : null;
    }
}

export default TetrisLogic;
