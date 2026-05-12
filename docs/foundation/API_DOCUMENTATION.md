# توثيق Game Hub Foundation API (v2.0.0) - إصدار المشروع V13

## نظرة عامة

توفر الـ **Foundation API** واجهة برمجية مركزية وموحدة لجميع الألعاب داخل منصة **Game Hub**. تهدف هذه الـ API إلى تسهيل عملية تطوير الألعاب من خلال توفير حلول جاهزة لإدارة النتيجة، الوقت، حالة اللعبة (Pause/Resume)، التفاعل مع الذكاء الاصطناعي، وحفظ الحالة محلياً.

---

## 🏗️ المكونات الأساسية

### 1. `GameFoundation` (الفئة الأساسية)
هي المحرك الرئيسي الذي يدير منطق اللعبة العام والتفاعل مع واجهة المستخدم الموحدة.

#### التهيئة (Constructor)
```javascript
import { GameFoundation } from '../foundation/game-api.js';

const game = new GameFoundation({
    name: 'اسم اللعبة',           // مطلوب: اسم اللعبة للعرض وفي التخزين
    storageKey: 'game-key',       // اختياري: مفتاح مخصص لـ localStorage
    onRestart: () => {},          // اختياري: وظيفة تُستدعى عند الضغط على "إعادة"
    onPause: () => {},            // اختياري: وظيفة تُستدعى عند الإيقاف المؤقت
    onResume: () => {},           // اختياري: وظيفة تُستدعى عند الاستئناف
    hasScore: true,               // افتراضي true: هل تحتوي اللعبة على نتيجة؟
    hasTimer: false               // افتراضي false: هل تحتاج اللعبة لمؤقت؟
});
```

### 2. `gameManager` (المدير المركزي)
يُستخدم لإدارة دورة حياة اللعبة الحالية ومنع تضارب الحالات.

```javascript
import { gameManager } from '../foundation/game-manager.js';

// تهيئة اللعبة والحصول على نسخة Foundation
const foundation = gameManager.initGame({
    name: 'My Awesome Game',
    onRestart: () => myGame.reset()
});
```

---

## 🕹️ الوظائف والخصائص

### 📊 إدارة النتيجة والمستوى
| الوظيفة | الوصف |
| :--- | :--- |
| `setScore(number)` | تعيين النتيجة وتحديث واجهة المستخدم (ID: `score-value`). |
| `setLevel(number)` | تعيين المستوى الحالي (ID: `level-value`). |
| `setStatus(text)` | تحديث نص الحالة العام (ID: `status-text`). |

### ⏱️ إدارة المؤقت (Timer)
يدعم النظام مؤقتاً مركزياً يعمل في الخلفية ويحدث الواجهة تلقائياً (ID: `timer-value`).

```javascript
game.startTimer({
    countDown: false,         // true للتنازلي، false للتصاعدي
    from: 0,                  // نقطة البداية بالثواني
    onTick: (sec) => {},      // تُستدعى كل ثانية
    onEnd: () => {}           // تُستدعى عند انتهاء الوقت (للتنازلي فقط)
});

game.stopTimer();             // إيقاف المؤقت يدوياً
```

### ⏸️ التحكم في التدفق (Flow Control)
| الخاصية/الوظيفة | الوصف |
| :--- | :--- |
| `pause()` | إيقاف اللعبة، تجميد المؤقت، وإظهار طبقة الإيقاف (`game-overlay`). |
| `resume()` | استئناف اللعبة والمؤقت وإخفاء الطبقة. |
| `toggle()` | التبديل بين الإيقاف والاستئناف. |
| `isPaused` | (Getter) تعيد `true` إذا كانت اللعبة متوقفة. |

### 🏁 نهاية اللعبة (Game Over)
تُظهر نافذة منبثقة موحدة (ID: `gameover-modal`) مع النتائج.

```javascript
game.showGameOver({
    score: 1200,
    title: 'فوز ساحق!',
    message: 'لقد حطمت الرقم القياسي!',
    icon: '🏆'
});
```

---

## 🤖 التكامل مع الذكاء الاصطناعي (AI Chat)

تتميز منصة Game Hub بتكامل عميق مع الـ AI Chat لمساعدة اللاعبين.

### تحديث السياق (Context)
يجب إرسال حالة اللعبة للـ AI لكي يفهم ما يحدث ويقدم نصائح دقيقة.
```javascript
game.updateAIContext({
    board: [[1, 2], [0, 1]],
    movesLeft: 5,
    difficulty: 'hard'
});
```

### طلب نصيحة (Hint)
يفتح نافذة الدردشة تلقائياً ويرسل طلباً للمساعدة بناءً على السياق الحالي.
```javascript
game._requestHint(); // تُستدعى عادة عند الضغط على زر btn-ai-hint
```

---

## 💾 حفظ وتحميل الحالة (Persistence)

يوفر النظام طرقاً سهلة لحفظ تقدم اللاعب في `localStorage`.

```javascript
// حفظ بيانات مخصصة
game.saveState({ grid: [...], moves: 10 });

// تحميل البيانات المحفوظة
const savedData = game.loadState();

// مسح البيانات
game.clearState();
```

---

## 📱 دعم الموبايل
يمكنك التحقق مما إذا كان المستخدم يلعب من جهاز لمس:
```javascript
if (game.isMobile) {
    // تفعيل عناصر تحكم اللمس
}
```

---

## 🛠️ متطلبات HTML (IDs المطلوبة)
لكي تعمل الـ API بشكل صحيح، يجب أن تتوفر المعرفات التالية في ملف الـ HTML:
- `score-value`: لعرض النتيجة.
- `level-value`: لعرض المستوى.
- `timer-value`: لعرض الوقت.
- `status-text`: لعرض حالة اللعبة.
- `btn-pause` / `btn-restart`: أزرار التحكم.
- `game-overlay`: طبقة الإيقاف المؤقت.
- `gameover-modal`: نافذة نهاية اللعبة.

---

**الإصدار الحالي للـ API**: 2.0.0
**تاريخ التحديث**: 10 مايو 2026
