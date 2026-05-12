/**
 * js/games-loader.js
 * يكتشف الألعاب تلقائياً من manifest.json ويبني بطاقاتها في الصفحة الرئيسية
 *
 * لإضافة لعبة جديدة:
 *   1. أنشئ مجلد docs/games/{id}/
 *   2. أضف game.json بداخله
 *   3. أضف "{id}" لـ manifest.json
 *   لا شيء آخر مطلوب ✅
 *
 * تم تحديث هذا الملف لاستخدام الـ APIs الجديدة في مجلد foundation.
 */

import { gameManager } from '../foundation/game-manager.js';
import { Icons } from './icons.js';


const MANIFEST_URL = 'games/manifest.json';

// ─── كشف الجهاز ──────────────────────────────────────────────────────────────
const IS_MOBILE = window.matchMedia('(pointer: coarse)').matches;

// ─── تحميل بيانات الألعاب ────────────────────────────────────────────────────

async function fetchManifest() {
    const res = await fetch(MANIFEST_URL);
    if (!res.ok) throw new Error('manifest.json غير موجود');
    return res.json();
}

async function fetchGameData(id) {
    try {
        const res = await fetch(`games/${id}/game.json`);
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

async function loadAllGames() {
    const ids   = await fetchManifest();
    const games = await Promise.all(ids.map(fetchGameData));
    return games.filter(Boolean);
}


// ─── Category icon mapping ────────────────────────────────────────────────────
const CAT_ICONS = {
    'strategy':  Icons.swords,
    'arcade':    Icons.joystick,
    'puzzle':    Icons.puzzle,
    'sports':    Icons.trophy,
    'all':       Icons.gamepad,
};

function getCatIcon(key, fallback) {
    return CAT_ICONS[key] || fallback || Icons.gamepad;
}

// ─── بناء البطاقات ────────────────────────────────────────────────────────────

function buildCard(game) {
    const isSoon = game.status !== 'available';
    const isBeta = game.status === 'beta';

    const isDesktopOnly = !game.mobile;
    const badge = isBeta        ? '<span class="game-badge beta">تجريبي</span>'
                : isSoon        ? '<span class="game-badge soon">قريباً</span>'
                : isDesktopOnly ? '<span class="game-badge desktop-only">🖥 كمبيوتر</span>'
                : '';

    const tags = (game.tags ?? [])
        .map(t => `<span class="game-tag">${t}</span>`)
        .join('');

    const thumbStyle = isSoon
        ? `style="background: linear-gradient(135deg, #475569, #334155); opacity: 0.75;"`
        : `style="background: linear-gradient(135deg, ${game.color ?? '#6366f1'}22, ${game.color ?? '#6366f1'}44);"`;

    const inner = `
        ${badge}
        <div class="game-thumbnail" ${thumbStyle}><span class="gh-icon">${game.icon}</span></div>
        <h3>${game.name}<span class="game-name-en">${game.nameEn}</span></h3>
        <p>${game.description}</p>
        <div class="game-tags">${tags}</div>`;

    if (isSoon) {
        return `
        <div class="game-card game-card-soon"
             data-category="${game.category}"
             data-mobile="${game.mobile}"
             data-status="soon">
            ${inner}
        </div>`;
    }

    return `
    <div class="game-card"
         data-category="${game.category}"
         data-mobile="${game.mobile}"
         data-status="available">
        <a href="${game.url}">${inner}</a>
    </div>`;
}

// ─── إحصائيات ─────────────────────────────────────────────────────────────────

function updateStats(games) {
    const available   = games.filter(g => g.status === 'available' || g.status === 'ready');
    const mobileReady = available.filter(g => g.mobile);
    const categories  = new Set(games.map(g => g.category)).size;

    animateCount('stat-total',      available.length);
    animateCount('stat-mobile',     mobileReady.length);
    animateCount('stat-categories', categories);
}

function animateCount(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    let current = 0;
    const step = Math.ceil(target / 20);
    const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current;
        if (current >= target) clearInterval(timer);
    }, 40);
}

// ─── قائمة الفئات (dropdown + drawer) ───────────────────────────────────────

