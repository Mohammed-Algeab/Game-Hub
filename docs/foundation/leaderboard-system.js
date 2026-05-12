/**
 * foundation/leaderboard-system.js
 * نظام لوحة الصدارة العالمية - تسجيل النقاط + عرض الترتيب
 */

import { getSupabase } from './supabase-config.js';
import { authManager } from './auth.js';

class LeaderboardManager {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 دقائق
        this.listeners = [];
    }

    // ─── تسجيل نتيجة ──────────────────────────────────────────────────────
    async submitScore(gameId, score, options = {}) {
        const userId = authManager.getUserId();
        const isRanked = options.isRanked !== false;

        // حفظ في game_sessions (للمستخدمين المسجلين فقط)
        if (userId && !authManager.isGuest) {
            const supabase = await getSupabase();
            if (supabase) {
                await supabase.from('game_sessions').insert({
                    user_id: userId,
                    game_id: gameId,
                    score,
                    level: options.level || 1,
                    duration_seconds: options.duration || 0,
                    is_win: options.isWin || false,
                    is_ranked: isRanked,
                    difficulty: options.difficulty || 'normal',
                    game_specific_data: options.extra || {}
                });

                // تحديث الـ leaderboard
                await this._updateLeaderboardEntry(gameId, userId, score, options);
            }
        }

        // للضيوف - حفظ أفضل نتيجة محلياً
        if (authManager.isGuest) {
            this._saveGuestBestScore(gameId, score, options);
        }

        // تنظيف الكاش
        this._invalidateCache(gameId, options.difficulty);

        return { success: true };
    }

    // ─── الحصول على لوحة الصدارة ──────────────────────────────────────────
    async getLeaderboard(gameId, options = {}) {
        const difficulty = options.difficulty || 'global';
        const limit = options.limit || 50;
        const period = options.period || 'all'; // all, week, today

        const cacheKey = `${gameId}_${difficulty}_${period}_${limit}`;
        const cached = this._getCached(cacheKey);
        if (cached && !options.forceRefresh) return cached;

        const supabase = await getSupabase();
        if (!supabase) {
            return this._getLocalLeaderboard(gameId, difficulty, limit);
        }

        let query = supabase
            .from('leaderboards')
            .select(`
                *,
                profiles:user_id (username, display_name, avatar_url, level)
            `)
            .eq('game_id', gameId)
            .eq('difficulty', difficulty)
            .order('score', { ascending: false })
            .limit(limit);

        const { data, error } = await query;

        if (error) {
            console.error('[Leaderboard] Error:', error);
            return this._getLocalLeaderboard(gameId, difficulty, limit);
        }

        const result = (data || []).map((entry, index) => ({
            rank: index + 1,
            userId: entry.user_id,
            username: entry.profiles?.display_name || entry.profiles?.username || 'لاعب',
            avatarUrl: entry.profiles?.avatar_url || '',
            level: entry.profiles?.level || 1,
            score: entry.score,
            rankPoints: entry.rank_points,
            gamesPlayed: entry.games_played,
            wins: entry.wins,
            bestScore: entry.best_score
        }));

        this._setCache(cacheKey, result);
        return result;
    }

    // ─── الحصول على ترتيب لاعب معين ───────────────────────────────────────
    async getPlayerRank(gameId, userId = null, difficulty = 'global') {
        const targetUserId = userId || authManager.getUserId();
        if (!targetUserId) return null;

        const supabase = await getSupabase();
        if (!supabase) return null;

        const { data, error } = await supabase
            .rpc('get_player_rank', {
                p_game_id: gameId,
                p_user_id: targetUserId,
                p_difficulty: difficulty
            });

        if (error || !data) return null;

        return {
            rank: data.rank,
            score: data.score,
            totalPlayers: data.total_players
        };
    }

    // ─── الحصول على أفضل نتيجة للمستخدم الحالي ─────────────────────────────
    async getPersonalBest(gameId, difficulty = 'global') {
        const userId = authManager.getUserId();
        if (!userId) return 0;

        // وضع الضيف
        if (authManager.isGuest) {
            return parseInt(localStorage.getItem(`guest_best_${gameId}_${difficulty}`) || '0');
        }

        const supabase = await getSupabase();
        if (!supabase) return 0;

        const { data } = await supabase
            .from('leaderboards')
            .select('best_score')
            .eq('game_id', gameId)
            .eq('user_id', userId)
            .eq('difficulty', difficulty)
            .single();

        return data?.best_score || 0;
    }

    // ─── تحديث الإحصائيات (للـ Chess مثلاً) ───────────────────────────────
    async updateStats(gameId, stats) {
        const userId = authManager.getUserId();
        if (!userId || authManager.isGuest) return;

        const supabase = await getSupabase();
        if (!supabase) return;

        const { error } = await supabase
            .from('leaderboards')
            .update({
                wins: stats.wins,
                games_played: stats.gamesPlayed,
                rank_points: stats.rankPoints,
                updated_at: new Date().toISOString()
            })
            .eq('game_id', gameId)
            .eq('user_id', userId);

        if (error) console.error('[Leaderboard] Update stats error:', error);
    }

    // ─── Internal Methods ─────────────────────────────────────────────────
    async _updateLeaderboardEntry(gameId, userId, score, options) {
        const supabase = await getSupabase();
        if (!supabase) return;

        const { error } = await supabase
            .rpc('upsert_leaderboard', {
                p_game_id: gameId,
                p_user_id: userId,
                p_score: score,
                p_difficulty: options.difficulty || 'global',
                p_is_win: options.isWin || false,
                p_level: options.level || 1
            });

        if (error) {
            // Fallback: إدراج/تحديث مباشر
            await supabase.from('leaderboards').upsert({
                game_id: gameId,
                user_id: userId,
                score: score,
                difficulty: options.difficulty || 'global',
                best_score: score,
                last_played_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'game_id,user_id,difficulty' });
        }
    }

    _saveGuestBestScore(gameId, score, options) {
        const diff = options.difficulty || 'global';
        const key = `guest_best_${gameId}_${diff}`;
        const current = parseInt(localStorage.getItem(key) || '0');
        if (score > current) {
            localStorage.setItem(key, score.toString());
        }
    }

    _getLocalLeaderboard(gameId, difficulty, limit) {
        // محاكاة لوحة صدارة من localStorage للضيوف
        return [];
    }

    _invalidateCache(gameId, difficulty) {
        const prefix = `${gameId}_${difficulty || 'global'}`;
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) this.cache.delete(key);
        }
    }

    _getCached(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.cacheExpiry) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    _setCache(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
    }
}

export const leaderboardManager = new LeaderboardManager();
export default leaderboardManager;
