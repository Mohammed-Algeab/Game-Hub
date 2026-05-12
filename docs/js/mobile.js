/**
 * mobile.js - Device Detection & Touch Management
 * كشف الجهاز وإدارة اللمس والتحكم بالأزرار المرئية
 *
 * كيفية الاستخدام في ألعاب جديدة:
 *   import { MobileManager } from '../../js/mobile.js';
 *   const mobile = new MobileManager();
 *   if (mobile.isMobile()) { ... }
 */

export class MobileManager {
    constructor() {
        this._isMobile = this.detectMobile();
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchStartTime = 0;
        this.swipeThreshold = 30;       // min pixels for swipe
        this.tapThreshold = 10;           // max pixels for tap
        this.doubleTapDelay = 300;      // ms between taps
        this.lastTapTime = 0;
    }

    /**
     * كشف الجهاز: يستخدم 3 طرق للتأكد
     * 1. User Agent string
     * 2. maxTouchPoints
     * 3. حجم الشاشة
     */
    detectMobile() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
        const isSmallScreen = window.innerWidth <= 767;
        const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches || false;
        const hasRealTouch = (navigator.maxTouchPoints || 0) >= 2;

        // Prefer actual mobile signals. Do NOT treat any touch-capable laptop/desktop as mobile by default.
        return isMobileUA || (isSmallScreen && (coarsePointer || hasRealTouch));
    }

    isMobile() {
        return this._isMobile;
    }

    isTouchDevice() {
        return 'ontouchstart' in window || (navigator.maxTouchPoints > 0);
    }

    /**
     * الحصول على أبعاد الشاشة المتاحة للعبة
     * Returns: { width, height, isLandscape }
     */
    getScreenInfo() {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            isLandscape: window.innerWidth > window.innerHeight,
            isMobile: this._isMobile
        };
    }

    /**
     * إضافة مستمعي اللمس لـ Canvas أو عنصر اللعبة
     * @param {HTMLElement} element - عنصر اللعبة (عادة Canvas)
     * @param {Object} callbacks - دوال الاستدعاء
     *   { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onTap, onDoubleTap }
     */
    addTouchControls(element, callbacks = {}) {
        if (!element || !this.isTouchDevice()) return;

        element.addEventListener('touchstart', (e) => {
            // Prevent scrolling when touching game
            if (e.target === element) {
                e.preventDefault();
            }

            const touch = e.touches[0];
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
            this.touchStartTime = Date.now();
        }, { passive: false });

        element.addEventListener('touchend', (e) => {
            const touch = e.changedTouches[0];
            const dx = touch.clientX - this.touchStartX;
            const dy = touch.clientY - this.touchStartY;
            const dt = Date.now() - this.touchStartTime;

            // Determine if tap or swipe
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            // Tap detection (quick and small movement)
            if (absDx < this.tapThreshold && absDy < this.tapThreshold && dt < 300) {
                const now = Date.now();
                if (now - this.lastTapTime < this.doubleTapDelay) {
                    // Double tap
                    if (callbacks.onDoubleTap) callbacks.onDoubleTap(e);
                    this.lastTapTime = 0;
                } else {
                    // Single tap
                    if (callbacks.onTap) callbacks.onTap(e);
                    this.lastTapTime = now;
                }
                return;
            }

            // Swipe detection
            if (Math.max(absDx, absDy) > this.swipeThreshold) {
                if (absDx > absDy) {
                    // Horizontal swipe
                    if (dx > 0 && callbacks.onSwipeRight) callbacks.onSwipeRight(e);
                    else if (dx < 0 && callbacks.onSwipeLeft) callbacks.onSwipeLeft(e);
                } else {
                    // Vertical swipe
                    if (dy > 0 && callbacks.onSwipeDown) callbacks.onSwipeDown(e);
                    else if (dy < 0 && callbacks.onSwipeUp) callbacks.onSwipeUp(e);
                }
            }
        }, { passive: false });

        // Prevent default touchmove to stop page scrolling during gameplay
        element.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
    }

    /**
     * إنشاء أزرار التحكم المرئية للهاتف
     * @param {Object} buttonMap - خريطة الأزرار: { id: { label, action } }
     * @param {HTMLElement} container - العنصر الحاوي
     * @returns {HTMLElement} - العنصر الذي يحتوي الأزرار
     */
    createOnScreenButtons(buttonMap, container) {
        const wrapper = document.createElement('div');
        wrapper.className = 'game-mobile-controls';

        // Left side: directional buttons
        const leftGroup = document.createElement('div');
        leftGroup.className = 'mobile-btn-group';

        // Right side: action buttons
        const rightGroup = document.createElement('div');
        rightGroup.className = 'mobile-btn-group';

        Object.entries(buttonMap).forEach(([id, config]) => {
            const btn = document.createElement('button');
            btn.className = `mobile-btn ${config.large ? 'large' : ''}`;
            btn.innerHTML = config.label;
            btn.dataset.action = id;

            // Handle both touch and click
            const handlePress = (e) => {
                e.preventDefault();
                if (config.onPress) config.onPress();
            };

            const handleRelease = (e) => {
                e.preventDefault();
                if (config.onRelease) config.onRelease();
            };

            btn.addEventListener('touchstart', handlePress, { passive: false });
            btn.addEventListener('touchend', handleRelease, { passive: false });
            btn.addEventListener('mousedown', handlePress);
            btn.addEventListener('mouseup', handleRelease);

            if (config.position === 'right') {
                rightGroup.appendChild(btn);
            } else {
                leftGroup.appendChild(btn);
            }
        });

        wrapper.appendChild(leftGroup);
        wrapper.appendChild(rightGroup);

        if (container) {
            container.appendChild(wrapper);
        }

        return wrapper;
    }

    /**
     * إزالة أزرار التحكم المرئية
     */
    removeOnScreenButtons() {
        const controls = document.querySelector('.game-mobile-controls');
        if (controls) controls.remove();
    }

    /**
     * منع القفل التلقائي للشاشة أثناء اللعب (إذا كانت واجهة تدعمها)
     * NOTE: يتطلب تفاعل المستخدم أولاً
     */
    async keepScreenAwake() {
        if ('wakeLock' in navigator) {
            try {
                const wakeLock = await navigator.wakeLock.request('screen');
                return wakeLock;
            } catch (err) {
                console.log('Wake Lock not granted:', err);
            }
        }
        return null;
    }

    /**
     * تعديل حجم Canvas بناءً على الشاشة
     * @param {HTMLCanvasElement} canvas
     * @param {number} maxWidth - أقصى عرض
     * @param {number} aspectRatio - نسبة العرض للارتفاع
     */
    resizeCanvas(canvas, maxWidth = 400, aspectRatio = 0.8) {
        const screenInfo = this.getScreenInfo();
        let width = Math.min(screenInfo.width - 32, maxWidth);
        let height = width / aspectRatio;

        // If landscape on mobile, limit height
        if (screenInfo.isLandscape && screenInfo.isMobile) {
            height = Math.min(height, screenInfo.height - 100);
            width = height * aspectRatio;
        }

        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';

        const ctx = canvas.getContext('2d');
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        return { width, height };
    }
}

// Auto-initialize for global use
if (typeof window !== 'undefined') {
    window.mobileManager = new MobileManager();

    // Add body class for CSS targeting
    if (window.mobileManager.isMobile()) {
        document.body.classList.add('is-mobile');
    }
}

export default MobileManager;
