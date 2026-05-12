/**
 * foundation/gamehub-api.js
 * واجهة برمجية موحدة تجمع كل الأنظمة
 * GameHubAPI - نقطة الدخول الوحيدة لكل التفاعلات
 */

import { getSupabase } from './supabase-config.js';
import { authManager } from './auth.js';
import { profileManager } from './profile-system.js';
import { achievementsManager } from './achievements-system.js';
import { leaderboardManager } from './leaderboard-system.js';
import { notificationManager } from './notifications.js';
import { presenceSystem } from './presence-system.js';

// ─── GameHubAPI المركزي ──────────────────────────────────────────────────
export const GameHubAPI = {

    // ═══════════════════════════════════════════════════════════════════════
    // Auth
    // ═══════════════════════════════════════════════════════════════════════
    auth: {
        async init() { return authManager.init(); },
        async signInWithGitHub() { return authManager.signInWithGitHub(); },
        async signInWithGoogle() { return authManager.signInWithGoogle(); },
        async signInAsGuest(name) { return authManager.signInAsGuest(name); },
        async signOut() { return authManager.signOut(); },
        getUser() { return authManager.getUser(); },
        getUserId() { return authManager.getUserId(); },
        isAuthenticated() { return authManager.isAuthenticated(); },
        isLoggedIn() { return authManager.isLoggedIn(); },
        isGuest() { return authManager.isGuest; },
        async getJWT() { return authManager.getJWT(); },
        onAuthChange(cb) { return authManager.onAuthChange(cb); }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Profile
    // ═══════════════════════════════════════════════════════════════════════
    profile: {
        async load() { return profileManager.loadProfile(); },
        get() { return profileManager.getProfile(); },
        async update(updates) { return profileManager.updateProfile(updates); },
        async addXP(amount) { return profileManager.addXP(amount); },
        async updateStats(result) { return profileManager.updateStats(result); },
        onChange(cb) { return profileManager.onProfileChange(cb); }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Achievements
    // ═══════════════════════════════════════════════════════════════════════
    achievements: {
        async init() { return achievementsManager.init(); },
        getForGame(gameId) { return achievementsManager.getGameAchievements(gameId); },
        getUserProgress(achId) { return achievementsManager.getUserAchievement(achId); },
        async updateProgress(gameId, type, value, extra) {
            return achievementsManager.updateProgress(gameId, type, value, extra);
        },
        async checkGameEnd(gameId, result) {
            return achievementsManager.checkGameEnd(gameId, result);
        },
        onUnlock(cb) { return achievementsManager.onAchievementUnlocked(cb); }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Leaderboard
    // ═══════════════════════════════════════════════════════════════════════
    leaderboard: {
        async submit(gameId, score, opts = {}) {
            return leaderboardManager.submitScore(gameId, score, opts);
        },
        async get(gameId, opts = {}) {
            return leaderboardManager.getLeaderboard(gameId, opts);
        },
        async getPersonalBest(gameId, diff) {
            return leaderboardManager.getPersonalBest(gameId, diff);
        },
        async getPlayerRank(gameId, userId, diff) {
            return leaderboardManager.getPlayerRank(gameId, userId, diff);
        }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Notifications
    // ═══════════════════════════════════════════════════════════════════════
    notify: {
        achievement(ach) { notificationManager.achievement(ach); },
        levelUp(oldLvl, newLvl) { notificationManager.levelUp(oldLvl, newLvl); },
        success(title, msg) { notificationManager.success(title, msg); },
        error(title, msg) { notificationManager.error(title, msg); },
        info(title, msg) { notificationManager.info(title, msg); },
        show(opts) { notificationManager.show(opts); }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Game Lifecycle (مُحسَّن)
    // ═══════════════════════════════════════════════════════════════════════
    async onGameStart(gameId, options = {}) {
        console.log(`[GameHub] Game started: ${gameId}`);
        
        // تحديث online presence
        await this._updatePresence(gameId, 'playing');
        
        return {
            sessionId: Date.now(),
            startTime: Date.now(),
            gameId,
            options
        };
    },

    async onGameEnd(session, result) {
        console.log(`[GameHub] Game ended: ${session.gameId}`, result);

        const { gameId } = session;
        const duration = Math.floor((Date.now() - session.startTime) / 1000);
        const isWin = result.isWin || false;
        const score = result.score || 0;

        // 1. تسجيل النتيجة في Leaderboard
        await this.leaderboard.submit(gameId, score, {
            isWin,
            duration,
            level: result.level,
            difficulty: result.difficulty || 'normal',
            extra: result.extra || {}
        });

        // 2. تحديث إحصائيات البروفايل
        const xpGained = await this.profile.updateStats({
            gameId,
            score,
            isWin,
            level: result.level
        });

        // 3. التحقق من الإنجازات
        const unlockedAchievements = await this.achievements.checkGameEnd(gameId, {
            score,
            isWin,
            level: result.level,
            difficulty: result.difficulty,
            highestTile: result.highestTile,
            snakeLength: result.snakeLength,
            linesCleared: result.linesCleared,
            timeSeconds: result.timeSeconds
        });

        // 4. عرض إشعارات الإنجازات
        for (const ach of unlockedAchievements) {
            this.notify.achievement(ach);
        }

        // 5. تحديث online presence
        await this._updatePresence(gameId, 'online');

        return {
            score,
            xpGained,
            unlockedAchievements,
            duration
        };
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Online Presence
    // ═══════════════════════════════════════════════════════════════════════
    presence: {
        async init() { return presenceSystem.init(); },
        async setStatus(status, gameId) { return presenceSystem.setStatus(status, gameId); },
        async getUserStatus(userId) { return presenceSystem.getUserStatus(userId); },
        onPresenceChange(cb) { return presenceSystem.onPresenceChange(cb); }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Supabase Raw Access (للحالات المتقدمة)
    // ═══════════════════════════════════════════════════════════════════════
    async getSupabase() { return getSupabase(); },

    // ═══════════════════════════════════════════════════════════════════════
    // Internal
    // ═══════════════════════════════════════════════════════════════════════
    async _updatePresence(gameId, status) {
        const supabase = await getSupabase();
        const userId = authManager.getUserId();
        if (!supabase || !userId) return;

        await supabase
            .from('online_presence')
            .upsert({
                user_id: userId,
                status,
                game_id: status === 'playing' ? gameId : null,
                last_seen_at: new Date().toISOString()
            });
    }
};

// ─── Event Bus بسيط ──────────────────────────────────────────────────────
export const GameHubEvents = {
    listeners: {},

    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
        return () => this.off(event, callback);
    },

    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    },

    emit(event, data) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(cb => {
            try { cb(data); } catch (e) { console.error(e); }
        });
    }
};

// ─── تهيئة سريعة ─────────────────────────────────────────────────────────
export async function initGameHub() {
    await authManager.init();
    await profileManager.loadProfile();
    await achievementsManager.init();
    await presenceSystem.init();
    
    // إشعارات
    achievementsManager.onAchievementUnlocked((achievement) => {
        notificationManager.achievement(achievement);
    });

    profileManager.onProfileChange((event, data) => {
        if (event === 'levelUp') {
            notificationManager.levelUp(data.oldLevel, data.newLevel);
        }
    });

    console.log('[GameHub] Initialized successfully');
}

export default GameHubAPI;
