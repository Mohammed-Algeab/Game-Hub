/**
 * main.js - Game Hub Main Logic
 * المنطق الرئيسي للموقع (القائمة، التنقل، الفئات)
 */

class GameHub {
    constructor() {
        this.currentCategory = 'all';
        const _i = {
            gamepad: `<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 12h4m-2-2v4"/><circle cx="16" cy="11" r="1" fill="currentColor"/><circle cx="19" cy="13" r="1" fill="currentColor"/></svg></span>`,
            puzzle: `<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"/></svg></span>`,
            zap: `<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>`,
            chess: `<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><polyline points="20 16 16 20"/><polyline points="7 3 14 10"/><line x1="5" y1="11" x2="11" y2="5"/><polyline points="4 8 8 4"/></svg></span>`,
            joystick: `<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="14" width="18" height="7" rx="3"/><path d="M12 14V8"/><circle cx="12" cy="6" r="2"/><path d="M9 17h.01M15 17h.01"/></svg></span>`,
            trophy: `<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8m-4-4v4"/><path d="M6 3h12v8a6 6 0 01-12 0V3z"/><path d="M6 7H3a1 1 0 00-1 1v2a4 4 0 004 4M18 7h3a1 1 0 011 1v2a4 4 0 01-4 4"/></svg></span>`,
            grid: `<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg></span>`,
        };
        this.categories = [
            { id: 'all',      label: 'جميع الألعاب', icon: _i.gamepad  },
            { id: 'puzzle',   label: 'ألغاز',         icon: _i.puzzle   },
            { id: 'action',   label: 'أكشن',           icon: _i.zap      },
            { id: 'strategy', label: 'استراتيجية',     icon: _i.chess    },
            { id: 'card',     label: 'أوراق',          icon: _i.grid     },
            { id: 'arcade',   label: 'آركيد',          icon: _i.joystick },
            { id: 'sports',   label: 'رياضة',          icon: _i.trophy   }
        ];
        this.init();
    }

    init() {
        this.initNavigation();
        this.initDropdowns();
        this.initMobileMenu();
        this.initCategoryFilter();
        this.initMobileCategoriesDrawer();
        this.initMobileGameHiding();
        this.updateStats();
    }

