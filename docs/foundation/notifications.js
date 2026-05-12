/**
 * foundation/notifications.js
 * نظام الإشعارات (Toast) للإنجازات والأحداث
 */

class NotificationManager {
    constructor() {
        this.container = null;
        this.queue = [];
        this.isShowing = false;
        this.initContainer();
    }

    initContainer() {
        if (document.getElementById('gh-notification-container')) return;

        this.container = document.createElement('div');
        this.container.id = 'gh-notification-container';
        this.container.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: center;
            pointer-events: none;
        `;
        document.body.appendChild(this.container);
    }

    // ─── إشعار إنجاز ──────────────────────────────────────────────────────
    achievement(achievement) {
        const tierColors = {
            bronze:  '#cd7f32',
            silver:  '#c0c0c0',
            gold:    '#ffd700',
            platinum:'#e5e4e2'
        };

        const tierGradients = {
            bronze:  'linear-gradient(135deg, #cd7f3222, #cd7f3244)',
            silver:  'linear-gradient(135deg, #c0c0c022, #c0c0c044)',
            gold:    'linear-gradient(135deg, #ffd70022, #ffd70044)',
            platinum:'linear-gradient(135deg, #e5e4e222, #a8a8de44)'
        };

        const color = tierColors[achievement.tier] || tierColors.bronze;
        const gradient = tierGradients[achievement.tier] || tierGradients.bronze;
        const xpText = achievement.xp_reward ? `+${achievement.xp_reward} XP` : '';

        this.show({
            icon: achievement.icon || '🏆',
            title: `إنجاز مفتوح: ${achievement.name}`,
            message: achievement.description,
            subInfo: `${achievement.tier?.toUpperCase() || 'BRONZE'} ${xpText}`,
            style: `
                background: ${gradient};
                border: 1px solid ${color}44;
                box-shadow: 0 8px 32px ${color}33, 0 0 0 1px ${color}22;
            `,
            duration: 6000,
            sound: 'achievement'
        });
    }

    // ─── إشعار ترقية مستوى ────────────────────────────────────────────────
    levelUp(oldLevel, newLevel) {
        this.show({
            icon: '🆙',
            title: `ترقية! المستوى ${newLevel}`,
            message: `أصبحت الآن في المستوى ${newLevel}. استمر في اللعب!`,
            subInfo: `${oldLevel} → ${newLevel}`,
            style: `
                background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(236,72,153,0.1));
                border: 1px solid rgba(99,102,241,0.3);
                box-shadow: 0 8px 32px rgba(99,102,241,0.2);
            `,
            duration: 5000,
            sound: 'levelup'
        });
    }

    // ─── إشعار عام ────────────────────────────────────────────────────────
    success(title, message) {
        this.show({ icon: '✅', title, message, duration: 4000 });
    }

    error(title, message) {
        this.show({
            icon: '❌', title, message,
            style: `
                background: linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.1));
                border: 1px solid rgba(239,68,68,0.3);
            `,
            duration: 5000
        });
    }

    info(title, message) {
        this.show({
            icon: 'ℹ️', title, message,
            style: `
                background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(37,99,235,0.1));
                border: 1px solid rgba(59,130,246,0.3);
            `,
            duration: 4000
        });
    }

    // ─── عرض الإشعار ──────────────────────────────────────────────────────
    show({ icon, title, message, subInfo = '', style = '', duration = 4000, sound = null }) {
        this.initContainer();

        const toast = document.createElement('div');
        toast.style.cssText = `
            background: var(--bg-card, #131b2e);
            border: 1px solid var(--border, rgba(99,102,241,0.15));
            border-radius: 16px;
            padding: 16px 20px;
            display: flex;
            align-items: center;
            gap: 14px;
            min-width: 300px;
            max-width: 420px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
            pointer-events: auto;
            transform: translateY(-30px) scale(0.9);
            opacity: 0;
            transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
            ${style}
        `;

        toast.innerHTML = `
            <span style="font-size: 2rem; flex-shrink: 0; filter: drop-shadow(0 0 8px rgba(255,255,255,0.2));">${icon}</span>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 700; color: var(--text, #f1f5f9); font-size: 0.95rem; margin-bottom: 2px;">${title}</div>
                <div style="color: var(--text-muted, #94a3b8); font-size: 0.85rem; line-height: 1.4;">${message}</div>
                ${subInfo ? `<div style="color: var(--primary, #6366f1); font-size: 0.75rem; margin-top: 4px; font-weight: 600;">${subInfo}</div>` : ''}
            </div>
            <button style="background: none; border: none; color: var(--text-muted, #94a3b8); cursor: pointer; font-size: 1.2rem; padding: 4px; flex-shrink: 0; opacity: 0.6; transition: opacity 0.2s;">✕</button>
        `;

        // زر الإغلاق
        const closeBtn = toast.querySelector('button');
        closeBtn.addEventListener('click', () => this._dismiss(toast));

        this.container.appendChild(toast);

        // Animation in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.style.transform = 'translateY(0) scale(1)';
                toast.style.opacity = '1';
            });
        });

        // Auto dismiss
        const timer = setTimeout(() => this._dismiss(toast), duration);
        toast._timer = timer;

        // Play sound if requested
        if (sound) this._playSound(sound);
    }

    _dismiss(toast) {
        if (toast._dismissed) return;
        toast._dismissed = true;
        clearTimeout(toast._timer);

        toast.style.transform = 'translateY(-20px) scale(0.9)';
        toast.style.opacity = '0';

        setTimeout(() => {
            toast.remove();
        }, 400);
    }

    _playSound(type) {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'achievement') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523, ctx.currentTime);
                osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
                osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.4);
            } else if (type === 'levelup') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(392, ctx.currentTime);
                osc.frequency.setValueAtTime(523, ctx.currentTime + 0.1);
                osc.frequency.setValueAtTime(659, ctx.currentTime + 0.2);
                osc.frequency.setValueAtTime(784, ctx.currentTime + 0.3);
                osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.4);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.6);
            }
        } catch (e) {}
    }
}

export const notificationManager = new NotificationManager();
export default notificationManager;
