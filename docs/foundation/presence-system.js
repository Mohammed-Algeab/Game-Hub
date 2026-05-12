/**
 * foundation/presence-system.js
 * نظام تتبع حالة الاتصال - Online Presence
 * يستخدم Supabase Realtime لتحديث الحالة في الوقت الفعلي
 */

import { getSupabase } from './supabase-config.js';
import { authManager } from './auth.js';

class PresenceSystem {
    constructor() {
        this.supabase = null;
        this.channel = null;
        this.presenceData = new Map();
        this.listeners = [];
        this.initialized = false;
        this._heartbeatInterval = null;
    }

    // ─── تهيئة ──────────────────────────────────────────────────────────────
    async init() {
        if (this.initialized) return;

        this.supabase = await getSupabase();
        if (!this.supabase) {
            // وضع offline - استخدم localStorage كبديل
            this._initOfflineMode();
            return;
        }

        const userId = authManager.getUserId();
        if (!userId) return;

        // إنشاء قناة realtime
        this.channel = this.supabase.channel('online-users', {
            config: {
                presence: {
                    key: userId
                }
            }
        });

        // الاستماع لتغييرات الحضور
        this.channel
            .on('presence', { event: 'sync' }, () => {
                const state = this.channel.presenceState();
                this._updatePresenceData(state);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                this.presenceData.set(key, newPresences[0]);
                this._notifyListeners('join', { userId: key, presence: newPresences[0] });
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                this.presenceData.delete(key);
                this._notifyListeners('leave', { userId: key });
            });

        await this.channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                // إرسال حالة الاتصال
                await this.setStatus('online');
            }
        });

        // تحديث last_seen في قاعدة البيانات
        await this._updateDatabaseStatus('online');

        // Heartbeat كل دقيقة لتحديث last_seen
        this._heartbeatInterval = setInterval(() => {
            this._updateDatabaseStatus('online');
        }, 60000);

        // تحديث الحالة عند مغادرة الصفحة
        window.addEventListener('beforeunload', () => {
            this.destroy();
        });

        this.initialized = true;
    }

    // ─── تحديث الحالة ──────────────────────────────────────────────────────
    async setStatus(status, gameId = null) {
        const userId = authManager.getUserId();
        if (!userId) return;

        const presenceData = {
            user_id: userId,
            status,
            game_id: gameId,
            last_seen: new Date().toISOString(),
            username: authManager.getUser()?.username || 'لاعب'
        };

        // إرسال عبر Realtime Presence
        if (this.channel) {
            await this.channel.track(presenceData);
        }

        // تحديث قاعدة البيانات
        await this._updateDatabaseStatus(status, gameId);
    }

    // ─── الحصول على حالة مستخدم ────────────────────────────────────────────
    async getUserStatus(userId) {
        if (!this.supabase || !userId) return { status: 'offline', last_seen: null };

        // التحقق من presence المباشر أولاً
        const realtimeStatus = this.presenceData.get(userId);
        if (realtimeStatus) {
            return { status: realtimeStatus.status || 'online', last_seen: realtimeStatus.last_seen };
        }

        // التحقق من قاعدة البيانات
        try {
            const { data, error } = await this.supabase
                .from('online_presence')
                .select('status, last_seen_at')
                .eq('user_id', userId)
                .single();

            if (!error && data) {
                const isOnline = data.status === 'online' && 
                    new Date(data.last_seen_at) > new Date(Date.now() - 5 * 60000);
                return {
                    status: isOnline ? data.status : 'offline',
                    last_seen: data.last_seen_at
                };
            }
        } catch (e) {}

        return { status: 'offline', last_seen: null };
    }

    // ─── تحديث قاعدة البيانات ──────────────────────────────────────────────
    async _updateDatabaseStatus(status, gameId = null) {
        if (!this.supabase) return;

        const userId = authManager.getUserId();
        if (!userId) return;

        await this.supabase
            .from('online_presence')
            .upsert({
                user_id: userId,
                status,
                game_id: gameId,
                last_seen_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
    }

    // ─── تحديث بيانات الحضور ──────────────────────────────────────────────
    _updatePresenceData(state) {
        this.presenceData.clear();
        for (const [key, presences] of Object.entries(state)) {
            if (presences.length > 0) {
                this.presenceData.set(key, presences[0]);
            }
        }
        this._notifyListeners('sync', this.presenceData);
    }

    // ─── وضع Offline ────────────────────────────────────────────────────────
    _initOfflineMode() {
        // في وضع offline، جميع المستخدمين يعتبرون offline
        this.presenceData.clear();
    }

    // ─── Event Listeners ────────────────────────────────────────────────────
    onPresenceChange(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    _notifyListeners(event, data) {
        this.listeners.forEach(cb => {
            try { cb(event, data); } catch (e) { console.error(e); }
        });
    }

    // ─── تنظيف ──────────────────────────────────────────────────────────────
    async destroy() {
        if (this._heartbeatInterval) {
            clearInterval(this._heartbeatInterval);
            this._heartbeatInterval = null;
        }

        // تحديث الحالة إلى offline
        await this._updateDatabaseStatus('offline');

        if (this.channel) {
            await this.channel.unsubscribe();
            this.channel = null;
        }

        this.initialized = false;
    }
}

export const presenceSystem = new PresenceSystem();
export default presenceSystem;
