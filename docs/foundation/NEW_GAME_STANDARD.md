# معيار إضافة ألعاب جديدة في Game Hub — الإصدار 2.0

## نظرة عامة

يتيح لك هذا المعيار إضافة أي لعبة جديدة إلى Game Hub مع دعم كامل للأنظمة التالية:
- **المصادقة (Auth)** - تسجيل الدخول بـ GitHub + وضع الضيف
- **البروفايل (Profile)** - XP، Level، Rank
- **الإنجازات (Achievements)** - إنجازات بمستويات (Bronze → Platinum)
- **لوحة الصدارة (Leaderboard)** - ترتيب عالمي
- **الإشعارات (Notifications)** - Toast notifications عند تحقيق إنجاز
- **الأونلاين (Online Multiplayer)** - نظام غرف + دعوات UUID + WebSocket
- **الذكاء الاصطناعي (AI Opponent)** - محرك ألعاب داخلي

> **ملاحظة مهمة:** هذا المعيار متطور ويتضمن تجارب مرحلة 10 و 11 من المشروع. اقرأه كاملاً قبل البدء.

---

## هيكل الملفات الموحد (File Structure)

```
games/<game_id>/
├── index.html              # الصفحة الرئيسية (اختيار الوضع)
├── local.html              # وضع اللاعبين على نفس الجهاز
├── ai.html                 # وضع اللعب ضد الذكاء الاصطناعي
├── online.html             # وضع الأونلاين (متعدد اللاعبين)
├── game.json               # بيانات اللعبة
├── achievements.json       # تعريفات الإنجازات
├── core/                   # منطق اللعبة الأساسي (مستقل تماماً)
│   ├── rules.js
│   ├── ai-engine.js
│   └── state.js
├── ui/                     # واجهة المستخدم (Canvas / DOM)
│   ├── renderer.js
│   └── components.js
├── local/                  # متحكم الوضع المحلي
│   └── local-controller.js
├── ai/                     # متحكم وضع AI
│   └── ai-controller.js
├── online/                 # متحكم الأونلاين
│   ├── online-controller.js
│   └── room-client.js
├── assets/                 # صور / أصوات
└── css/
    └── game-custom.css     # تنسيقات خاصة باللعبة
```

### قاعدة ذهبية: فصل المهام (Separation of Concerns)

| الطبقة | المسؤولية | ما يجب ألا تفعله |
|--------|-----------|-----------------|
| `core/` | منطق اللعبة الخالص (Pure Game Logic) | لا تتعامل مع DOM، Network، أو Achievements |
| `ui/` | الرسم والتفاعل البصري | لا تتعامل مع قواعد اللعبة مباشرة |
| `local/` | حلقة اللاعبين المحليين | لا تُسجل إنجازات أو تتصل بالخادم |
| `ai/` | حلقة اللاعب + AI | لا تُسجل إنجازات |
| `online/` | حلقة الشبكة + المزامنة | طبقة الإنجازات والصدارة تعمل هنا فقط |

---

## بنية الصفحة الموحدة (HTML Page Structure)

### الهيكل القياسي لجميع صفحات اللعبة

```html
<body class="has-game-controls">

<!-- 1. الهيدر الرئيسي (ثابت - يحجب المحتوى إذا لم يُحسب له padding) -->
<header class="main-header">
    <a href="../../index.html" class="logo">... Game Hub</a>
    <nav class="main-nav">... روابط التنقل ...</nav>
    <button class="header-profile" id="header-profile-btn">... الملف الشخصي</button>
</header>

<!-- 2. حاوية اللعبة (chess-page / game-page) - padding-top مهم جداً -->
<div class="chess-page">  <!-- أو <div class="game-page"> -->

    <!-- 3. عنوان اللعبة -->
    <div class="chess-header">
        <h1>اسم اللعبة</h1>
        <a href="index.html" class="back-btn">← القائمة</a>
    </div>

    <!-- 4. المحتوى الرئيسي -->
    <main class="chess-main">
        <!-- ... الرقعة / اللعبة / الشاشة ... -->
    </main>

</div> <!-- نهاية chess-page -->

</body>
```