function buildCategories(games) {
    // تجميع الفئات مع الأيقونات والعدد
    const cats = {};
    games.forEach(g => {
        if (!cats[g.category]) {
            cats[g.category] = {
                label: g.categoryLabel,
                icon:  g.categoryIcon ?? Icons.gamepad,
                count: 0,
            };
        }
        cats[g.category].count++;
    });

    // بناء زر "الكل"
    const allItem = _categoryItem('all', Icons.gamepad, 'الكل', games.length, true);

    // بناء أزرار الفئات
    const catItems = Object.entries(cats)
        .map(([key, { label, icon, count }]) => _categoryItem(key, icon, label, count, false))
        .join('');

    const html = allItem + catItems;

    // حقن في الـ dropdown (ديسكتوب) والـ drawer (موبايل)
    const dropdownDesktop = document.getElementById('categories-dropdown');
    const dropdownMobile  = document.getElementById('mobile-categories-menu');
    if (dropdownDesktop) dropdownDesktop.innerHTML = html;
    if (dropdownMobile)  dropdownMobile.innerHTML  = html;

    // ربط الأحداث
    document.querySelectorAll('.cat-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => filterGames(btn.dataset.filter, btn));
    });
}

function _categoryItem(filter, icon, label, count, isActive) {
    const svgIcon = getCatIcon(filter, icon);
    return `
    <button class="cat-filter-btn${isActive ? ' active' : ''}" data-filter="${filter}">
        <span class="cat-icon"><span class="gh-icon">${svgIcon}</span></span>
        <span class="cat-label">${label}</span>
        <span class="cat-count">${count}</span>
    </button>`;
}

// ─── تصفية ───────────────────────────────────────────────────────────────────

function filterGames(category, activeBtn) {
    const cards   = document.querySelectorAll('#games-grid .game-card');
    const infoEl  = document.getElementById('filter-info');

    cards.forEach(card => {
        const categoryMatch = category === 'all' || card.dataset.category === category;
        // على الموبايل: أخفِ الألعاب التي mobile="false"
        const deviceMatch   = !IS_MOBILE || card.dataset.mobile !== 'false';
        card.style.display  = (categoryMatch && deviceMatch) ? '' : 'none';
    });

    document.querySelectorAll('.cat-filter-btn').forEach(b => b.classList.remove('active'));
    activeBtn?.classList.add('active');

    if (infoEl) {
        infoEl.textContent = category === 'all'
            ? 'جميع الألعاب'
            : activeBtn?.textContent?.replace(/\d+/, '').trim() ?? '';
    }

    // إغلاق الـ drawer على الموبايل
    document.getElementById('categories-drawer')?.style.setProperty('display', 'none');
    document.getElementById('categories-drawer-overlay')?.style.setProperty('display', 'none');
}

// ─── تهيئة ────────────────────────────────────────────────────────────────────

export async function initGamesGrid() {
    // تهيئة GameManager عند بدء تشغيل الشبكة
    gameManager.initGame({ name: '\Game Hub' }); // يمكن تعديل اسم اللعبة لاحقًا إذا لزم الأمر

    const grid = document.getElementById('games-grid');
    if (!grid) return;

    // حالة التحميل
    grid.innerHTML = `<div class="games-loading">
        <div class="loading-spinner"></div>
        <p>جارٍ تحميل الألعاب...</p>
    </div>`;

    try {
        const games = await loadAllGames();

        // على الموبايل: نحسب الإحصائيات بعد استثناء ألعاب الكمبيوتر
        const visibleGames = IS_MOBILE ? games.filter(g => g.mobile !== false) : games;

        grid.innerHTML = games.map(buildCard).join('');
        updateStats(visibleGames);
        buildCategories(visibleGames);

        // طبّق فلتر الجهاز على الفور
        if (IS_MOBILE) {
            document.querySelectorAll('#games-grid .game-card').forEach(card => {
                if (card.dataset.mobile === 'false') card.style.display = 'none';
            });
        }

    } catch (err) {
        console.error('خطأ في تحميل الألعاب:', err);
        grid.innerHTML = `<p class="games-error">تعذّر تحميل الألعاب. حاول تحديث الصفحة.</p>`;
    }
}
