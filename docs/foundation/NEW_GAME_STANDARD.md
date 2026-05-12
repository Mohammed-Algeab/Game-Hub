# معيار إضافة ألعاب جديدة في Game Hub

## نظرة عامة

يتيح لك هذا المعيار إضافة أي لعبة جديدة إلى Game Hub مع دعم كامل للأنظمة التالية:
- المصادقة (Auth) - تسجيل الدخول بـ GitHub + وضع الضيف
- البروفايل (Profile) - XP، Level، Rank
- الإنجازات (Achievements) - إنجازات بمستويات (Bronze → Platinum)
- لوحة الصدارة (Leaderboard) - ترتيب عالمي
- الإشعارات (Notifications) - Toast notifications عند تحقيق إنجاز

## الملفات المطلوبة

```
games/<game_id>/
├── game.json              # بيانات اللعبة (موجود مسبقاً)
├── game.js                # منطق اللعبة (موجود مسبقاً)
└── achievements.json      # جديد: تعريفات الإنجازات
```

## الخطوات

### 1. إنشاء ملف الإنجازات `achievements.json`

```json
[
  {
    "id": "yourgame_first_game",
    "name": "أول لعبة",
    "description": "العب أول مباراة",
    "icon": "🎮",
    "tier": "bronze",
    "xp_reward": 10,
    "condition_type": "games_played",
    "condition_value": 1,
    "display_order": 1
  },
  {
    "id": "yourgame_score_1000",
    "name": "ألف نقطة",
    "description": "احصل على 1000 نقطة",
    "icon": "🎯",
    "tier": "silver",
    "xp_reward": 50,
    "condition_type": "score",
    "condition_value": 1000,
    "display_order": 2
  }
]
```

### أنواع الشروط المدعومة (`condition_type`)

| النوع | الوصف |
|-------|-------|
| `games_played` | عدد مرات اللعب |
| `score` | النقاط (مقارنة بأعلى قيمة) |
| `wins` | عدد الانتصارات |
| `wins_by_difficulty` | انتصارات حسب الصعوبة |
| `level` | المستوى |
| `highest_tile` | أعلى بلاطة (لـ 2048) |
| `snake_length` | طول الثعبان (لـ Snake) |
| `lines_cleared` | عدد الخطوط الممسوحة (لـ Tetris) |
| `time_seconds` | الوقت بالثواني (أقل من) (لـ Sudoku) |
| `win_streak` | سلسلة انتصارات متتالية |

### مستويات الإنجازات (`tier`)

| المستوى | اللون | XP عادي |
|---------|-------|---------|
| `bronze` | برونزي | 10-30 |
| `silver` | فضي | 40-80 |
| `gold` | ذهبي | 100-200 |
| `platinum` | بلاتيني | 250-500 |

### 2. إضافة Supabase Config في `index.html`

```html
<script>
    window.GAMEHUB_CONFIG = {
        SUPABASE_URL: 'YOUR_SUPABASE_URL',
        SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY'
    };
</script>
```

### 3. تهيئة GameHub في `index.html`

```html
<script type="module">
    import { initGameHub } from '../../foundation/gamehub-api.js';
    import { profileUI } from '../../foundation/profile-ui.js';
    
    await initGameHub();
    profileUI.init();
    
    const headerProfileBtn = document.getElementById('header-profile-btn');
    if (headerProfileBtn) {
        headerProfileBtn.addEventListener('click', () => profileUI.open('profile'));
    }
</script>
```

### 4. ربط اللعبة بـ GameHub

في ملف JavaScript الخاص بلعبتك:

