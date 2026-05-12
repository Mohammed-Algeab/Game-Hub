/**
 * game.js - لعبة الثعبان الاحترافية
 * تتضمن: منطق اللعبة، الرسم على Canvas، التحكم (كيبورد + لمس + D-Pad)
 * هيكلية احترافية مطابقة لجودة باقي المشروع
 */

export class SnakeGame {
    constructor(foundation = null) {
        this.foundation = foundation;   // GameFoundation — اختياري
        this.canvas = document.getElementById('snake-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.scoreEl = document.getElementById('score-value');
        this.bestScoreEl = document.getElementById('best-score');
        this.levelEl = document.getElementById('level-value');
        this.overlay = document.getElementById('game-overlay');
        this.gameoverOverlay = document.getElementById('gameover-overlay');
        this.mobileControls = document.getElementById('mobile-controls');

        if (!this.canvas || !this.ctx) {
            console.error('Snake: Canvas element not found');
            return;
        }

        this.gridSize = 20;
        this.tileCount = 20;
        this.snake = [];
        this.food = null;
        this.direction = { x: 0, y: 0 };
        this.nextDirection = { x: 0, y: 0 };
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('snake-best') || '0');
        this.level = 1;
        this.speed = 150;
        this.gameLoop = null;
        this.isRunning = false;
        this.isPaused = false;

        this.colors = {
            bg: '#0a0e1a',
            grid: 'rgba(99, 102, 241, 0.08)',
            snakeHead: '#10b981',
            snakeBody: '#059669',
            snakeGlow: 'rgba(16, 185, 129, 0.3)',
            food: '#f59e0b',
            foodGlow: 'rgba(245, 158, 11, 0.4)',
            border: 'rgba(99, 102, 241, 0.2)'
        };

        if (this.bestScoreEl) this.bestScoreEl.textContent = this.bestScore;

        this._resize();
        this._bindEvents();
        this._draw();

        // ─── GameHub Integration ────────────────────────────────────────
        this._initGameHub();

        window.addEventListener('resize', () => {
            this._resize();
            this._draw();
        });
    }

    async _initGameHub() {
        try {
            const { GameHubAPI } = await import('../../foundation/gamehub-api.js');
            this._gh = GameHubAPI;
            await this._gh.auth.init();
            await this._gh.achievements.init();
        } catch (e) {
            console.warn('[Snake] GameHub not available:', e.message);
        }
    }

    async _startGHSession() {
        if (this._gh) {
            this._ghSession = await this._gh.onGameStart('snake');
        }
    }

    async _endGHSession(isWin = false) {
        if (this._gh && this._ghSession) {
            await this._gh.onGameEnd(this._ghSession, {
                score: this.score,
                isWin,
                level: this.level,
                snakeLength: this.snake.length
            });
            this._ghSession = null;
        }
    }

    async _checkScoreAchievements() {
        if (!this._gh) return;
        await this._gh.achievements.updateProgress('snake', 'score', this.score);
        await this._gh.achievements.updateProgress('snake', 'snake_length', this.snake.length);
        await this._gh.achievements.updateProgress('snake', 'level', this.level);
    }

    _resize() {
        if (!this.canvas) return;
        const container = this.canvas.parentElement;
        if (!container) return;

        const maxSize = Math.min(container.clientWidth - 32, container.clientHeight - 32, 500);
        const size = Math.floor(maxSize / this.tileCount) * this.tileCount;

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = size * dpr;
        this.canvas.height = size * dpr;
        this.canvas.style.width = size + 'px';
        this.canvas.style.height = size + 'px';
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);