### ⚠️ قاعدة ذهبية: الهيدر الثابت (Fixed Header)

الهيدر الرئيسي (`main-header`) له `position: fixed` و `z-index: 1000`، مما يعني أنه **يحجب المحتوى** إذا لم تترك مسافة كافية أعلاه:

```css
/* ✅ الصحيح: ترك padding-top كافٍ */
.chess-page {
    padding-top: calc(var(--header-height) + 1.25rem);  /* 64px + 20px */
}

/* ❌ الخاطئ: لا padding أو قيمة قليلة */
.chess-page {
    padding-top: 1rem;  /* لا يكفي! الهيدر سيحجب العنوان */
}

/* ✅ للموبايل: حافظ على padding-top الهيدر */
@media (max-width: 680px) {
    .chess-page {
        padding-top: calc(var(--header-height) + 0.5rem);  /* لا تقلله لـ 1rem */
    }
}
```

### أنماط CSS المطلوبة

```css
:root {
    --header-height: 64px;
    --accent: #4A9FD8;
    --accent-light: #5BB8F0;
    /* ... */
}

/* الحاوية الأساسية لصفحات اللعبة */
.chess-page {
    width: min(1120px, 100%);
    margin: 0 auto;
    padding: calc(var(--header-height) + 1.25rem) 1rem 2rem;
    box-sizing: border-box;
}

/* المحتوى الرئيسي */
.chess-main {
    width: 100%;
    min-height: calc(100svh - var(--header-height));
    padding: 0 0 2rem;
}
```

---