```javascript
class YourGame {
    constructor(gameFoundation) {
        this.gameFoundation = gameFoundation;
        this._gh = null;
        this._ghSession = null;
        this._gameOverHandled = false;
        
        this._initGameHub();
    }
    
    async _initGameHub() {
        try {
            const { GameHubAPI } = await import('../../foundation/gamehub-api.js');
            this._gh = GameHubAPI;
            await this._gh.auth.init();
            await this._gh.achievements.init();
        } catch (e) {
            console.warn('[YourGame] GameHub not available:', e.message);
        }
    }
    
    // ─── عند بدء اللعبة ──────────────────────────────────────────────
    async _startGHSession() {
        this._gameOverHandled = false;
        if (this._gh) {
            this._ghSession = await this._gh.onGameStart('yourgame');
        }
    }
    
    // ─── عند انتهاء اللعبة ───────────────────────────────────────────
    async _endGHSession(isWin = false) {
        if (this._gh && this._ghSession && !this._gameOverHandled) {
            this._gameOverHandled = true;
            await this._gh.onGameEnd(this._ghSession, {
                score: this.score,
                isWin,
                level: this.level,
                // حسب اللعبة:
                // highestTile: this.highestTile,
                // snakeLength: this.snake.length,
                // linesCleared: this.lines,
                // timeSeconds: this.elapsedTime,
                // difficulty: this.difficulty
            });
            this._ghSession = null;
        }
    }
    
    // ─── مثال: عند انتهاء اللعبة ──────────────────────────────────────
    _gameOver() {
        // ... الكود الحالي ...
        
        // ─── GameHub ─────────────────────────────────────────────────
        this._endGHSession(false);
        
        // Foundation bridge
        this.foundation?.showGameOver({
            score: this.score,
            title: 'انتهت اللعبة!',
            message: `نتيجتك: ${this.score}`,
            icon: '🎮',
        });
    }
}
```

## API Reference

### GameHubAPI.auth
| الدالة | الوصف |
|--------|-------|
| `init()` | تهيئة المصادقة |
| `signInWithGitHub()` | تسجيل الدخول بـ GitHub |
| `signInAsGuest(name?)` | وضع الضيف |
| `signOut()` | تسجيل الخروج |
| `getUser()` | المستخدم الحالي |
| `getUserId()` | UUID المستخدم |
| `isAuthenticated()` | هل مسجل؟ |
| `isGuest` | هل ضيف؟ |
| `onAuthChange(cb)` | الاستماع لتغييرات الحالة |

### GameHubAPI.profile
| الدالة | الوصف |
|--------|-------|
| `load()` | تحميل البروفايل |
| `get()` | الحصول على البروفايل |
| `update(updates)` | تحديث البروفايل |
| `addXP(amount)` | إضافة XP |
| `updateStats(result)` | تحديث الإحصائيات |

### GameHubAPI.achievements
| الدالة | الوصف |
|--------|-------|
| `init()` | تهيئة الإنجازات |
| `getForGame(gameId)` | إنجازات لعبة |
| `updateProgress(gameId, type, value, extra?)` | تحديث تقدم |
| `checkGameEnd(gameId, result)` | تحقق نهاية اللعبة |
| `onUnlock(cb)` | عند تفعيل إنجاز |

### GameHubAPI.leaderboard
| الدالة | الوصف |
|--------|-------|
| `submit(gameId, score, opts?)` | تسجيل نتيجة |
| `get(gameId, opts?)` | جلب لوحة الصدارة |
| `getPersonalBest(gameId, diff?)` | أفضل نتيجة شخصية |

### GameHubAPI.notify
| الدالة | الوصف |
|--------|-------|
| `achievement(ach)` | إشعار إنجاز |
| `levelUp(old, new)` | إشعار ترقية |
| `success(title, msg)` | إشعار نجاح |
| `error(title, msg)` | إشعار خطأ |

### profileUI
| الدالة | الوصف |
|--------|-------|
| `init()` | تهيئة الواجهة |
| `open(tab?)` | فتح البروفايل |
| `openLeaderboard(gameId?)` | فتح الصدارة |
| `openAchievements(gameId?)` | فتح الإنجازات |

## مثال كامل

انظر إلى ملفات الألعاب الحالية كأمثلة:
- `games/snake/game.js` - لعبة بسيطة مع score
- `games/sudoku/index.html` - لعبة مع difficulty ووقت
- `games/2048/game.js` - لعبة مع highest_tile
- `games/tetris/index.html` - لعبة مع lines_cleared وlevel
- `games/chess/local.html` - لعبة مع wins/losses