        this.cellSize = size / this.tileCount;
    }

    _init() {
        const startX = Math.floor(this.tileCount / 2);
        const startY = Math.floor(this.tileCount / 2);
        this.snake = [
            { x: startX, y: startY },
            { x: startX - 1, y: startY },
            { x: startX - 2, y: startY }
        ];
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.score = 0;
        this.level = 1;
        this.speed = 150;
        this.isRunning = true;
        this.isPaused = false;
        this._spawnFood();
        this._updateUI();
        if (this.overlay) this.overlay.style.display = 'none';
        if (this.gameoverOverlay) this.gameoverOverlay.style.display = 'none';

        // بدء جلسة GameHub
        this._startGHSession();

        if (this.gameLoop) clearInterval(this.gameLoop);
        this.gameLoop = setInterval(() => this._update(), this.speed);
    }

    _spawnFood() {
        let pos;
        do {
            pos = {
                x: Math.floor(Math.random() * this.tileCount),
                y: Math.floor(Math.random() * this.tileCount)
            };
        } while (this.snake.some(s => s.x === pos.x && s.y === pos.y));
        this.food = pos;
    }

    _update() {
        if (!this.isRunning || this.isPaused) return;

        this.direction = { ...this.nextDirection };

        const head = { 
            x: this.snake[0].x + this.direction.x, 
            y: this.snake[0].y + this.direction.y 
        };

        // اصطدام بالجدران
        if (head.x < 0 || head.x >= this.tileCount || head.y < 0 || head.y >= this.tileCount) {
            this._gameOver();
            return;
        }

        // اصطدام بالجسم
        if (this.snake.some(s => s.x === head.x && s.y === head.y)) {
            this._gameOver();
            return;
        }

        this.snake.unshift(head);

        // أكل الطعام
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10 * this.level;
            this._spawnFood();

            // زيادة المستوى كل 50 نقطة
            const newLevel = Math.floor(this.score / 50) + 1;
            if (newLevel > this.level) {
                this.level = newLevel;
                this.speed = Math.max(60, 150 - (this.level - 1) * 10);
                clearInterval(this.gameLoop);
                this.gameLoop = setInterval(() => this._update(), this.speed);
            }
        } else {
            this.snake.pop();
        }

        this._updateUI();
        this._draw();
    }

    _draw() {
        if (!this.ctx || !this.canvas) return;

        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);
        const cs = this.cellSize;

        // خلفية
        this.ctx.fillStyle = this.colors.bg;
        this.ctx.fillRect(0, 0, w, h);

        // شبكة
        this.ctx.strokeStyle = this.colors.grid;
        this.ctx.lineWidth = 0.5;
        for (let i = 0; i <= this.tileCount; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * cs, 0);
            this.ctx.lineTo(i * cs, h);
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.moveTo(0, i * cs);
            this.ctx.lineTo(w, i * cs);
            this.ctx.stroke();
        }

        // حدود
        this.ctx.strokeStyle = this.colors.border;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, w, h);

        // الطعام
        if (this.food) {
            const fx = this.food.x * cs;
            const fy = this.food.y * cs;

            // توهج
            this.ctx.shadowColor = this.colors.foodGlow;
            this.ctx.shadowBlur = 15;
            this.ctx.fillStyle = this.colors.food;
            this.ctx.beginPath();
            this.ctx.arc(fx + cs/2, fy + cs/2, cs/2 - 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // لمعان
            this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
            this.ctx.beginPath();
            this.ctx.arc(fx + cs/2 - 2, fy + cs/2 - 2, cs/4, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // الثعبان
        this.snake.forEach((segment, i) => {
            const sx = segment.x * cs;
            const sy = segment.y * cs;
            const isHead = i === 0;

            // توهج للرأس
            if (isHead) {
                this.ctx.shadowColor = this.colors.snakeGlow;
                this.ctx.shadowBlur = 10;
            }

            this.ctx.fillStyle = isHead ? this.colors.snakeHead : this.colors.snakeBody;
            this.ctx.fillRect(sx + 1, sy + 1, cs - 2, cs - 2);
            this.ctx.shadowBlur = 0;

            // عيون للرأس
            if (isHead) {
                this.ctx.fillStyle = '#fff';
                const eyeSize = cs / 5;
                const eyeOffset = cs / 4;

                let ex1, ey1, ex2, ey2;
                if (this.direction.x === 1) {
                    ex1 = sx + cs - eyeOffset; ey1 = sy + eyeOffset;
                    ex2 = sx + cs - eyeOffset; ey2 = sy + cs - eyeOffset;
                } else if (this.direction.x === -1) {
                    ex1 = sx + eyeOffset; ey1 = sy + eyeOffset;
                    ex2 = sx + eyeOffset; ey2 = sy + cs - eyeOffset;
                } else if (this.direction.y === -1) {
                    ex1 = sx + eyeOffset; ey1 = sy + eyeOffset;
                    ex2 = sx + cs - eyeOffset; ey2 = sy + eyeOffset;
                } else {
                    ex1 = sx + eyeOffset; ey1 = sy + cs - eyeOffset;
                    ex2 = sx + cs - eyeOffset; ey2 = sy + cs - eyeOffset;
                }

                this.ctx.beginPath();
                this.ctx.arc(ex1, ey1, eyeSize, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.arc(ex2, ey2, eyeSize, 0, Math.PI * 2);
                this.ctx.fill();

                // بؤبؤ
                this.ctx.fillStyle = '#000';
                this.ctx.beginPath();
                this.ctx.arc(ex1 + this.direction.x * 1, ey1 + this.direction.y * 1, eyeSize/2, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.arc(ex2 + this.direction.x * 1, ey2 + this.direction.y * 1, eyeSize/2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });
    }

    _updateUI() {
        if (this.scoreEl) this.scoreEl.textContent = this.score;
        if (this.levelEl) this.levelEl.textContent = this.level;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            if (this.bestScoreEl) this.bestScoreEl.textContent = this.bestScore;
            localStorage.setItem('snake-best', this.bestScore);
        }
        // Foundation bridge
        this.foundation?.setScore(this.score);
        this.foundation?.setLevel(this.level);
        this.foundation?.updateAIContext({
            snakeLength: this.snake.length,
            speed:       this.speed,
        });

        // ─── GameHub: تحقق من إنجازات النقاط ────────────────────────────
        if (this._gh && this.score > 0 && this.score % 50 === 0) {
            this._checkScoreAchievements();
        }
    }

    _gameOver() {
        this.isRunning = false;
        if (this.gameLoop) clearInterval(this.gameLoop);
        const gameoverScore = document.getElementById('gameover-score');
        const gameoverLevel = document.getElementById('gameover-level');
        if (gameoverScore) gameoverScore.textContent = this.score;
        if (gameoverLevel) gameoverLevel.textContent = this.level;
        if (this.gameoverOverlay) this.gameoverOverlay.style.display = 'flex';
        
        // ─── GameHub: إنهاء الجلسة والإنجازات ────────────────────────────
        this._endGHSession(false);
        
        // Foundation bridge
        this.foundation?.showGameOver({
            score:   this.score,
            title:   'انتهت اللعبة!',
            message: `طول الثعبان ${this.snake.length} — المستوى ${this.level}`,
            icon:    '🐍',
        });
    }

    _setDirection(dir) {
        if (!this.isRunning) {
            if (!this.isPaused) this._init();
            return;
        }

        const opposites = {
            up: 'down', down: 'up', left: 'right', right: 'left'
        };

        const currentDir = this._getDirectionName(this.direction);
        if (opposites[dir] === currentDir) return;

        const dirs = {
            up: { x: 0, y: -1 },
            down: { x: 0, y: 1 },
            left: { x: -1, y: 0 },
            right: { x: 1, y: 0 }
        };

        this.nextDirection = dirs[dir];
    }

    _getDirectionName(dir) {
        if (dir.x === 0 && dir.y === -1) return 'up';
        if (dir.x === 0 && dir.y === 1) return 'down';
        if (dir.x === -1 && dir.y === 0) return 'left';
        if (dir.x === 1 && dir.y === 0) return 'right';
        return 'right';
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
                this._setDirection(map[e.key]);
            }
            if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                if (this.isRunning) {
                    this.isPaused = !this.isPaused;
                }
            }
        });

        // لمس / سحب
        let touchStartX = 0, touchStartY = 0;

        if (this.canvas) {
            this.canvas.addEventListener('touchstart', (e) => {
                if (e.touches.length > 1) return;
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }, { passive: true });

            this.canvas.addEventListener('touchend', (e) => {
                if (!touchStartX && !touchStartY) return;
                const dx = e.changedTouches[0].clientX - touchStartX;
                const dy = e.changedTouches[0].clientY - touchStartY;
                const absDx = Math.abs(dx);
                const absDy = Math.abs(dy);

                if (Math.max(absDx, absDy) > 20) {
                    if (absDx > absDy) {
                        this._setDirection(dx > 0 ? 'right' : 'left');
                    } else {
                        this._setDirection(dy > 0 ? 'down' : 'up');
                    }
                } else {
                    if (!this.isRunning && !this.isPaused) this._init();
                }
                touchStartX = 0;
                touchStartY = 0;
            }, { passive: true });

            // نقرة للبدء
            this.canvas.addEventListener('click', () => {
                if (!this.isRunning && !this.isPaused) this._init();
            });
        }

        // D-Pad للجوال
        document.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this._setDirection(btn.dataset.dir);
            });
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this._setDirection(btn.dataset.dir);
            });
        });

        // أزرار
        const newGameBtn = document.getElementById('new-game-btn');
        const gameoverNewGame = document.getElementById('gameover-new-game');

        if (newGameBtn) newGameBtn.addEventListener('click', () => this._init());
        if (gameoverNewGame) gameoverNewGame.addEventListener('click', () => this._init());

        // إظهار D-Pad على الجوال فقط
        const checkMobile = () => {
            const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
                (navigator.userAgent || navigator.vendor || window.opera).toLowerCase()
            ) || window.innerWidth < 768;

            if (this.mobileControls) {
                this.mobileControls.style.display = isMobile ? 'block' : 'none';
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
    }
}

export default SnakeGame;
