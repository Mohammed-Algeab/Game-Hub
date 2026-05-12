/**
 * navigation.js — Bottom Nav (Mobile) + Auto-hide Header
 * يُدار تلقائياً من main.js — لا تحتاج استيراده يدوياً في كل صفحة
 */

import { Icons } from './icons.js';

const NAV_ITEMS = [
    { id: 'home',    icon: Icons.home,    label: 'الرئيسية', path: 'index.html' },
    { id: 'games',   icon: Icons.gamepad, label: 'الألعاب',  path: 'index.html#games' },
    { id: 'about',   icon: Icons.info,    label: 'حول',      path: 'about.html' },
    { id: 'support', icon: Icons.headset, label: 'الدعم',    path: 'support.html' },
];

/* ── Detect current page ── */
function getCurrentPage() {
    const p = window.location.pathname;
    if (p.includes('about'))   return 'about';
    if (p.includes('support')) return 'support';
    if (p.includes('/games/')) return null; // game pages — no bottom nav
    return 'home';
}

/* ── Resolve root-relative path from current depth ── */
function getRootPath() {
    const p = window.location.pathname;
    // Count directories deep from root
    const parts = p.replace(/\/index\.html$/, '/').split('/').filter(Boolean);
    // If we are inside /games/tetris/, depth = 2, so go ../../
    // Heuristic: count slashes after domain
    const depth = (p.match(/\//g) || []).length - 1;
    if (depth <= 1) return './';
    return '../'.repeat(depth - 1);
}

/* ── Build bottom nav ── */
function buildBottomNav(currentPage) {
    if (!currentPage) return; // game pages skip

    const root = getRootPath();
    const nav  = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.id = 'bottom-nav';
    nav.setAttribute('aria-label', 'التنقل الرئيسي');

    NAV_ITEMS.forEach(item => {
        const a = document.createElement('a');
        a.href = root + item.path;
        a.className = 'bottom-nav-item' + (item.id === currentPage ? ' active' : '');
        a.innerHTML = `<span class="bnav-icon"><span class="gh-icon">${item.icon}</span></span><span class="bnav-label">${item.label}</span>`;
        nav.appendChild(a);
    });

    document.body.appendChild(nav);
    return nav;
}

/* ── Auto-hide nav on scroll ── */
function initScrollBehavior(nav) {
    const header = document.querySelector('.main-header');
    let lastY = window.scrollY;
    let ticking = false;

    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            const y = window.scrollY;
            const down = y > lastY + 6;
            const up   = y < lastY - 6;

            if (down && y > 80) {
                nav?.classList.add('nav-hidden');
                header?.classList.add('nav-hidden');
            } else if (up) {
                nav?.classList.remove('nav-hidden');
                header?.classList.remove('nav-hidden');
            }

            // Scrolled state for shadow
            header?.classList.toggle('nav-scrolled', y > 20);

            lastY = y;
            ticking = false;
        });
    }, { passive: true });
}

/* ── Update logo to support image ── */
function upgradeLogoMarkup() {
    const logoIcon = document.querySelector('.logo .logo-icon');
    if (!logoIcon) return;

    // Wrap emoji icon in .logo-img-wrap for easy image replacement later
    const wrap = document.createElement('span');
    wrap.className = 'logo-img-wrap';
    wrap.innerHTML = `<span class="logo-icon-wrap"><span class="gh-icon">${Icons.gamepad}</span></span>`;
    logoIcon.replaceWith(wrap);

    // Upgrade text span
    const logoText = document.querySelector('.logo > span:not(.logo-img-wrap)');
    if (logoText && !logoText.classList.contains('logo-text')) {
        logoText.classList.add('logo-text');
    }
}

/* ── Main init ── */
export function initNavigation() {
    const currentPage = getCurrentPage();
    upgradeLogoMarkup();
    const nav = buildBottomNav(currentPage);
    initScrollBehavior(nav);
}

export default initNavigation;
