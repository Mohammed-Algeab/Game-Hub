/**
 * foundation/profile-ui.js
 * واجهة البروفايل (Panel) - محسّنة للهاتف
 * الإصلاح: تحديث المحتوى فقط عند تغيير التبويبات بدلاً من إعادة بناء كل شيء
 */

import { GameHubAPI, GameHubEvents } from './gamehub-api.js';
import { authManager } from './auth.js';
import { presenceSystem } from './presence-system.js';

class ProfileUI {
    constructor() {
        this.overlay = null;
        this.panel = null;
        this.contentEl = null;
        this.currentTab = 'profile';
        this.isOpen = false;
        this.initialized = false;
        this._selectedGameId = null;
        this._selectedDifficulty = 'global';
    }

    // ─── تهيئة الواجهة ────────────────────────────────────────────────────
    init() {
        if (this.initialized) return;
        this._injectStyles();
        this._createOverlay();
        this._bindHeaderButton();
        this._listenToAuth();
        this.initialized = true;
    }

    // ─── كشف نوع الجهاز ───────────────────────────────────────────────────
    _isMobile() {
        return window.innerWidth <= 767;
    }

    // ─── تطبيق أنماط Panel حسب الجهاز ────────────────────────────────────
    _applyPanelLayout() {
        if (this._isMobile()) {
            // ── هاتف: bottom sheet ─────────────────────────────────────
            // position:fixed مستقل عن الـ overlay تماماً (relative to viewport)
            this.panel.style.position    = 'fixed';
            this.panel.style.left        = '0';
            this.panel.style.right       = '0';
            this.panel.style.bottom      = '0';
            this.panel.style.top         = 'auto';
            this.panel.style.width       = '100%';
            this.panel.style.maxWidth    = '100%';
            this.panel.style.height      = '88vh';
            this.panel.style.maxHeight   = '88vh';
            this.panel.style.zIndex      = '9001';
            this.panel.style.borderTop   = '1px solid var(--border, rgba(99,102,241,0.15))';
            this.panel.style.borderRight = 'none';
            this.panel.style.borderLeft  = 'none';
            this.panel.style.borderRadius = '20px 20px 0 0';
            this._closedTransform = 'translateY(100%)';
            this._openTransform   = 'translateY(0)';
        } else {
            // ── ديسكتوب: side drawer ────────────────────────────────────
            this.panel.style.position    = 'fixed';
            this.panel.style.left        = '0';
            this.panel.style.top         = '0';
            this.panel.style.bottom      = '0';
            this.panel.style.right       = 'auto';
            this.panel.style.width       = '400px';
            this.panel.style.maxWidth    = '400px';
            this.panel.style.height      = '100%';
            this.panel.style.maxHeight   = '';
            this.panel.style.zIndex      = '9001';
            this.panel.style.borderTop   = 'none';
            this.panel.style.borderRight = '1px solid var(--border, rgba(99,102,241,0.15))';
            this.panel.style.borderLeft  = 'none';
            this.panel.style.borderRadius = '0';
            this._closedTransform = 'translateX(-100%)';
            this._openTransform   = 'translateX(0)';
        }
        // الـ transform الابتدائي بدون animation
        this.panel.style.transition = 'none';
        this.panel.style.transform  = this._closedTransform;
    }

    // ─── فتح الـ Panel ────────────────────────────────────────────────────
    open(tab = 'profile') {
        if (this.isOpen && tab === this.currentTab) return;

        this.currentTab = tab;

        if (!this.isOpen) {
            // 1. ضبط الموضع والـ transform الابتدائي (بدون transition)
            this._applyPanelLayout();
            // 2. إظهار الـ overlay
            this.overlay.style.display = 'flex';
            // 3. force reflow لضمان تطبيق الحالة الابتدائية
            void this.overlay.offsetHeight;
            // 4. تفعيل الـ transition ثم تشغيل الـ animation
            this.panel.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
            this.overlay.style.opacity  = '1';
            this.panel.style.transform  = this._openTransform;
            this.panel.classList.add('gh-panel-open');
            document.body.style.overflow = 'hidden';
            this.isOpen = true;
        }

        this._updateContent();
        this._loadData();
    }

    // ─── إغلاق الـ Panel ──────────────────────────────────────────────────
    close() {
        if (!this.isOpen) return;
        this.overlay.style.opacity = '0';
        this.panel.style.transform = this._closedTransform || 'translateX(-100%)';
        this.panel.classList.remove('gh-panel-open');

        setTimeout(() => {
            this.overlay.style.display = 'none';
            document.body.style.overflow = '';
            this.isOpen = false;
        }, 350);
    }

    openLeaderboard(gameId = null) {
        if (gameId) this._selectedGameId = gameId;
        this.open('leaderboard');
    }

    openAchievements(gameId = null) {
        if (gameId) this._selectedGameId = gameId;
        this.open('achievements');
    }

