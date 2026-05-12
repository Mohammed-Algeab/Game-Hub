/**
 * foundation/achievements-system.js
 * نظام الإنجازات المركزي - تعريفات + تتبع + إشعارات
 */

import { getSupabase } from './supabase-config.js';
import { authManager } from './auth.js';
import { profileManager } from './profile-system.js';

class AchievementsManager {
    constructor() {
        this.achievements = new Map();
        this.userAchievements = new Map();
        this.listeners = [];
        this.initialized = false;
    }

    // ─── تهيئة ────────────────────────────────────────────────────────────
    async init() {
        if (this.initialized) return;
        await this.loadAchievementDefinitions();
        await this.loadUserAchievements();
        this.initialized = true;
    }

    // ─── تحميل تعريفات الإنجازات ──────────────────────────────────────────
    async loadAchievementDefinitions() {
        const supabase = await getSupabase();
        
        if (supabase) {
            const { data, error } = await supabase
                .from('achievements')
                .select('*')
                .order('display_order', { ascending: true });

            if (!error && data && data.length > 0) {
                data.forEach(a => this.achievements.set(a.id, a));
                return;
            }
        }

        // Fallback: تحميل من ملف JSON محلي
        await this._loadLocalAchievements();
    }

    // ─── تحميل إنجازات المستخدم ───────────────────────────────────────────
    async loadUserAchievements() {
        const userId = authManager.getUserId();
        if (!userId) return;

        // وضع الضيف - تحميل من localStorage
        if (authManager.isGuest) {
            this._loadGuestAchievements();
            return;
        }

        const supabase = await getSupabase();
        if (!supabase) {
            this._loadGuestAchievements();
            return;
        }

        const { data, error } = await supabase
            .from('user_achievements')
            .select('*')
            .eq('user_id', userId);

        if (!error && data) {
            data.forEach(ua => this.userAchievements.set(ua.achievement_id, ua));
        }
    }

    // ─── الحصول على إنجازات لعبة معينة ────────────────────────────────────
    getGameAchievements(gameId) {
        return Array.from(this.achievements.values())
            .filter(a => a.game_id === gameId);
    }

    // ─── الحصول على إنجازات المستخدم ──────────────────────────────────────
    getUserAchievement(achievementId) {
        return this.userAchievements.get(achievementId) || {
            achievement_id: achievementId,
            progress: 0,
            unlocked_at: null,
            notified: false
        };
    }

    // ─── تحديث التقدم ─────────────────────────────────────────────────────
    async updateProgress(gameId, conditionType, currentValue, extra = {}) {
        const gameAchievements = this.getGameAchievements(gameId);
        const unlocked = [];

        for (const achievement of gameAchievements) {
            if (achievement.condition_type !== conditionType) continue;

            // التحقق من الشروط الإضافية (مثل difficulty)
            if (achievement.condition_extra && Object.keys(achievement.condition_extra).length > 0) {
                const extraMatch = Object.entries(achievement.condition_extra)
                    .every(([key, val]) => extra[key] === val);
                if (!extraMatch) continue;
            }

            const userAch = this.getUserAchievement(achievement.id);
            if (userAch.unlocked_at) continue; // مفعّل مسبقاً

            const newProgress = Math.max(userAch.progress || 0, currentValue);

            // Bug 4 Fix: إنجازات الوقت معكوسة (أقل = أفضل)
            const conditionMet = (conditionType === 'time_seconds')
                ? currentValue > 0 && currentValue <= achievement.condition_value
                : newProgress >= achievement.condition_value;

            if (conditionMet) {
                await this._unlockAchievement(achievement, newProgress);
                unlocked.push(achievement);
            } else {
                await this._updateProgressOnly(achievement.id, newProgress);
            }
        }

        return unlocked;
    }

    // ─── تفعيل إنجاز مباشرة ───────────────────────────────────────────────
    async unlockAchievement(achievementId) {
        const achievement = this.achievements.get(achievementId);
        if (!achievement) return null;

        const userAch = this.getUserAchievement(achievementId);
        if (userAch.unlocked_at) return null;

        await this._unlockAchievement(achievement, achievement.condition_value);
        return achievement;
    }

