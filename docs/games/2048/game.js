/**
 * game.js - لعبة 2048 الاحترافية
 * تتضمن: منطق اللعبة، الرسم، التحكم (كيبورد + لمس + أزرار)
 * هيكلية احترافية مطابقة لجودة باقي المشروع
 */

export class Game2048 {
    constructor(foundation = null) {
        this.foundation = foundation;   // GameFoundation — اختياري
        this.size = 4;
        this.grid = [];
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('2048-best') || '0');
        this.won = false;
        this.keepPlaying = false;
        this.over = false;
        this.animating = false;

        // DOM Elements
        this.tileContainer = document.getElementById('tile-container');
        this.scoreEl = document.getElementById('score-value');
        this.bestScoreEl = document.getElementById('best-score');
        this.winOverlay = document.getElementById('win-overlay');
        this.gameoverOverlay = document.getElementById('gameover-overlay');
        this.gridContainer = document.getElementById('grid-container');

        if (!this.tileContainer || !this.scoreEl || !this.bestScoreEl) {
            console.error('2048: Required DOM elements not found');
            return;
        }

        this.bestScoreEl.textContent = this.bestScore;

        this._init();
        this._bindEvents();
        
        // ─── GameHub Integration ────────────────────────────────────────
        this._initGameHub();
    }

    async _initGameHub() {
        try {
            const { GameHubAPI } = await import('../../foundation/gamehub-api.js');
            this._gh = GameHubAPI;
            await this._gh.auth.init();
            await this._gh.achievements.init();
        } catch (e) {
            console.warn('[2048] GameHub not available:', e.message);
        }
    }

    async _startGHSession() {
        if (this._gh) {
            this._ghSession = await this._gh.onGameStart('2048');
        }
    }

    async _endGHSession(isWin = false) {
        if (this._gh && this._ghSession) {
            await this._gh.onGameEnd(this._ghSession, {
                score: this.score,
                isWin,
                level: this._highestTile(),
                highestTile: this._highestTile()
            });
            this._ghSession = null;
        }
    }

    _init() {
        this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(null));
        this.score = 0;
        this.won = false;
        this.keepPlaying = false;
        this.over = false;
        this.animating = false;
        this._updateScore(0);
        
        // بدء جلسة GameHub
        this._startGHSession();
        this._clearTiles();
        this._addRandomTile();
        this._addRandomTile();
        this._render();
        this._hideOverlays();
    }

    _hideOverlays() {
        if (this.winOverlay) this.winOverlay.style.display = 'none';
        if (this.gameoverOverlay) this.gameoverOverlay.style.display = 'none';
    }

    _clearTiles() {
        if (this.tileContainer) this.tileContainer.innerHTML = '';
    }

    _emptyCells() {
        const cells = [];
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (!this.grid[r][c]) cells.push({ r, c });
            }
        }
        return cells;
    }

    _addRandomTile() {
        const empty = this._emptyCells();
        if (empty.length === 0) return;
        const { r, c } = empty[Math.floor(Math.random() * empty.length)];
        const value = Math.random() < 0.9 ? 2 : 4;
        this.grid[r][c] = { value, id: Date.now() + Math.random(), isNew: true };
    }

    _render() {
        if (!this.tileContainer) return;
        this.tileContainer.innerHTML = '';

        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const tile = this.grid[r][c];
                if (tile) {
                    const el = document.createElement('div');
                    el.className = `tile tile-${tile.value}`;
                    if (tile.isNew) el.classList.add('tile-new');
                    if (tile.merged) el.classList.add('tile-merged');

                    el.textContent = tile.value;

                    // حساب الموضع بالنسبة المئوية
                    const left = c * 25;
                    const top = r * 25;
                    el.style.left = `${left}%`;
                    el.style.top = `${top}%`;

                    this.tileContainer.appendChild(el);

                    // إزالة كلاسات الأنيميشن
                    if (tile.isNew) {
                        setTimeout(() => {
                            tile.isNew = false;
                            el.classList.remove('tile-new');
                        }, 300);
                    }
                    if (tile.merged) {
                        setTimeout(() => {
                            tile.merged = false;
                            el.classList.remove('tile-merged');
                        }, 300);
                    }
                }
            }
        }
    }

    _updateScore(add) {
        this.score += add;
        if (this.scoreEl) this.scoreEl.textContent = this.score;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            if (this.bestScoreEl) this.bestScoreEl.textContent = this.bestScore;
            localStorage.setItem('2048-best', this.bestScore);
        }
        // Foundation bridge
        this.foundation?.setScore(this.score);
        this.foundation?.updateAIContext({ highestTile: this._highestTile() });
    }

    _highestTile() {
        let max = 0;
        for (const row of this.grid)
            for (const cell of row)
                if (cell && cell.value > max) max = cell.value;
        return max;
    }

    _move(direction) {
        if (this.over || this.animating) return;

        const vectors = {
            up:    { x: 0, y: -1 },
            down:  { x: 0, y: 1 },
            left:  { x: -1, y: 0 },
            right: { x: 1, y: 0 }
        };

        const vector = vectors[direction];
        const traversals = this._buildTraversals(vector);
        let moved = false;
        let scoreAdd = 0;

        const newGrid = this.grid.map(row => row.map(cell => cell ? { ...cell } : null));
        const merged = Array.from({ length: this.size }, () => Array(this.size).fill(false));

        traversals.x.forEach(x => {
            traversals.y.forEach(y => {
                const cell = newGrid[y][x];
                if (cell) {
                    const positions = this._findFarthestPosition(newGrid, { x, y }, vector);
                    const next = positions.next;

                    if (next && newGrid[next.y][next.x] && 
                        newGrid[next.y][next.x].value === cell.value && 
                        !merged[next.y][next.x]) {
                        // دمج
                        const mergedValue = cell.value * 2;
                        newGrid[next.y][next.x] = { 
                            value: mergedValue, 
                            id: Date.now() + Math.random(),
                            merged: true 
                        };
                        merged[next.y][next.x] = true;
                        newGrid[y][x] = null;
                        scoreAdd += mergedValue;
                        moved = true;

                        if (mergedValue === 2048 && !this.won) {
                            this.won = true;
                        }
                    } else {
                        // تحريك فقط
                        if (positions.farthest.x !== x || positions.farthest.y !== y) {
                            newGrid[positions.farthest.y][positions.farthest.x] = cell;
                            newGrid[y][x] = null;
                            moved = true;
                        }
                    }
                }
            });
        });

        if (moved) {
            this.animating = true;
            this.grid = newGrid;
            this._updateScore(scoreAdd);
            this._addRandomTile();
            this._render();

            setTimeout(() => {
                this.animating = false;

                if (this.won && !this.keepPlaying) {
                    this._showWin();
                }

                if (!this._movesAvailable()) {
                    this.over = true;
                    this._showGameOver();
                }
            }, 150);
        }
    }

    _buildTraversals(vector) {
        const traversals = { x: [], y: [] };
        for (let pos = 0; pos < this.size; pos++) {
            traversals.x.push(pos);
            traversals.y.push(pos);
        }
        if (vector.x === 1) traversals.x.reverse();
        if (vector.y === 1) traversals.y.reverse();
        return traversals;
    }

    _findFarthestPosition(grid, cell, vector) {
        let previous;
        let current = { x: cell.x, y: cell.y };

        do {
            previous = current;
            current = { x: previous.x + vector.x, y: previous.y + vector.y };
        } while (
            current.x >= 0 && current.x < this.size &&
            current.y >= 0 && current.y < this.size &&
            !grid[current.y][current.x]
        );

        return {
            farthest: previous,
            next: (current.x >= 0 && current.x < this.size && current.y >= 0 && current.y < this.size) ? current : null
        };
    }

    _movesAvailable() {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (!this.grid[r][c]) return true;
                if (c < this.size - 1 && this.grid[r][c].value === this.grid[r][c + 1].value) return true;
                if (r < this.size - 1 && this.grid[r][c].value === this.grid[r + 1][c].value) return true;
            }
        }
        return false;
    }

    _showWin() {
        const winScore = document.getElementById('win-score');
        if (winScore) winScore.textContent = this.score;
        if (this.winOverlay) this.winOverlay.style.display = 'flex';
        // Foundation bridge — نبلّغ AI بالفوز لكن لا نغلق اللعبة
        this.foundation?.updateAIContext({ event: 'reached_2048', score: this.score });
        // ─── GameHub: إنهاء الجلسة بفوز + إنجاز 2048 ───────────────────
        if (this._gh && this._ghSession) {
            this._gh.onGameEnd(this._ghSession, {
                score: this.score,
                isWin: true,
                level: this._highestTile(),
                highestTile: this._highestTile()
            }).catch(() => {});
            this._ghSession = null;
        }
        if (this._gh) {
            this._gh.achievements.updateProgress('2048', 'highest_tile', 2048);
        }
    }

    _showGameOver() {
        const gameoverScore = document.getElementById('gameover-score');
        if (gameoverScore) gameoverScore.textContent = this.score;
        if (this.gameoverOverlay) this.gameoverOverlay.style.display = 'flex';
        
        // ─── GameHub: إنهاء الجلسة والإنجازات ────────────────────────────
        this._endGHSession(false);
        if (this._gh) {
            this._gh.achievements.updateProgress('2048', 'score', this.score);
            this._gh.achievements.updateProgress('2048', 'highest_tile', this._highestTile());
        }
        
        // Foundation bridge
        this.foundation?.showGameOver({
            score:   this.score,
            title:   'انتهت اللعبة!',
            message: `أعلى مربع وصلت إليه: ${this._highestTile()}`,
            icon:    '🔲',
        });
    }

    _bindEvents() {
        // كيبورد
        document.addEventListener('keydown', (e) => {
            const map = {
                'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right',
                'w': 'up', 's': 'down', 'a': 'left', 'd': 'right',
                'W': 'up', 'S': 'down', 'A': 'left', 'D': 'right'
            };
            if (map[e.key]) {
                e.preventDefault();
                this._move(map[e.key]);
            }
        });

        // لمس / سحب
        let touchStartX = 0, touchStartY = 0;
        const container = this.gridContainer;

        if (container) {
            container.addEventListener('touchstart', (e) => {
                if (e.touches.length > 1) return;
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }, { passive: true });

            container.addEventListener('touchend', (e) => {
                if (!touchStartX && !touchStartY) return;
                const dx = e.changedTouches[0].clientX - touchStartX;
                const dy = e.changedTouches[0].clientY - touchStartY;
                const absDx = Math.abs(dx);
                const absDy = Math.abs(dy);

                if (Math.max(absDx, absDy) > 30) {
                    if (absDx > absDy) {
                        this._move(dx > 0 ? 'right' : 'left');
                    } else {
                        this._move(dy > 0 ? 'down' : 'up');
                    }
                }
                touchStartX = 0;
                touchStartY = 0;
            }, { passive: true });
        }

        // أزرار
        const newGameBtn = document.getElementById('new-game-btn');
        const continueBtn = document.getElementById('continue-btn');
        const winNewGame = document.getElementById('win-new-game');
        const gameoverNewGame = document.getElementById('gameover-new-game');

        if (newGameBtn) newGameBtn.addEventListener('click', () => this._init());
        if (continueBtn) continueBtn.addEventListener('click', () => {
            this.keepPlaying = true;
            if (this.winOverlay) this.winOverlay.style.display = 'none';
        });
        if (winNewGame) winNewGame.addEventListener('click', () => this._init());
        if (gameoverNewGame) gameoverNewGame.addEventListener('click', () => this._init());
    }
}

export default Game2048;