    /**
     * تهيئة التنقل - تحديد الرابط النشط
     */
    initNavigation() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('.nav-link').forEach(link => {
            const href = link.getAttribute('href');
            if (href === currentPage || (currentPage === '' && href === 'index.html')) {
                link.classList.add('active');
            }
        });
    }

    /**
     * تهيئة القوائم المنسدلة
     */
    initDropdowns() {
        // Desktop dropdowns
        document.querySelectorAll('.dropdown').forEach(dropdown => {
            const trigger = dropdown.querySelector('.dropdown-trigger');

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close other dropdowns
                document.querySelectorAll('.dropdown.open').forEach(d => {
                    if (d !== dropdown) d.classList.remove('open');
                });
                dropdown.classList.toggle('open');
            });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.dropdown.open').forEach(d => {
                d.classList.remove('open');
            });
        });

        // Mobile dropdowns
        document.querySelectorAll('.mobile-dropdown').forEach(dropdown => {
            const header = dropdown.querySelector('.mobile-dropdown-header');
            header.addEventListener('click', () => {
                dropdown.classList.toggle('open');
            });
        });
    }

    /**
     * تهيئة قائمة الهاتف (Burger Menu)
     */
    initMobileMenu() {
        const menuToggle = document.querySelector('.menu-toggle');
        const mobileNav = document.querySelector('.mobile-nav-overlay');

        if (!menuToggle || !mobileNav) return;

        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            mobileNav.classList.toggle('active');
            // Prevent body scroll when menu is open
            document.body.style.overflow = mobileNav.classList.contains('active') ? 'hidden' : '';
        });

        // Close menu when clicking a link
        mobileNav.querySelectorAll('a, button').forEach(el => {
            el.addEventListener('click', () => {
                menuToggle.classList.remove('active');
                mobileNav.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }

    /**
     * تهيئة تصفية الفئات
     */
    initCategoryFilter() {
        const desktopMenu = document.getElementById('categories-dropdown');
        const mobileDrawerMenu = document.getElementById('mobile-categories-menu');

        if (desktopMenu) {
            this.categories.forEach(cat => {
                const btn = document.createElement('button');
                btn.className = 'cat-filter-btn' + (cat.id === 'all' ? ' active' : '');
                btn.dataset.category = cat.id;
                btn.innerHTML = `
                    <span class="cat-icon">${cat.icon}</span>
                    <span class="cat-label">${cat.label}</span>
                `;
                btn.addEventListener('click', () => this.filterGames(cat.id));
                desktopMenu.appendChild(btn);
            });
        }

        if (mobileDrawerMenu) {
            this.categories.forEach(cat => {
                const btn = document.createElement('button');
                btn.className = 'cat-filter-btn' + (cat.id === 'all' ? ' active' : '');
                btn.dataset.category = cat.id;
                btn.innerHTML = `
                    <span class="cat-icon">${cat.icon}</span>
                    <span class="cat-label">${cat.label}</span>
                `;
                btn.addEventListener('click', () => this.filterGames(cat.id));
                mobileDrawerMenu.appendChild(btn);
            });
        }
    }

    /**
     * تصفية الألعاب حسب الفئة
     */
    filterGames(category) {
        this.currentCategory = category;
        const cards = document.querySelectorAll('.game-card');
        let visibleCount = 0;

        cards.forEach(card => {
            const cardCategory = card.dataset.category || 'all';
            const shouldShow = category === 'all' || cardCategory === category;

            if (shouldShow && !card.classList.contains('hidden-on-mobile')) {
                card.style.display = '';
                visibleCount++;
            } else if (shouldShow && card.classList.contains('hidden-on-mobile')) {
                // Don't show mobile-hidden games even if category matches
                card.style.display = 'none';
            } else {
                card.style.display = 'none';
            }
        });

        // Update filter info text
        const filterInfo = document.getElementById('filter-info');
        if (filterInfo) {
            const catLabel = this.categories.find(c => c.id === category)?.label || 'جميع الألعاب';
            filterInfo.textContent = `الفئة: ${catLabel} | ${visibleCount} لعبة`;
        }

        // Close any open dropdowns
        document.querySelectorAll('.dropdown.open, .mobile-dropdown.open').forEach(d => {
            d.classList.remove('open');
        });

        // Update drawer active state
        this._updateDrawerActiveState();
    }

    /**
     * تهيئة drawer الفئات للجوال
     */
    initMobileCategoriesDrawer() {
        const drawerBtn = document.getElementById('categories-mobile-btn');
        const drawer = document.getElementById('categories-drawer');
        const overlay = document.getElementById('categories-drawer-overlay');
        const closeBtn = document.getElementById('categories-drawer-close');

        if (!drawerBtn || !drawer || !overlay) return;

        const openDrawer = () => {
            drawer.style.display = 'block';
            overlay.style.display = 'block';
            // Force reflow
            void drawer.offsetHeight;
            void overlay.offsetHeight;
            drawer.classList.add('active');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            // Update active state
            this._updateDrawerActiveState();
        };

        const closeDrawer = () => {
            drawer.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
            // Hide after transition
            setTimeout(() => {
                if (!drawer.classList.contains('active')) {
                    drawer.style.display = 'none';
                    overlay.style.display = 'none';
                }
            }, 350);
        };

        drawerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openDrawer();
        });

        closeBtn?.addEventListener('click', closeDrawer);
        overlay.addEventListener('click', closeDrawer);

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && drawer.classList.contains('active')) {
                closeDrawer();
            }
        });

        // Close when clicking a category item
        drawer.addEventListener('click', (e) => {
            const item = e.target.closest('.cat-filter-btn');
            if (item) {
                closeDrawer();
            }
        });

        // Store reference for updating active state
        this._drawer = drawer;
    }

    _updateDrawerActiveState() {
        // Update mobile drawer
        if (this._drawer) {
            this._drawer.querySelectorAll('.cat-filter-btn').forEach(item => {
                item.classList.toggle('active', item.dataset.category === this.currentCategory);
            });
        }
        // Update desktop dropdown too
        const desktopMenu = document.getElementById('categories-dropdown');
        if (desktopMenu) {
            desktopMenu.querySelectorAll('.cat-filter-btn').forEach(item => {
                item.classList.toggle('active', item.dataset.category === this.currentCategory);
            });
        }
    }

    /**
     * إخفاء الألعاب غير المدعومة على الهاتف
     */
    initMobileGameHiding() {
        // Check if mobile via MobileManager (if available)
        const isMobile = window.mobileManager?.isMobile() || this.checkMobile();

        if (isMobile) {
            document.body.classList.add('is-mobile');

            // Hide games marked as not mobile-friendly
            document.querySelectorAll('.game-card[data-mobile="false"]').forEach(card => {
                card.classList.add('hidden-on-mobile');
            });
        }
    }

    /**
     * فحص بسيط للهاتف (backup if mobile.js not loaded)
     */
    checkMobile() {
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        const isSmallScreen = window.innerWidth <= 767;
        const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches || false;
        const hasRealTouch = (navigator.maxTouchPoints || 0) >= 2;

        return isMobileUA || (isSmallScreen && (coarsePointer || hasRealTouch));
    }

    /**
     * تحديث إحصائيات الصفحة الرئيسية
     */
    updateStats() {
        const totalGames = document.querySelectorAll('.game-card').length;
        const mobileGames = document.querySelectorAll('.game-card[data-mobile="true"]').length;
        const categories = new Set();
        document.querySelectorAll('.game-card').forEach(card => {
            if (card.dataset.category) categories.add(card.dataset.category);
        });

        const statTotal = document.getElementById('stat-total');
        const statMobile = document.getElementById('stat-mobile');
        const statCategories = document.getElementById('stat-categories');

        if (statTotal) statTotal.textContent = totalGames;
        if (statMobile) statMobile.textContent = mobileGames;
        if (statCategories) statCategories.textContent = categories.size;
    }
}

// Coming Soon notification
function showComingSoon(gameName) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `
        <span class="toast-icon"><span class="gh-icon gh-icon-md"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 12h4m-2-2v4"/><circle cx="16" cy="11" r="1" fill="currentColor"/><circle cx="19" cy="13" r="1" fill="currentColor"/></svg></span></span>
        <div class="toast-content">
            <strong>${gameName}</strong>
            <span>قريباً! يتم تطوير اللعبة.</span>
        </div>
    `;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.gameHub = new GameHub();
    window.showComingSoon = showComingSoon;
});