    // ─── تسجيل نتيجة لعبة والتحقق من الإنجازات ──────────────────────────────
    async checkGameEnd(gameId, result) {
        const unlocked = [];

        // Fix: games_played — تتبع عدد مرات اللعب لكل لعبة
        const gpKey = `gh_games_played_${gameId}`;
        const totalGamesPlayed = (parseInt(localStorage.getItem(gpKey) || '0')) + 1;
        localStorage.setItem(gpKey, totalGamesPlayed);
        const gpUnlocked = await this.updateProgress(gameId, 'games_played', totalGamesPlayed);
        unlocked.push(...gpUnlocked);

        // تحقق: score
        if (result.score) {
            const scoreUnlocked = await this.updateProgress(gameId, 'score', result.score);
            unlocked.push(...scoreUnlocked);
        }

        if (result.isWin) {
            // Bug 3 Fix: تتبع الفوز التراكمي بشكل مستقل لكل لعبة
            const winKey = `gh_wins_${gameId}`;
            const totalWins = (parseInt(localStorage.getItem(winKey) || '0')) + 1;
            localStorage.setItem(winKey, totalWins);

            const winsUnlocked = await this.updateProgress(gameId, 'wins', totalWins);
            unlocked.push(...winsUnlocked);

            // wins_by_difficulty
            if (result.difficulty) {
                const diffKey = `gh_wins_${gameId}_${result.difficulty}`;
                const totalDiffWins = (parseInt(localStorage.getItem(diffKey) || '0')) + 1;
                localStorage.setItem(diffKey, totalDiffWins);

                const diffWins = await this.updateProgress(gameId, 'wins_by_difficulty',
                    totalDiffWins, { difficulty: result.difficulty });
                unlocked.push(...diffWins);
            }
        }

        // تحقق: level
        if (result.level) {
            const levelUnlocked = await this.updateProgress(gameId, 'level', result.level);
            unlocked.push(...levelUnlocked);
        }

        // تحقق: highest_tile (لـ 2048)
        if (result.highestTile) {
            const tileUnlocked = await this.updateProgress(gameId, 'highest_tile', result.highestTile);
            unlocked.push(...tileUnlocked);
        }

        // تحقق: snake_length (لـ Snake)
        if (result.snakeLength) {
            const lenUnlocked = await this.updateProgress(gameId, 'snake_length', result.snakeLength);
            unlocked.push(...lenUnlocked);
        }

        // تحقق: lines_cleared (لـ Tetris)
        if (result.linesCleared) {
            const linesKey = `gh_lines_${gameId}`;
            const totalLines = (parseInt(localStorage.getItem(linesKey) || '0')) + result.linesCleared;
            localStorage.setItem(linesKey, totalLines);
            const linesUnlocked = await this.updateProgress(gameId, 'lines_cleared', totalLines);
            unlocked.push(...linesUnlocked);
        }

        // Bug 4 Fix: إنجازات الوقت (أقل = أفضل) — يُمرر timeSeconds مباشرة
        if (result.timeSeconds && result.isWin) {
            const timeUnlocked = await this.updateProgress(gameId, 'time_seconds', result.timeSeconds);
            unlocked.push(...timeUnlocked);
        }

        return unlocked;
    }

    // ─── Event Listeners ──────────────────────────────────────────────────
    onAchievementUnlocked(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    _notifyUnlock(achievement, progress) {
        this.listeners.forEach(cb => {
            try { cb(achievement, progress); } catch (e) { console.error(e); }
        });
    }

    // ─── Internal: تفعيل إنجاز ────────────────────────────────────────────
    async _unlockAchievement(achievement, progress) {
        const userId = authManager.getUserId();
        if (!userId) return;

        const now = new Date().toISOString();

        this.userAchievements.set(achievement.id, {
            user_id: userId,
            achievement_id: achievement.id,
            progress,
            unlocked_at: now,
            notified: false
        });

        // حفظ في Supabase أو localStorage
        if (authManager.isGuest) {
            this._saveGuestAchievement(achievement.id, progress, now);
        } else {
            const supabase = await getSupabase();
            if (supabase) {
                await supabase
                    .from('user_achievements')
                    .upsert({
                        user_id: userId,
                        achievement_id: achievement.id,
                        progress,
                        unlocked_at: now,
                        notified: false
                    });
            } else {
                this._saveGuestAchievement(achievement.id, progress, now);
            }
        }

        // إضافة XP للمستخدم
        if (achievement.xp_reward) {
            await profileManager.addXP(achievement.xp_reward);
        }

        this._notifyUnlock(achievement, progress);
    }

    async _updateProgressOnly(achievementId, progress) {
        const userId = authManager.getUserId();
        if (!userId) return;

        const existing = this.userAchievements.get(achievementId);
        this.userAchievements.set(achievementId, {
            ...existing,
            user_id: userId,
            achievement_id: achievementId,
            progress,
            unlocked_at: existing?.unlocked_at || null
        });

        if (authManager.isGuest) {
            this._saveGuestAchievement(achievementId, progress, null);
        }
    }

    // ─── Local Storage Helpers ────────────────────────────────────────────
    async _loadLocalAchievements() {
        try {
            // المسار الصحيح نسبةً لموقع هذا الملف (foundation/ → ../games/)
            const baseUrl = new URL('../', import.meta.url).href;
            const games = ['chess', 'sudoku', 'tetris', '2048', 'snake'];
            for (const gameId of games) {
                try {
                    const res = await fetch(`${baseUrl}games/${gameId}/achievements.json`);
                    if (res.ok) {
                        const data = await res.json();
                        data.forEach(a => {
                            a.game_id = a.game_id || gameId;
                            this.achievements.set(a.id, a);
                        });
                    }
                } catch (e) {}
            }
        } catch (e) {
            console.warn('[Achievements] Could not load local definitions:', e);
        }
    }

    _loadGuestAchievements() {
        try {
            const data = localStorage.getItem('guest_achievements');
            if (data) {
                const parsed = JSON.parse(data);
                Object.entries(parsed).forEach(([id, ach]) => {
                    this.userAchievements.set(id, ach);
                });
            }
        } catch (e) {}
    }

    _saveGuestAchievement(achievementId, progress, unlockedAt) {
        try {
            const data = JSON.parse(localStorage.getItem('guest_achievements') || '{}');
            data[achievementId] = {
                achievement_id: achievementId,
                progress,
                unlocked_at: unlockedAt,
                notified: false
            };
            localStorage.setItem('guest_achievements', JSON.stringify(data));
        } catch (e) {}
    }

    _getDifficultyWins(gameId, difficulty) {
        const key = `guest_${gameId}_wins_${difficulty}`;
        const val = parseInt(localStorage.getItem(key) || '0');
        return val;
    }

    _getTotalLines(gameId) {
        const key = `guest_${gameId}_total_lines`;
        return parseInt(localStorage.getItem(key) || '0');
    }
}

export const achievementsManager = new AchievementsManager();
export default achievementsManager;