    // ─── إنشاء الـ Overlay والـ Panel (مرة واحدة فقط) ────────────────────
    _createOverlay() {
        if (this.overlay) return;

        this.overlay = document.createElement('div');
        this.overlay.className = 'gh-profile-overlay';
        this.overlay.style.cssText = `
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.55);
            z-index: 9000;
            direction: ltr;
            justify-content: flex-start;
            align-items: stretch;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        });

        // Panel ثابت - يُبنى مرة واحدة فقط
        this.panel = document.createElement('div');
        this.panel.className = 'gh-modal-panel';
        this.panel.style.cssText = `
            background: var(--bg, #0a0e1a);
            display: flex;
            flex-direction: column;
            direction: rtl;
            overflow: hidden;
            z-index: 1;
        `;

        // Drag handle (يظهر فقط على الهاتف)
        const dragHandle = document.createElement('div');
        dragHandle.className = 'gh-drag-handle-wrapper';
        dragHandle.innerHTML = '<div class="gh-drag-handle"></div>';

        // Header ثابت
        const header = document.createElement('div');
        header.className = 'gh-modal-header';
        header.innerHTML = `
            <h3 class="gh-modal-title"><span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></span> ملفي الشخصي</h3>
            <button class="gh-modal-close" aria-label="إغلاق">✕</button>
        `;
        header.querySelector('.gh-modal-close').addEventListener('click', () => this.close());

        // Tabs ثابتة
        const tabsEl = document.createElement('div');
        tabsEl.className = 'gh-modal-tabs';
        tabsEl.id = 'gh-modal-tabs';
        tabsEl.innerHTML = `
            <button class="gh-tab active" data-tab="profile"><span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></span> البروفايل</button>
            <button class="gh-tab" data-tab="achievements"><span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8m-4-4v4"/><path d="M6 3h12v8a6 6 0 01-12 0V3z"/><path d="M6 7H3a1 1 0 00-1 1v2a4 4 0 004 4m12-7h3a1 1 0 011 1v2a4 4 0 01-4 4"/></svg></span> الإنجازات</button>
            <button class="gh-tab" data-tab="leaderboard"><span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="14" r="6"/><path d="M8 3l4 3 4-3M8 3H5l2 5m11-5h-3l-2 5"/><text x="12" y="14" font-size="6" fill="currentColor" stroke="none" font-weight="bold" font-family="monospace" text-anchor="middle" dominant-baseline="central">1</text></svg></span> الصدارة</button>
        `;
        tabsEl.querySelectorAll('.gh-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentTab = btn.dataset.tab;
                this._updateTabs();
                this._updateContent();
                this._loadData();
            });
        });

        // Content قابل للتمرير
        this.contentEl = document.createElement('div');
        this.contentEl.className = 'gh-modal-content';
        this.contentEl.style.cssText = `
            flex: 1;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            padding: 16px;
        `;

        this.panel.appendChild(dragHandle);
        this.panel.appendChild(header);
        this.panel.appendChild(tabsEl);
        this.panel.appendChild(this.contentEl);
        this.overlay.appendChild(this.panel);
        document.body.appendChild(this.overlay);
    }

    // ─── تحديث التبويبات النشطة ───────────────────────────────────────────
    _updateTabs() {
        if (!this.panel) return;
        const isAuth = authManager.isAuthenticated() || authManager.isGuest;
        const tabsEl = this.panel.querySelector('#gh-modal-tabs');
        if (tabsEl) {
            tabsEl.style.display = isAuth ? 'flex' : 'none';
        }
        this.panel.querySelectorAll('.gh-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === this.currentTab);
        });

        // تحديث العنوان
        const titles = {
            profile: '<span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></span> ملفي الشخصي',
            achievements: '<span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8m-4-4v4"/><path d="M6 3h12v8a6 6 0 01-12 0V3z"/><path d="M6 7H3a1 1 0 00-1 1v2a4 4 0 004 4m12-7h3a1 1 0 011 1v2a4 4 0 01-4 4"/></svg></span> الإنجازات',
            leaderboard: '<span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="14" r="6"/><path d="M8 3l4 3 4-3M8 3H5l2 5m11-5h-3l-2 5"/><text x="12" y="14" font-size="6" fill="currentColor" stroke="none" font-weight="bold" font-family="monospace" text-anchor="middle" dominant-baseline="central">1</text></svg></span> لوحة الصدارة'
        };
        const titleEl = this.panel.querySelector('.gh-modal-title');
        if (titleEl) titleEl.innerHTML = titles[this.currentTab] || 'Game Hub';
    }

    // ─── تحديث المحتوى فقط (بدون إعادة بناء الـ panel) ──────────────────
    _updateContent() {
        if (!this.contentEl) return;
        this._updateTabs();

        const isAuth = authManager.isAuthenticated() || authManager.isGuest;

        if (!isAuth) {
            this.contentEl.innerHTML = this._renderLoginSection();
            this._bindLoginButtons();
            return;
        }

        switch (this.currentTab) {
            case 'profile':
                this.contentEl.innerHTML = this._renderProfileTab();
                this._bindProfileButtons();
                break;
            case 'achievements':
                this.contentEl.innerHTML = this._renderAchievementsShell();
                this._bindAchievementFilters();
                break;
            case 'leaderboard':
                this.contentEl.innerHTML = this._renderLeaderboardShell();
                this._bindLeaderboardFilters();
                break;
        }
    }

    // ─── ربط أزرار تسجيل الدخول ──────────────────────────────────────────
    _bindLoginButtons() {
        this.contentEl.querySelector('.gh-btn-github')?.addEventListener('click', () => {
            GameHubAPI.auth.signInWithGitHub();
        });
        this.contentEl.querySelector('.gh-btn-guest')?.addEventListener('click', async () => {
            await GameHubAPI.auth.signInAsGuest();
            this._updateContent();
            this._updateHeaderButton(authManager.getUser());
        });
    }

    // ─── ربط أزرار البروفايل ──────────────────────────────────────────────
    _bindProfileButtons() {
        this.contentEl.querySelector('.gh-btn-edit-name')?.addEventListener('click', () => {
            this._showEditNameModal();
        });
        this.contentEl.querySelector('.gh-btn-achievements')?.addEventListener('click', () => {
            this.currentTab = 'achievements';
            this._updateTabs();
            this._updateContent();
            this._loadData();
        });
        this.contentEl.querySelector('.gh-btn-leaderboard')?.addEventListener('click', () => {
            this.currentTab = 'leaderboard';
            this._updateTabs();
            this._updateContent();
            this._loadData();
        });
        this.contentEl.querySelector('.gh-btn-avatar')?.addEventListener('click', () => {
            this._openGravatarProfile();
        });
        this.contentEl.querySelector('.gh-btn-logout')?.addEventListener('click', async () => {
            await GameHubAPI.auth.signOut();
            this._updateContent();
            this._updateHeaderButton(null);
        });

        // ─── زر نسخ المعرّف ───────────────────────────────────────────────
        const copyBtn = this.contentEl.querySelector('.gh-user-id-copy');
        if (copyBtn) {
            const COPY_SVG = `<span class="gh-icon gh-icon-xs"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></span>`;
            const CHECK_SVG = `<span class="gh-icon gh-icon-xs"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>`;
            copyBtn.addEventListener('click', () => {
                const fullId = copyBtn.dataset.userid || '';
                navigator.clipboard.writeText(fullId).then(() => {
                    copyBtn.innerHTML = CHECK_SVG;
                    setTimeout(() => { copyBtn.innerHTML = COPY_SVG; }, 1500);
                }).catch(() => {
                    // fallback للمتصفحات القديمة
                    const el = document.createElement('textarea');
                    el.value = fullId;
                    document.body.appendChild(el);
                    el.select();
                    document.execCommand('copy');
                    document.body.removeChild(el);
                    copyBtn.innerHTML = CHECK_SVG;
                    setTimeout(() => { copyBtn.innerHTML = COPY_SVG; }, 1500);
                });
            });
        }
    }

    // ─── ربط فلاتر الإنجازات ──────────────────────────────────────────────
    _bindAchievementFilters() {
        this.contentEl.querySelectorAll('.gh-game-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                this._selectedGameId = btn.dataset.game;
                this.contentEl.querySelectorAll('.gh-game-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._loadAchievements(this._selectedGameId);
            });
        });
    }

    // ─── ربط فلاتر لوحة الصدارة ───────────────────────────────────────────
    _bindLeaderboardFilters() {
        this.contentEl.querySelectorAll('.gh-game-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                this._selectedGameId = btn.dataset.game;
                this.contentEl.querySelectorAll('.gh-game-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._loadLeaderboard(this._selectedGameId, this._selectedDifficulty);
            });
        });
        this.contentEl.querySelectorAll('.gh-diff-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                this._selectedDifficulty = btn.dataset.diff;
                this.contentEl.querySelectorAll('.gh-diff-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._loadLeaderboard(this._selectedGameId || 'chess', this._selectedDifficulty);
            });
        });
    }

    // ─── رسم قسم تسجيل الدخول ─────────────────────────────────────────────
    _renderLoginSection() {
        return `
            <div class="gh-login-section">
                <div class="gh-login-icon"><span class="gh-icon gh-icon-4xl"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 12h4m-2-2v4"/><circle cx="16" cy="11" r="1" fill="currentColor"/><circle cx="19" cy="13" r="1" fill="currentColor"/></svg></span></div>
                <h4>سجل دخولك للمتابعة</h4>
                <p>سجل دخولك للوصول إلى بروفايلك، إنجازاتك، والمنافسة في لوحة الصدارة العالمية.</p>
                <button class="gh-btn gh-btn-github">
                    <span aria-hidden="true"><span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></span></span>
                    تسجيل الدخول بـ GitHub
                </button>
                <button class="gh-btn gh-btn-guest"><span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></span> اللعب كضيف</button>
                <small class="gh-login-note">يمكنك اللعب كضيف لكن نقاطك لن تُحفظ في السحابة.</small>
            </div>
        `;
    }

    // ─── رسم تبويب البروفايل ──────────────────────────────────────────────
    _renderProfileTab() {
        const profile = GameHubAPI.profile.get() || {};
        const xp = profile.xp || 0;
        const level = profile.level || 1;
        const nextLevelXP = Math.pow(level, 2) * 100;
        const prevLevelXP = Math.pow(level - 1, 2) * 100;
        const xpProgress = prevLevelXP === nextLevelXP ? 0 : Math.max(0, Math.min(100, ((xp - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100));
        const rankTitle = profile.rank_title || 'مبتدئ';
        const avatarSrc = profile.gravatar_hash ? `https://gravatar.com/avatar/${profile.gravatar_hash}?d=identicon&s=200` : (profile.avatar_url || 'https://www.gravatar.com/avatar/0?d=identicon&s=200');

        return `
            <div class="gh-profile-section">
                <div class="gh-profile-header">
                    <div class="gh-profile-avatar-wrap">
                        <img class="gh-profile-avatar" src="${avatarSrc}" alt="Avatar" onerror="this.src='https://www.gravatar.com/avatar/0?d=identicon&s=200'">
                        <span class="gh-status-dot online" id="profile-status-dot" title="متصل"></span>
                    </div>
                    <div class="gh-profile-info">
                        <h4>${profile.display_name || profile.username || 'لاعب'}</h4>
                        <span class="gh-profile-rank">${rankTitle}</span>
                        ${authManager.isGuest ? '<span class="gh-guest-badge">ضيف</span>' : ''}
                    </div>
                </div>

                ${!authManager.isGuest ? `
                <div class="gh-user-id-box">
                    <span class="gh-user-id-label"><span class="gh-icon gh-icon-xs"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><line x1="6" y1="12" x2="10" y2="12"/><circle cx="16" cy="11" r="2"/><path d="M12 17h8"/></svg></span> معرّفك (للدردشة الخاصة)</span>
                    <div class="gh-user-id-row">
                        <code class="gh-user-id-value" id="gh-user-id-code">${(profile.id || authManager.getUserId() || '—').slice(0, 18)}…</code>
                        <button class="gh-user-id-copy" title="نسخ المعرّف الكامل" data-userid="${profile.id || authManager.getUserId() || ''}"><span class="gh-icon gh-icon-xs"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></span></button>
                    </div>
                </div>` : ''}

                <div class="gh-xp-bar-container">
                    <div class="gh-xp-label">
                        <span>المستوى ${level}</span>
                        <span>${xp.toLocaleString()} / ${nextLevelXP.toLocaleString()} XP</span>
                    </div>
                    <div class="gh-xp-bar">
                        <div class="gh-xp-fill" style="width: ${xpProgress}%"></div>
                    </div>
                </div>

                <div class="gh-stats-grid">
                    <div class="gh-stat-box">
                        <span class="gh-stat-value">${(profile.games_played || 0).toLocaleString()}</span>
                        <span class="gh-stat-label">ألعاب</span>
                    </div>
                    <div class="gh-stat-box">
                        <span class="gh-stat-value">${(profile.wins || 0).toLocaleString()}</span>
                        <span class="gh-stat-label">انتصارات</span>
                    </div>
                    <div class="gh-stat-box">
                        <span class="gh-stat-value">${(profile.total_score || 0).toLocaleString()}</span>
                        <span class="gh-stat-label">النقاط</span>
                    </div>
                    <div class="gh-stat-box">
                        <span class="gh-stat-value">${(profile.losses || 0).toLocaleString()}</span>
                        <span class="gh-stat-label">هزائم</span>
                    </div>
                </div>

                <div class="gh-profile-actions">
                    <button class="gh-btn gh-btn-edit-name"><span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span> تغيير الاسم</button>
                    <button class="gh-btn gh-btn-achievements"><span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8m-4-4v4"/><path d="M6 3h12v8a6 6 0 01-12 0V3z"/><path d="M6 7H3a1 1 0 00-1 1v2a4 4 0 004 4m12-7h3a1 1 0 011 1v2a4 4 0 01-4 4"/></svg></span> عرض الإنجازات</button>
                    <button class="gh-btn gh-btn-leaderboard"><span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="14" r="6"/><path d="M8 3l4 3 4-3M8 3H5l2 5m11-5h-3l-2 5"/><text x="12" y="14" font-size="6" fill="currentColor" stroke="none" font-weight="bold" font-family="monospace" text-anchor="middle" dominant-baseline="central">1</text></svg></span> لوحة الصدارة</button>
                </div>

                ${!authManager.isGuest ? `
                <div class="gh-profile-avatar-actions">
                    <button class="gh-btn gh-btn-avatar"><span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></span> تغيير الصورة عبر Gravatar</button>
                    <small class="gh-avatar-note">الصورة تُدار من Gravatar، ويمكنك تعديلها من هناك مباشرة.</small>
                </div>
                ` : ''}

                <button class="gh-btn gh-btn-logout"><span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span> تسجيل الخروج</button>
            </div>
        `;
    }

    // ─── Shell الإنجازات (الهيكل بدون بيانات) ────────────────────────────
    _renderAchievementsShell() {
        const games = [
            { id: 'chess', name: 'شطرنج', icon: '<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20v-2h10v2"/><path d="M7 18c0 0 .5-2 2-3l1-4c-1 0-2-1-2-2s1-2 2-2h4c1 0 2 1 2 2s-1 2-2 2l1 4c1.5 1 2 3 2 3"/><line x1="7" y1="20" x2="17" y2="20"/><path d="M9 7V5h2V4h2v1h2v2"/></svg></span>' },
            { id: 'sudoku', name: 'سودوكو', icon: '<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><text x="6" y="6" font-size="5" fill="currentColor" stroke="none" font-family="monospace" font-weight="bold" text-anchor="middle" dominant-baseline="central">1</text><text x="18" y="6" font-size="5" fill="currentColor" stroke="none" font-family="monospace" font-weight="bold" text-anchor="middle" dominant-baseline="central">4</text><text x="6" y="12" font-size="5" fill="currentColor" stroke="none" font-family="monospace" font-weight="bold" text-anchor="middle" dominant-baseline="central">7</text><text x="18" y="12" font-size="5" fill="currentColor" stroke="none" font-family="monospace" font-weight="bold" text-anchor="middle" dominant-baseline="central">2</text><text x="12" y="18" font-size="5" fill="currentColor" stroke="none" font-family="monospace" font-weight="bold" text-anchor="middle" dominant-baseline="central">5</text></svg></span>' },
            { id: 'tetris', name: 'تتريس', icon: '<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="10" width="5" height="5" rx="1.5"/><rect x="7" y="10" width="5" height="5" rx="1.5"/><rect x="12" y="10" width="5" height="5" rx="1.5"/><rect x="12" y="5" width="5" height="5" rx="1.5"/></svg></span>' },
            { id: '2048', name: '2048', icon: '<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="2" width="9" height="9" rx="2"/><rect x="13" y="2" width="9" height="9" rx="2"/><rect x="2" y="13" width="9" height="9" rx="2"/><rect x="13" y="13" width="9" height="9" rx="2"/></svg></span>' },
            { id: 'snake', name: 'ثعبان', icon: '<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v-3a4 4 0 014-4h8a4 4 0 004-4V4"/><path d="M4 16a2 2 0 104 0 2 2 0 00-4 0z" fill="currentColor" stroke="none"/><circle cx="20" cy="4" r="1.5" fill="currentColor" stroke="none"/></svg></span>' }
        ];
        const selectedGame = this._selectedGameId || games[0].id;

        return `
            <div class="gh-achievements-section">
                <div class="gh-game-filter">
                    ${games.map(g => `
                        <button class="gh-game-pill ${g.id === selectedGame ? 'active' : ''}" data-game="${g.id}">
                            ${g.icon} ${g.name}
                        </button>
                    `).join('')}
                </div>
                <div class="gh-achievements-list" id="gh-achievements-list">
                    <div class="gh-loading"><span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h14M5 21h14M7 3v5l5 4-5 4v5m10-18v5l-5 4 5 4v5"/></svg></span> جاري التحميل...</div>
                </div>
            </div>
        `;
    }

    // ─── Shell لوحة الصدارة (الهيكل بدون بيانات) ─────────────────────────
    _renderLeaderboardShell() {
        const games = [
            { id: 'chess', name: 'شطرنج', icon: '<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20v-2h10v2"/><path d="M7 18c0 0 .5-2 2-3l1-4c-1 0-2-1-2-2s1-2 2-2h4c1 0 2 1 2 2s-1 2-2 2l1 4c1.5 1 2 3 2 3"/><line x1="7" y1="20" x2="17" y2="20"/><path d="M9 7V5h2V4h2v1h2v2"/></svg></span>' },
            { id: 'sudoku', name: 'سودوكو', icon: '<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><text x="6" y="6" font-size="5" fill="currentColor" stroke="none" font-family="monospace" font-weight="bold" text-anchor="middle" dominant-baseline="central">1</text><text x="18" y="6" font-size="5" fill="currentColor" stroke="none" font-family="monospace" font-weight="bold" text-anchor="middle" dominant-baseline="central">4</text><text x="6" y="12" font-size="5" fill="currentColor" stroke="none" font-family="monospace" font-weight="bold" text-anchor="middle" dominant-baseline="central">7</text><text x="18" y="12" font-size="5" fill="currentColor" stroke="none" font-family="monospace" font-weight="bold" text-anchor="middle" dominant-baseline="central">2</text><text x="12" y="18" font-size="5" fill="currentColor" stroke="none" font-family="monospace" font-weight="bold" text-anchor="middle" dominant-baseline="central">5</text></svg></span>' },
            { id: 'tetris', name: 'تتريس', icon: '<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="10" width="5" height="5" rx="1.5"/><rect x="7" y="10" width="5" height="5" rx="1.5"/><rect x="12" y="10" width="5" height="5" rx="1.5"/><rect x="12" y="5" width="5" height="5" rx="1.5"/></svg></span>' },
            { id: '2048', name: '2048', icon: '<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="2" width="9" height="9" rx="2"/><rect x="13" y="2" width="9" height="9" rx="2"/><rect x="2" y="13" width="9" height="9" rx="2"/><rect x="13" y="13" width="9" height="9" rx="2"/></svg></span>' },
            { id: 'snake', name: 'ثعبان', icon: '<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v-3a4 4 0 014-4h8a4 4 0 004-4V4"/><path d="M4 16a2 2 0 104 0 2 2 0 00-4 0z" fill="currentColor" stroke="none"/><circle cx="20" cy="4" r="1.5" fill="currentColor" stroke="none"/></svg></span>' }
        ];
        const difficulties = [
            { id: 'global', label: 'عام' },
            { id: 'easy', label: 'سهل' },
            { id: 'medium', label: 'متوسط' },
            { id: 'hard', label: 'صعب' },
            { id: 'expert', label: 'خبير' }
        ];
        const selectedGame = this._selectedGameId || games[0].id;
        const selectedDiff = this._selectedDifficulty || 'global';

        return `
            <div class="gh-leaderboard-section">
                <div class="gh-game-filter">
                    ${games.map(g => `
                        <button class="gh-game-pill ${g.id === selectedGame ? 'active' : ''}" data-game="${g.id}">
                            ${g.icon}
                        </button>
                    `).join('')}
                </div>
                <div class="gh-difficulty-filter">
                    ${difficulties.map(d => `
                        <button class="gh-diff-pill ${d.id === selectedDiff ? 'active' : ''}" data-diff="${d.id}">
                            ${d.label}
                        </button>
                    `).join('')}
                </div>
                <div class="gh-leaderboard-list" id="gh-leaderboard-list">
                    <div class="gh-loading"><span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h14M5 21h14M7 3v5l5 4-5 4v5m10-18v5l-5 4 5 4v5"/></svg></span> جاري التحميل...</div>
                </div>
            </div>
        `;
    }

    // ─── تحميل البيانات ───────────────────────────────────────────────────
    async _loadData() {
        if (this.currentTab === 'achievements') {
            await this._loadAchievements(this._selectedGameId || 'chess');
        } else if (this.currentTab === 'leaderboard') {
            await this._loadLeaderboard(this._selectedGameId || 'chess', this._selectedDifficulty || 'global');
        }
    }

    async _loadAchievements(gameId) {
        const list = this.contentEl?.querySelector('#gh-achievements-list');
        if (!list) return;

        try {
            const achievements = GameHubAPI.achievements.getForGame(gameId);

            if (!achievements || achievements.length === 0) {
                list.innerHTML = '<div class="gh-empty">لا توجد إنجازات لهذه اللعبة حتى الآن</div>';
                return;
            }

            const tierColors = { bronze: '#cd7f32', silver: '#c0c0c0', gold: '#ffd700', platinum: '#a8a8de' };
            const tierLabels = { bronze: 'برونزي', silver: 'فضي', gold: 'ذهبي', platinum: 'بلاتيني' };

            list.innerHTML = achievements.map(ach => {
                const userAch = GameHubAPI.achievements.getUserProgress(ach.id);
                const isUnlocked = !!userAch?.unlocked_at;
                const progress = ach.condition_value ? Math.min(100, ((userAch?.progress || 0) / ach.condition_value) * 100) : 0;
                const tierColor = tierColors[ach.tier] || tierColors.bronze;

                return `
                    <div class="gh-achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
                        <div class="gh-ach-icon" style="background:${tierColor}22;border-color:${tierColor}44;">
                            ${isUnlocked ? ach.icon : '<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="3"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></span>'}
                        </div>
                        <div class="gh-ach-info">
                            <div class="gh-ach-name">
                                ${ach.name}
                                <span class="gh-ach-tier" style="background:${tierColor}33;color:${tierColor};">
                                    ${tierLabels[ach.tier] || ''}
                                </span>
                            </div>
                            <div class="gh-ach-desc">${ach.description}</div>
                            <div class="gh-ach-progress-bar">
                                <div class="gh-ach-progress-fill" style="width:${progress}%;background:${isUnlocked ? tierColor : 'var(--text-muted)'};"></div>
                            </div>
                            <small>${userAch?.progress || 0} / ${ach.condition_value} • +${ach.xp_reward} XP</small>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            list.innerHTML = '<div class="gh-empty">تعذر تحميل الإنجازات</div>';
        }
    }

    async _loadLeaderboard(gameId, difficulty) {
        const list = this.contentEl?.querySelector('#gh-leaderboard-list');
        if (!list) return;

        try {
            const entries = await GameHubAPI.leaderboard.get(gameId, { difficulty, limit: 50 });

            if (!entries || entries.length === 0) {
                list.innerHTML = '<div class="gh-empty">لا توجد بيانات في لوحة الصدارة بعد</div>';
                return;
            }

            const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32'];

            list.innerHTML = `
                <table class="gh-lb-table">
                    <thead><tr><th>#</th><th>اللاعب</th><th>المستوى</th><th>النقاط</th></tr></thead>
                    <tbody>
                        ${entries.map((entry, i) => `
                            <tr class="${i < 3 ? 'gh-lb-top' : ''} ${entry.userId === authManager.getUserId() ? 'gh-lb-me' : ''}">
                                <td style="${i < 3 ? `color:${rankColors[i]};font-weight:800;` : ''}">
                                    ${i < 3 ? [`<span style="color:#ffd700;font-weight:700">#1</span>`,`<span style="color:#c0c0c0;font-weight:700">#2</span>`,`<span style="color:#cd7f32;font-weight:700">#3</span>`][i] : (entry.rank || i + 1)}
                                </td>
                                <td class="gh-lb-player">
                                    <img src="${entry.avatarUrl || 'https://www.gravatar.com/avatar/0?d=identicon&s=32'}" alt="" width="28" height="28" style="border-radius:50%">
                                    <span>${entry.username || 'لاعب'}</span>
                                </td>
                                <td>${entry.level || 1}</td>
                                <td class="gh-lb-score">${(entry.score || 0).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (err) {
            list.innerHTML = '<div class="gh-empty">تعذر تحميل لوحة الصدارة</div>';
        }
    }

    // ─── ربط زر البروفايل في الـ Header ──────────────────────────────────
    _bindHeaderButton() {
        const headerBtn = document.querySelector('.header-profile');
        if (headerBtn) {
            headerBtn.removeAttribute('title');
            headerBtn.setAttribute('aria-label', 'الملف الشخصي');
            headerBtn.addEventListener('click', () => this.open('profile'));
        }
    }

    _listenToAuth() {
        GameHubAPI.auth.onAuthChange((event, user) => {
            this._updateHeaderButton(user);
            if (this.isOpen) {
                this._updateContent();
            }
        });
    }

    // ─── تحديث مظهر زر البروفايل ──────────────────────────────────────────
    _updateHeaderButton(user) {
        const headerBtn = document.querySelector('.header-profile');
        if (!headerBtn) return;
        const avatar = headerBtn.querySelector('.profile-avatar');
        const label = headerBtn.querySelector('.profile-label');

        if (user) {
            if (avatar) {
                avatar.innerHTML = '';
                if (user.avatar_url) {
                    const img = document.createElement('img');
                    img.src = user.avatar_url;
                    img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
                    img.onerror = () => { img.style.display = 'none'; avatar.innerHTML = '<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></span>'; };
                    avatar.appendChild(img);
                } else {
                    avatar.innerHTML = user.username?.[0]?.toUpperCase() ? `<span style="font-size:1.1rem;font-weight:700">${user.username[0].toUpperCase()}</span>` : '<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></span>';
                }
            }
            if (label) label.textContent = user.username || user.display_name || 'بروفايل';
        } else {
            if (avatar) avatar.innerHTML = '<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></span>';
            if (label) label.textContent = 'دخول';
        }
    }

    _openGravatarProfile() {
        window.open('https://gravatar.com/profile', '_blank', 'noopener,noreferrer');
    }

    // ─── مودال تغيير الاسم ────────────────────────────────────────────────
    _showEditNameModal() {
        // إزالة أي مودال سابق
        document.getElementById('gh-edit-name-modal')?.remove();

        const profile = GameHubAPI.profile.getProfile();
        const currentName = profile?.display_name || profile?.username || '';

        const modal = document.createElement('div');
        modal.id = 'gh-edit-name-modal';
        modal.className = 'gh-edit-name-overlay';
        modal.innerHTML = `
            <div class="gh-edit-name-box">
                <h4><span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span> تغيير الاسم</h4>
                <p class="gh-edit-name-hint">سيظهر هذا الاسم في الدردشة ولوحة الصدارة</p>
                <input
                    id="gh-edit-name-input"
                    class="gh-edit-name-input"
                    type="text"
                    maxlength="30"
                    placeholder="أدخل الاسم الجديد"
                    value="${this._escapeHtml(currentName)}"
                    autocomplete="off"
                />
                <div class="gh-edit-name-counter"><span id="gh-name-len">${currentName.length}</span>/30</div>
                <div class="gh-edit-name-error" id="gh-edit-name-error"></div>
                <div class="gh-edit-name-actions">
                    <button class="gh-btn gh-btn-save-name" id="gh-btn-save-name">💾 حفظ</button>
                    <button class="gh-btn gh-btn-cancel-name" id="gh-btn-cancel-name">إلغاء</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const input    = document.getElementById('gh-edit-name-input');
        const errorEl  = document.getElementById('gh-edit-name-error');
        const lenEl    = document.getElementById('gh-name-len');
        const saveBtn  = document.getElementById('gh-btn-save-name');
        const cancelBtn= document.getElementById('gh-btn-cancel-name');

        // عداد الأحرف
        input.addEventListener('input', () => {
            lenEl.textContent = input.value.length;
            errorEl.textContent = '';
        });

        // تركيز تلقائي وتحديد النص
        setTimeout(() => { input.focus(); input.select(); }, 50);

        // إغلاق عند الضغط على Escape
        const onKey = (e) => {
            if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', onKey); }
            if (e.key === 'Enter')  saveBtn.click();
        };
        document.addEventListener('keydown', onKey);

        // إغلاق عند الضغط خارج الصندوق
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { modal.remove(); document.removeEventListener('keydown', onKey); }
        });

        cancelBtn.addEventListener('click', () => {
            modal.remove();
            document.removeEventListener('keydown', onKey);
        });

        saveBtn.addEventListener('click', async () => {
            const newName = input.value.trim();

            if (!newName) {
                errorEl.textContent = '⚠️ الاسم لا يمكن أن يكون فارغاً';
                return;
            }
            if (newName.length < 2) {
                errorEl.textContent = '⚠️ الاسم يجب أن يكون حرفين على الأقل';
                return;
            }

            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="gh-icon gh-icon-xs"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h14M5 21h14M7 3v5l5 4-5 4v5m10-18v5l-5 4 5 4v5"/></svg></span> جارٍ الحفظ…';

            const { error } = await GameHubAPI.profile.updateProfile({ display_name: newName });

            if (error) {
                errorEl.textContent = '⚠ حدث خطأ، حاول مجدداً';
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 حفظ';
                return;
            }

            // تحديث الاسم في الواجهة فوراً
            const nameEl = this.contentEl?.querySelector('.gh-profile-info h4');
            if (nameEl) nameEl.textContent = newName;

            modal.remove();
            document.removeEventListener('keydown', onKey);
        });
    }

    // ─── مساعد escape للـ HTML ────────────────────────────────────────────
    _escapeHtml(str) {
        return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ─── أنماط CSS مُحقونة ────────────────────────────────────────────────
    _injectStyles() {
        if (document.getElementById('gh-profile-ui-styles')) return;
        const style = document.createElement('style');
        style.id = 'gh-profile-ui-styles';
        style.textContent = `
            /* ── Header ── */
            .gh-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 20px;
                border-bottom: 1px solid var(--border, rgba(99,102,241,0.15));
                flex-shrink: 0;
                background: var(--bg-card, #131b2e);
            }
            .gh-modal-title {
                font-size: 1rem;
                font-weight: 700;
                color: var(--text, #f1f5f9);
                margin: 0;
            }
            .gh-modal-close {
                width: 32px; height: 32px;
                border-radius: 50%;
                border: 1px solid var(--border, rgba(99,102,241,0.15));
                background: var(--bg, #0a0e1a);
                color: var(--text-muted, #94a3b8);
                cursor: pointer;
                font-size: 1rem;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.2s;
                -webkit-tap-highlight-color: transparent;
            }
            .gh-modal-close:hover { background: rgba(239,68,68,0.15); color: #ef4444; border-color: rgba(239,68,68,0.3); }

            /* ── Tabs ── */
            .gh-modal-tabs {
                display: flex;
                border-bottom: 1px solid var(--border, rgba(99,102,241,0.15));
                flex-shrink: 0;
                background: var(--bg-card, #131b2e);
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
                scrollbar-width: none;
            }
            .gh-modal-tabs::-webkit-scrollbar { display: none; }
            .gh-tab {
                flex: 1;
                min-width: 80px;
                padding: 12px 8px;
                border: none;
                background: none;
                color: var(--text-muted, #94a3b8);
                font-family: inherit;
                font-size: 0.82rem;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: all 0.2s;
                white-space: nowrap;
                -webkit-tap-highlight-color: transparent;
            }
            .gh-tab.active {
                color: var(--primary-light, #818cf8);
                border-bottom-color: var(--primary, #6366f1);
                font-weight: 600;
            }
            .gh-tab:hover:not(.active) { color: var(--text, #f1f5f9); background: rgba(99,102,241,0.06); }

            /* ── Login Section ── */
            .gh-login-section {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 14px;
                padding: 40px 20px;
                text-align: center;
            }
            .gh-login-icon { font-size: 3.5rem; }
            .gh-login-section h4 { font-size: 1.2rem; color: var(--text, #f1f5f9); margin: 0; }
            .gh-login-section p { color: var(--text-muted, #94a3b8); font-size: 0.9rem; line-height: 1.6; margin: 0; }
            .gh-login-note { color: var(--text-muted, #94a3b8); font-size: 0.78rem; }

            /* ── Buttons ── */
            .gh-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                width: 100%;
                padding: 12px 18px;
                border-radius: 12px;
                border: 1px solid var(--border, rgba(99,102,241,0.15));
                background: var(--bg-card, #131b2e);
                color: var(--text, #f1f5f9);
                font-family: inherit;
                font-size: 0.95rem;
                cursor: pointer;
                transition: all 0.2s;
                -webkit-tap-highlight-color: transparent;
            }
            .gh-btn:hover { background: var(--bg-card-hover, #1a2540); border-color: rgba(99,102,241,0.3); }
            .gh-btn:active { transform: scale(0.98); }
            .gh-btn-github { background: rgba(24,23,23,0.12); border-color: rgba(110,118,129,0.35); }
            .gh-btn-github:hover { background: rgba(24,23,23,0.2); }
            .gh-profile-avatar-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 2px; }
            .gh-avatar-note { color: var(--text-muted, #94a3b8); font-size: 0.82rem; line-height: 1.5; }
            .gh-btn-guest { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.3); }
            .gh-btn-logout { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.2); color: #ef4444; margin-top: 8px; }
            .gh-btn-logout:hover { background: rgba(239,68,68,0.15); }
            .gh-btn-edit-name { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.3); color: var(--primary-light, #818cf8); }
            .gh-btn-edit-name:hover { background: rgba(99,102,241,0.2); }
            .gh-btn-cancel-name { background: rgba(100,116,139,0.1); border-color: rgba(100,116,139,0.25); color: var(--text-muted, #94a3b8); }
            .gh-btn-cancel-name:hover { background: rgba(100,116,139,0.2); }

            /* ── Edit Name Modal ── */
            .gh-edit-name-overlay {
                position: fixed; inset: 0; z-index: 10000;
                background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
                display: flex; align-items: center; justify-content: center;
                animation: ghFadeIn 0.15s ease;
            }
            .gh-edit-name-box {
                background: var(--surface, #1e293b);
                border: 1px solid rgba(99,102,241,0.25);
                border-radius: 16px; padding: 24px 28px;
                width: min(380px, 92vw);
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                animation: ghSlideUp 0.2s ease;
            }
            .gh-edit-name-box h4 { margin: 0 0 4px; font-size: 1rem; color: var(--text, #e2e8f0); }
            .gh-edit-name-hint { margin: 0 0 14px; font-size: 0.78rem; color: var(--text-muted, #94a3b8); }
            .gh-edit-name-input {
                width: 100%; box-sizing: border-box;
                background: rgba(0,0,0,0.25); border: 1px solid rgba(99,102,241,0.3);
                border-radius: 8px; padding: 10px 12px;
                color: var(--text, #e2e8f0); font-size: 0.95rem;
                outline: none; transition: border-color 0.2s;
            }
            .gh-edit-name-input:focus { border-color: rgba(99,102,241,0.7); }
            .gh-edit-name-counter { font-size: 0.72rem; color: var(--text-muted, #94a3b8); text-align: left; margin: 4px 2px 0; direction: ltr; }
            .gh-edit-name-error { min-height: 18px; font-size: 0.78rem; color: #ef4444; margin: 6px 0; }
            .gh-edit-name-actions { display: flex; gap: 8px; margin-top: 12px; }
            .gh-edit-name-actions .gh-btn { flex: 1; justify-content: center; }

            /* ── Profile Section ── */
            .gh-profile-section { display: flex; flex-direction: column; gap: 16px; }
            .gh-profile-header { display: flex; align-items: center; gap: 14px; padding: 16px; background: var(--bg-card, #131b2e); border-radius: 14px; border: 1px solid var(--border, rgba(99,102,241,0.15)); }
            .gh-profile-avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary, #6366f1); flex-shrink: 0; }
            .gh-profile-avatar-wrap { position: relative; display: inline-block; flex-shrink: 0; }
            .gh-status-dot { position: absolute; bottom: 2px; right: 2px; width: 16px; height: 16px; border-radius: 50%; background: #10b981; border: 2px solid var(--bg-card, #131b2e); z-index: 2; transition: background 0.3s; }
            .gh-status-dot.online { background: #10b981; box-shadow: 0 0 6px rgba(16,185,129,0.5); }
            .gh-status-dot.offline { background: #6b7280; }
            .gh-status-dot.playing { background: #6366f1; box-shadow: 0 0 6px rgba(99,102,241,0.5); }
            .gh-status-dot.away { background: #f59e0b; box-shadow: 0 0 6px rgba(245,158,11,0.5); }
            .gh-profile-info { display: flex; flex-direction: column; gap: 4px; }
            .gh-profile-info h4 { font-size: 1.05rem; color: var(--text, #f1f5f9); margin: 0; }
            .gh-profile-rank { font-size: 0.8rem; color: var(--primary-light, #818cf8); background: rgba(99,102,241,0.12); padding: 2px 10px; border-radius: 20px; width: fit-content; }
            .gh-guest-badge { font-size: 0.75rem; color: var(--text-muted, #94a3b8); background: rgba(148,163,184,0.1); padding: 2px 8px; border-radius: 20px; }
            .gh-user-id-box { background: rgba(0,0,0,0.2); border: 1px solid rgba(99,102,241,0.15); border-radius: 10px; padding: 10px 14px; margin: 12px 0 4px; }
            .gh-user-id-label { font-size: 0.72rem; color: var(--text-muted, #94a3b8); display: block; margin-bottom: 6px; }
            .gh-user-id-row { display: flex; align-items: center; gap: 8px; }
            .gh-user-id-value { font-family: monospace; font-size: 0.78rem; color: var(--text, #e2e8f0); background: rgba(99,102,241,0.08); padding: 3px 8px; border-radius: 6px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: ltr; }
            .gh-user-id-copy { background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.2); border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 0.85rem; color: var(--text, #e2e8f0); transition: background 0.2s; flex-shrink: 0; }
            .gh-user-id-copy:hover { background: rgba(99,102,241,0.3); }

            /* ── XP Bar ── */
            .gh-xp-bar-container { padding: 12px 16px; background: var(--bg-card, #131b2e); border-radius: 12px; border: 1px solid var(--border, rgba(99,102,241,0.15)); }
            .gh-xp-label { display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-muted, #94a3b8); margin-bottom: 8px; }
            .gh-xp-bar { height: 8px; background: rgba(99,102,241,0.12); border-radius: 20px; overflow: hidden; }
            .gh-xp-fill { height: 100%; background: linear-gradient(90deg, var(--primary, #6366f1), var(--primary-light, #818cf8)); border-radius: 20px; transition: width 0.5s ease; }

            /* ── Stats Grid ── */
            .gh-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .gh-stat-box { background: var(--bg-card, #131b2e); border: 1px solid var(--border, rgba(99,102,241,0.15)); border-radius: 12px; padding: 14px; text-align: center; }
            .gh-stat-value { display: block; font-size: 1.4rem; font-weight: 700; color: var(--primary-light, #818cf8); }
            .gh-stat-label { font-size: 0.78rem; color: var(--text-muted, #94a3b8); }

            /* ── Profile Actions ── */
            .gh-profile-actions { display: flex; gap: 10px; }
            .gh-profile-actions .gh-btn { flex: 1; font-size: 0.88rem; }
            .gh-btn-achievements { background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.25); }
            .gh-btn-leaderboard { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.25); }

            /* ── Game/Diff Filter Pills ── */
            .gh-game-filter, .gh-difficulty-filter {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-bottom: 12px;
            }
            .gh-game-pill, .gh-diff-pill {
                padding: 7px 12px;
                border-radius: 20px;
                border: 1px solid var(--border, rgba(99,102,241,0.15));
                background: var(--bg-card, #131b2e);
                color: var(--text-muted, #94a3b8);
                font-family: inherit;
                font-size: 0.83rem;
                cursor: pointer;
                transition: all 0.2s;
                -webkit-tap-highlight-color: transparent;
                white-space: nowrap;
            }
            .gh-game-pill.active, .gh-diff-pill.active {
                background: rgba(99,102,241,0.15);
                border-color: rgba(99,102,241,0.4);
                color: var(--primary-light, #818cf8);
                font-weight: 600;
            }

            /* ── Achievement Cards ── */
            .gh-achievement-card {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                border-radius: 12px;
                border: 1px solid var(--border, rgba(99,102,241,0.15));
                margin-bottom: 8px;
                transition: all 0.2s;
            }
            .gh-achievement-card.unlocked { background: var(--bg-card, #131b2e); }
            .gh-achievement-card.locked { background: rgba(15,20,35,0.5); opacity: 0.7; }
            .gh-ach-icon { width: 44px; height: 44px; border-radius: 10px; border: 1px solid; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0; }
            .gh-ach-info { flex: 1; min-width: 0; }
            .gh-ach-name { font-size: 0.88rem; font-weight: 600; color: var(--text, #f1f5f9); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 3px; }
            .gh-ach-tier { font-size: 0.7rem; padding: 1px 7px; border-radius: 20px; }
            .gh-ach-desc { font-size: 0.78rem; color: var(--text-muted, #94a3b8); margin-bottom: 6px; }
            .gh-ach-progress-bar { height: 5px; background: rgba(99,102,241,0.1); border-radius: 20px; overflow: hidden; margin-bottom: 3px; }
            .gh-ach-progress-fill { height: 100%; border-radius: 20px; transition: width 0.4s ease; }

            /* ── Leaderboard Table ── */
            .gh-lb-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
            .gh-lb-table th { padding: 8px 10px; color: var(--text-muted, #94a3b8); font-weight: 600; border-bottom: 1px solid var(--border, rgba(99,102,241,0.15)); text-align: right; }
            .gh-lb-table td { padding: 10px; border-bottom: 1px solid rgba(99,102,241,0.07); color: var(--text, #f1f5f9); text-align: right; }
            .gh-lb-player { display: flex; align-items: center; gap: 8px; }
            .gh-lb-score { font-weight: 700; color: var(--primary-light, #818cf8); }
            .gh-lb-top td { background: rgba(99,102,241,0.04); }
            .gh-lb-me td { background: rgba(99,102,241,0.1); }

            /* ── Loading / Empty ── */
            .gh-loading, .gh-empty {
                text-align: center;
                padding: 40px 20px;
                color: var(--text-muted, #94a3b8);
                font-size: 0.9rem;
            }

            /* ── Drag Handle (هاتف فقط) ── */
            .gh-drag-handle-wrapper {
                display: none;
                justify-content: center;
                padding: 10px 0 2px;
                flex-shrink: 0;
                cursor: grab;
            }
            .gh-drag-handle {
                width: 40px; height: 4px;
                background: rgba(148,163,184,0.25);
                border-radius: 2px;
            }

            /* ── Mobile ── */
            @media (max-width: 767px) {
                .gh-drag-handle-wrapper { display: flex; }

                .gh-modal-panel {
                    max-width: 100% !important;
                    border-right: none !important;
                    border-top: 1px solid var(--border, rgba(99,102,241,0.15)) !important;
                    max-height: 90vh !important;
                    border-radius: 20px 20px 0 0 !important;
                }
                .gh-profile-overlay {
                    align-items: flex-end !important;
                    justify-content: center !important;
                }

                /* stats أفقية بدل 2×2 */
                .gh-stats-grid {
                    grid-template-columns: repeat(4, 1fr);
                    gap: 6px;
                }
                .gh-stat-box {
                    padding: 10px 6px;
                }
                .gh-stat-value {
                    font-size: 1.1rem;
                }
                .gh-stat-label {
                    font-size: 0.7rem;
                }

                /* أزرار أكثر إحكاماً */
                .gh-profile-actions { gap: 8px; }
                .gh-profile-actions .gh-btn { padding: 10px 8px; font-size: 0.82rem; }
                .gh-btn-logout { padding: 10px; font-size: 0.85rem; }

                /* header بروفايل أصغر */
                .gh-profile-header { padding: 12px; gap: 10px; }
                .gh-profile-avatar { width: 52px; height: 52px; }
                .gh-profile-info h4 { font-size: 0.95rem; }

                /* XP bar أقل padding */
                .gh-xp-bar-container { padding: 10px 14px; }
            }
        `;
        document.head.appendChild(style);
    }
}

export const profileUI = new ProfileUI();
export default profileUI;

// تصدير للاستخدام من الـ onclick في HTML (fallback)
if (typeof window !== 'undefined') {
    window.profileUI = profileUI;
}