## 1. إنشاء ملف الإنجازات `achievements.json`

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
    "display_order": 1,
    "online_only": false
  },
  {
    "id": "yourgame_wins_10",
    "name": "عشر انتصارات",
    "description": "أكمل 10 انتصارات في وضع الأونلاين",
    "icon": "🏆",
    "tier": "gold",
    "xp_reward": 200,
    "condition_type": "wins",
    "condition_value": 10,
    "display_order": 5,
    "online_only": true
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

### حقل `online_only` (جديد)

```json
{ "online_only": true }
```

عند تعيين `online_only: true`:
- الإنجاز **لا يُحتسب** في وضع اللاعبين المحليين (`local.html`)
- الإنجاز **لا يُحتسب** في وضع AI (`ai.html`)
- الإنجاز **يُحتسب فقط** في وضع الأونلاين (`online.html`)

> **لماذا؟** لضمان عدالة المنافسة. لا يُعقل أن يحصل لاعب على ترتيب عالمي من لعب AI.

---

## 2. إضافة Supabase Config في `index.html`

```html
<script>
    window.GAMEHUB_CONFIG = {
        SUPABASE_URL: 'YOUR_SUPABASE_URL',
        SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY'
    };
</script>
```

---

## 3. تهيئة GameHub في `index.html`

```html
<script type="module">
    import { initGameHub } from '../../foundation/gamehub-api.js';
    import { profileUI } from '../../foundation/profile-ui.js';
    import { supabase } from '../../foundation/supabase-config.js';
    
    await initGameHub();
    profileUI.init();
    
    const headerProfileBtn = document.getElementById('header-profile-btn');
    if (headerProfileBtn) {
        headerProfileBtn.addEventListener('click', () => profileUI.open('profile'));
    }
</script>
```

---

## 4. ربط اللعبة بـ GameHub — الوضع المحلي (Local)

في وضع `local.html` و `ai.html`: **لا تُسجل الإنجازات ولا النقاط**.

```javascript
class LocalGame {
    constructor() {
        // لا GameHub في الوضع المحلي!
        this._gameOverHandled = false;
    }
    
    // ─── عند انتهاء اللعبة (محلي فقط) ─────────────────────────────
    _gameOver() {
        // ... عرض نتيجة اللعبة محلياً فقط ...
        
        // ❌ لا تستدعي GameHub APIs هنا!
        // ❌ لا achievements.updateProgress
        // ❌ لا onGameEnd
        
        // ✅ Foundation bridge فقط (للـ AI Chat)
        this.foundation?.showGameOver({
            score: this.score,
            title: 'انتهت اللعبة!',
            message: `نتيجتك: ${this.score}`,
            icon: '🎮',
        });
    }
}
```

---

## 5. ربط اللعبة بـ GameHub — الوضع الأونلاين (Online)

في وضع `online.html`: **هنا فقط تُسجل الإنجازات والنقاط**.

```javascript
class OnlineController {
    constructor(opts) {
        // ... إعداد الشبكة ...
        this._initGameHub();
    }
    
    async _initGameHub() {
        try {
            const { GameHubAPI } = await import('../../foundation/gamehub-api.js');
            this._gh = GameHubAPI;
            await this._gh.auth.init();
            await this._gh.achievements.init();
        } catch (e) {
            console.warn('[Online] GameHub not available:', e.message);
        }
    }
    
    // ─── عند بدء المباراة الأونلاين ──────────────────────────────────
    async _startGHSession() {
        this._gameOverHandled = false;
        if (this._gh) {
            this._ghSession = await this._gh.onGameStart('yourgame');
        }
    }
    
    // ─── عند انتهاء المباراة الأونلاين ───────────────────────────────
    async _endGHSession(isWin = false) {
        if (this._gh && this._ghSession && !this._gameOverHandled) {
            this._gameOverHandled = true;
            await this._gh.onGameEnd(this._ghSession, {
                score: isWin ? 10 : 0,
                isWin,
                difficulty: 'online'
            });
            
            // ✅ سجل الإنجازات فقط في الأونلاين
            if (isWin) {
                await this._gh.achievements.updateProgress('yourgame', 'wins', 1);
            }
            
            this._ghSession = null;
        }
    }
}
```

---

## 6. نظام الترقية (Pawn Promotion) — للشطرنج والألعاب المشابهة

عند وصول بيدق (Pawn) إلى الصف الأخير من الرقعة، يجب أن يختار اللاعب **القطعة** التي يريد الترقية إليها:

```javascript
// ❌ الخاطئ: ترقية تلقائية (تجاوز لقرار اللاعب)
if (move.flags.includes('promotion')) {
    move = { ...move, promotion: 'q' }; // دائماً وزير!
}

// ✅ الصحيح: عرض نافذة اختيار
if (move.flags.includes('promotion')) {
    this._pendingPromotion = move;       // احفظ الحركة مؤقتاً
    this._showPromotionDialog(color);    // اعرض النافذة للاعب
    return;                              // لا تنفذ الحركة بعد
}
```

### HTML للنافذة (في جميع صفحات اللعبة)

```html
<div id="promotion-dialog" class="promotion-dialog hidden">
    <p>اختر قطعة الترقية</p>
    <div class="promotion-choices">
        <button class="prom-btn" data-type="q">♕</button>  <!-- وزير -->
        <button class="prom-btn" data-type="r">♖</button>  <!-- رخ -->
        <button class="prom-btn" data-type="b">♗</button>  <!-- فيل -->
        <button class="prom-btn" data-type="n">♘</button>  <!-- حصان -->
    </div>
</div>
```

### JavaScript — عرض ومعالجة النافذة

```javascript
_showPromotionDialog(color) {
    const dlg = document.getElementById('promotion-dialog');
    const symbols = color === 'w'
        ? { q: '♕', r: '♖', b: '♗', n: '♘' }
        : { q: '♛', r: '♜', b: '♝', n: '♞' };
    
    dlg.querySelectorAll('.prom-btn').forEach(btn => {
        btn.textContent = symbols[btn.dataset.type];
    });
    
    dlg.classList.remove('hidden');
    
    // معالج اختيار القطعة
    const onChoice = (e) => {
        const btn = e.target.closest('.prom-btn');
        if (!btn || !this._pendingPromotion) return;
        
        const move = { 
            ...this._pendingPromotion, 
            promotion: btn.dataset.type 
        };
        this._pendingPromotion = null;
        dlg.classList.add('hidden');
        this._executeMove(move);  // أكمل الحركة بالقطعة المختارة
    };
    
    dlg.addEventListener('click', onChoice);
}
```

### CSS للنافذة

```css
.promotion-dialog {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #23272A;
    border: 1px solid var(--accent);
    border-radius: 12px;
    padding: 1rem 1.5rem;
    z-index: 200;
    text-align: center;
}
.promotion-dialog.hidden { display: none !important; }
.promotion-choices {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 12px;
}
.prom-btn {
    width: 52px;
    height: 52px;
    font-size: 1.6rem;
    background: #2C2F33;
    border: 1px solid #3A3D42;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
}
.prom-btn:hover { background: var(--accent); }
```

---

## 7. نظام الأونلاين Multiplayer

### البنية المعيارية

```
online/
├── online-controller.js    # واجهة موحدة لجميع أوضاع الأونلاين
├── room-client.js          # عميل WebSocket (Socket.IO)
└── server/                 # خادم Node.js (منفصل عن frontend)
    ├── server.js           # منطق الغرف والمباريات
    └── package.json
```

### RoomClient — عميل الاتصال (WebSocket)

```javascript
class RoomClient {
    constructor(serverUrl, handlers) {
        this._url = serverUrl;
        this._handlers = handlers;   // onConnected, onMove, onGameOver, ...
        this._socket = null;
        this._userId = null;
    }
    
    // ─── الاتصال ──────────────────────────────────────────────
    async connect() { /* ... socket.io connect ... */ }
    
    // ─── تسجيل المستخدم (للدعوات) ────────────────────────────
    registerUser(userId) {
        this._userId = userId;
        this._socket?.emit('user:register', { userId });
    }
    
    // ─── إنشاء غرفة ──────────────────────────────────────────
    async createRoom() { /* ... emit create_room ... */ }
    
    // ─── الانضمام لغرفة ──────────────────────────────────────
    async joinRoom(code) { /* ... emit join_room ... */ }
    
    // ─── إرسال حركة ──────────────────────────────────────────
    sendMove(move) { this._socket?.emit('move', move); }
    
    // ─── نظام الدردشة ────────────────────────────────────────
    sendChat(text) { this._socket?.emit('chat', { text }); }
    
    // ─── نظام التعادل ────────────────────────────────────────
    offerDraw()     { this._socket?.emit('offer_draw'); }
    acceptDraw()    { this._socket?.emit('accept_draw'); }
    declineDraw()   { this._socket?.emit('decline_draw'); }
    
    // ─── الاستسلام ───────────────────────────────────────────
    resign() { this._socket?.emit('resign'); }
    
    // ─── قطع الاتصال ─────────────────────────────────────────
    disconnect() { this._socket?.disconnect(); }
}
```

### الخادم (server.js) — أحداث Socket.IO

```javascript
io.on('connection', (socket) => {
    // تسجيل المستخدم
    socket.on('user:register', ({ userId }) => {
        if (userId) userSockets.set(userId, socket.id);
    });
    
    // إنشاء غرفة
    socket.on('create_room', (fn) => {
        const code = generateCode();
        rooms.set(code, { code, white: socket.id, black: null, status: 'waiting' });
        socket.join(code);
        fn({ code, color: 'w' });
    });
    
    // الانضمام لغرفة
    socket.on('join_room', ({ roomCode }, fn) => {
        const room = rooms.get(roomCode);
        if (!room || room.black) return fn({ error: 'full' });
        room.black = socket.id;
        room.status = 'playing';
        socket.join(roomCode);
        fn({ code: roomCode, color: 'b', fen: room.fen });
        io.to(roomCode).emit('room_state', room);
    });
    
    // استقبال حركة
    socket.on('move', ({ from, to, promotion }) => {
        const roomCode = players.get(socket.id);
        const room = rooms.get(roomCode);
        if (!room) return;
        // ... تحقق من الصلاحية + تحديث الحالة ...
        socket.to(roomCode).emit('move', { from, to, promotion });
    });
    
    // قطع الاتصال
    socket.on('disconnect', () => { cleanupPlayer(socket.id); });
});
```

---

## 8. نظام دعوة اللاعبين عبر UUID (Invitation System)

### كيف يعمل؟

1. **المستخدم المسجل** (مع GitHub login) له UUID فريد
2. يمكنه نسخ UUID وإرساله لصديق
3. الصديق يلصق UUID ويضغط "دعوة"
4. الصديق المدعو يستقبل نافذة قبول/رفض
5. عند القبول، يُنشأ غرفة تلقائياً

### لمستخدمي الضيوف (Guests)

| نوع المستخدم | نظام الاتصال |
|-------------|-------------|
| مسجل (Authenticated) | دعوة UUID مباشرة أو غرفة |
| ضيف (Guest) | غرفة فقط (Room Code) |

> **لماذا؟** الضيف ليس له UUID ثابت، فلا يمكن دعوته مباشرة. الغرفة هي الحل العادل.

### RoomClient — دعوات UUID

```javascript
class RoomClient {
    // ─── إرسال دعوة ──────────────────────────────────────────
    sendInvite(toUserId) {
        return this._emit('invite:send', { toUserId });
    }
    
    // ─── قبول دعوة ───────────────────────────────────────────
    acceptInvite(inviteId) {
        return this._emit('invite:accept', { inviteId });
    }
    
    // ─── رفض دعوة ────────────────────────────────────────────
    declineInvite(inviteId) {
        this._socket?.emit('invite:decline', { inviteId });
    }
}
```

### الخادم — معالجة الدعوات

```javascript
// إرسال دعوة
socket.on('invite:send', ({ toUserId }, callback) => {
    const fromUserId = socket._userId;
    if (!fromUserId) return callback?.({ ok: false, error: 'تسجيل الدخول مطلوب' });
    
    const targetSocketId = userSockets.get(toUserId);
    if (!targetSocketId) return callback?.({ ok: false, error: 'المستخدم غير متصل' });
    
    const inviteId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    pendingInvites.set(inviteId, { fromSocket: socket.id, toUUID: toUserId });
    
    io.to(targetSocketId).emit('invite:received', { inviteId, fromUserId });
    callback?.({ ok: true, inviteId });
});

// قبول دعوة
socket.on('invite:accept', ({ inviteId }, callback) => {
    const invite = pendingInvites.get(inviteId);
    if (!invite || Date.now() - invite.createdAt > 30000) {
        return callback?.({ ok: false, error: 'انتهت صلاحية الدعوة' });
    }
    
    // أنشئ غرفة للاعبين
    const code = generateCode();
    const room = { code, white: invite.fromSocket, black: socket.id, status: 'playing' };
    rooms.set(code, room);
    
    io.to(invite.fromSocket).emit('invite:accepted', { code, color: 'w' });
    callback?.({ ok: true, code, color: 'b' });
});
```

### واجهة المستخدم للدعوات

```html
<!-- في online.html: قسم دعوة اللاعب (يظهر فقط للمسجلين) -->
<div id="invite-section">
    <!-- للضيوف: رسالة تسجيل الدخول -->
    <div id="invite-auth-required">سجّل الدخول لدعوة لاعب مباشرة</div>
    
    <!-- للمسجلين: حقل الدعوة -->
    <div id="invite-form" class="hidden">
        <input id="invite-uuid-input" placeholder="معرف اللاعب (UUID)">
        <button id="btn-send-invite">دعوة</button>
        <div id="my-uuid-display">
            <span>معرفك:</span>
            <strong id="my-uuid-value">---</strong>
            <button id="btn-copy-uuid">نسخ</button>
        </div>
    </div>
</div>

<!-- نافذة استقبال الدعوة -->
<div id="invite-modal" class="gameover-modal hidden">
    <h2>دعوة للعب</h2>
    <p id="invite-msg">يريد اللعب معك</p>
    <button id="btn-accept-invite">قبول</button>
    <button id="btn-decline-invite">رفض</button>
</div>
```

---

## 9. قواعد عدالة الإنجازات (Achievements Fairness Rules)

### قواعد صارمة

| القاعدة | السبب |
|---------|-------|
| **الإنجازات تُسجل فقط في الأونلاين** | منع الغش باللعب ضد AI سهل |
| **النقاط تُسجل فقط في الأونلاين** | منح اللاعبين المتنافسين فرصة عادلة |
| **الترتيب (Leaderboard) = أونلاين فقط** | الـ local/ai للتدريب فقط |
| **الوضع المحلي = للتدريب فقط** | لا إنجازات، لا نقاط، لا ترتيب |
| **وضع AI = للتدريب فقط** | لا إنجازات، لا نقاط، لا ترتيب |

### المخطط الزمني لتسجيل الإنجازات

```
┌──────────────────────────────────────────────────────┐
│ local.html  ──►  تدريب  ──►  ❌ لا إنجازات         │
│ ai.html     ──►  تدريب  ──►  ❌ لا إنجازات         │
│ online.html ──►  تنافس  ──►  ✅ إنجازات + نقاط     │
└──────────────────────────────────────────────────────┘
```

---

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

---

## أمثلة مرجعية كاملة

انظر إلى ملفات الألعاب الحالية كأمثلة:

| اللعبة | الملف | ما يمكن تعلمه |
|--------|-------|--------------|
| **Chess** | `games/chess/local.html` | نموذج الوضع المحلي (بدون إنجازات) |
| **Chess** | `games/chess/ai.html` | نموذج وضع AI (بدون إنجازات) |
| **Chess** | `games/chess/online.html` | نموذج الأونلاين مع إنجازات + دعوات UUID + ترقية البيدق |
| **Chess** | `games/chess/online/room-client.js` | عميل WebSocket كامل مع نظام دعوات |
| **Chess** | `games/chess/online/online-controller.js` | متحكم الأونلاين مع نظام الترقية |
| **Chess** | `Backend/chess-server/server.js` | خادم Node.js مع غرف + دعوات |
| **Snake** | `games/snake/game.js` | لعبة بسيطة مع score |
| **2048** | `games/2048/game.js` | لعبة مع highest_tile |
| **Tetris** | `games/tetris/index.html` | لعبة مع lines_cleared وlevel |
| **Sudoku** | `games/sudoku/index.html` | لعبة مع difficulty ووقت |

---

## ملخص سريع — قائمة المراجعة (Quick Checklist)

عند إضافة لعبة جديدة، تأكد من:

- [ ] إنشاء `achievements.json` مع `online_only: true` للإنجازات التنافسية
- [ ] توحيد بنية HTML مع `main-header` + `chess-page` wrapper
- [ ] إضافة `padding-top: calc(var(--header-height) + ...)` في CSS
- [ ] **عدم** تسجيل إنجازات في `local.html` أو `ai.html`
- [ ] تسجيل الإنجازات **فقط** في `online.html`
- [ ] إضافة نافذة ترقية البيدق (للشطرنج والألعاب المشابهة)
- [ ] دعم دعوات UUID للمستخدمين المسجلين
- [ ] إبقاء نظام الغرف (Room Code) للمستخدمين غير المسجلين
- [ ] بنية `core/` منفصلة عن `ui/` و `local/` و `ai/` و `online/`
- [ ] تهيئة GameHub في `index.html` مع `profileUI.init()`
