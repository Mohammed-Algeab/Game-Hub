# قالب إنشاء لعبة جديدة - Game Hub V13

يوضح هذا الدليل الخطوات القياسية لإضافة لعبة جديدة إلى منصة **Game Hub** باستخدام الهيكل المحدث في الإصدار 13.

---

## 📂 الخطوة 1: هيكل المجلدات
يجب وضع جميع ملفات اللعبة في مجلد خاص داخل `docs/games/`.

```text
docs/games/[game-id]/
├── index.html    (الصفحة الرئيسية للعبة)
├── game.json     (بيانات التعريف - مهم جداً)
├── style.css     (تنسيقات اللعبة)
├── logic.js      (المنطق البرمجي)
└── assets/       (الصور والأصوات)
```

---

## 📝 الخطوة 2: إعداد بيانات التعريف (`game.json`)
هذا الملف هو المسؤول عن ظهور اللعبة في الصفحة الرئيسية وتصنيفها.

```json
{
    "id": "my-game",
    "name": "اسم اللعبة بالعربية",
    "nameEn": "My Game Name",
    "description": "وصف جذاب للعبة يظهر في البطاقة.",
    "url": "games/my-game/index.html",
    "icon": "🎮",
    "color": "#6366f1",
    "category": "puzzle",
    "categoryLabel": "ألغاز",
    "categoryIcon": "🧩",
    "status": "available",
    "mobile": true,
    "tags": ["تحدي", "ذكاء", "جديد"]
}
```

---

## 🌐 الخطوة 3: إضافة اللعبة للمنصة (`manifest.json`)
لكي يكتشف النظام اللعبة، أضف الـ `id` الخاص بها إلى ملف `docs/games/manifest.json`:

```json
[
    "tetris",
    "sudoku",
    "chess",
    "my-game" 
]
```

---

## 💻 الخطوة 4: كود البداية (`index.html`)
استخدم هذا القالب لضمان التكامل مع نظام الـ APIs المركزي.

```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Game - Game Hub</title>
    <link rel="stylesheet" href="../../css/main.css">
    <link rel="stylesheet" href="style.css">
</head>
<body class="has-game-controls">
    <!-- واجهة اللعبة القياسية -->
    <div class="game-page">
        <div class="game-sidebar">
            <div id="score-container">النتيجة: <span id="score-value">0</span></div>
            <div id="timer-container">الوقت: <span id="timer-value">00:00</span></div>
            <button id="btn-pause" class="ctrl-btn">⏸ إيقاف</button>
            <button id="btn-restart" class="ctrl-btn">↺ إعادة</button>
        </div>
        
        <canvas id="game-canvas"></canvas>
    </div>

    <!-- طبقات النظام المطلوبة -->
    <div id="game-overlay" class="hidden"></div>
    <div id="gameover-modal" class="hidden">
        <div class="gameover-card">
            <div id="gameover-icon">🏁</div>
            <h2 id="gameover-title">انتهت اللعبة</h2>
            <p id="gameover-msg"></p>
            <div id="final-score">0</div>
            <button id="modal-restart">لعبة جديدة</button>
        </div>
    </div>

    <script type="module">
        import { gameManager } from '../../foundation/game-manager.js';

        // 1. تهيئة الـ API
        const foundation = gameManager.initGame({
            name: 'My Game',
            hasScore: true,
            hasTimer: true,
            onRestart: () => startNewGame()
        });

        function startNewGame() {
            // منطق بدء اللعبة الخاص بك
            foundation.setScore(0);
            foundation.startTimer();
        }

        // ابدأ!
        startNewGame();
    </script>
</body>
</html>
```

---

## 💡 نصائح للمطورين
1. **استخدم `foundation.updateAIContext`**: قم بتحديث حالة اللعبة باستمرار لكي يتمكن الـ AI من مساعدة اللاعبين.
2. **التصميم المتجاوب**: تأكد من أن اللعبة تعمل بشكل جيد على الموبايل (استخدم `foundation.isMobile`).
3. **الألوان**: استخدم المتغيرات الموجودة في `main.css` للحفاظ على تناسق الهوية البصرية.
4. **الحفظ التلقائي**: استخدم `foundation.saveState()` لحفظ تقدم اللاعب عند كل حركة مهمة.

---
**Game Hub V13 Framework**
