/**
 * foundation/auth.js
 * نظام المصادقة - تسجيل الدخول بـ GitHub + وضع الضيف
 */

import { getSupabase } from './supabase-config.js';

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isGuest = false;
        this.guestId = null;
        this.listeners = [];
        this.initialized = false;
    }

    // ─── تهيئة ────────────────────────────────────────────────────────────
    async init() {
        if (this.initialized) return;
        
        const supabase = await getSupabase();
        if (!supabase) {
            console.warn('[Auth] Supabase not available, using offline mode');
            this._loadGuestFromStorage();
            return;
        }

        // التحقق من وجود جلسة نشطة
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            this.currentUser = session.user;
            this.isGuest = false;
            console.log('[Auth] Session restored:', session.user.email || session.user.id);
        } else {
            // لا توجد جلسة مسجّلة — تحقق من وجود جلسة ضيف محفوظة أو سجل كضيف جديد
            this._loadGuestFromStorage();
            // Auto sign-in as guest if no session at all
            if (!this.isGuest) {
                await this.signInAsGuest();
            }
        }

        // الاستماع لتغييرات الجلسة
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                this.currentUser = session.user;
                this.isGuest = false;
                this.guestId = null;
                this._notifyListeners('login', this.currentUser);
            } else if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                this.isGuest = false;
                this._notifyListeners('logout', null);
            }
        });

        this.initialized = true;
    }

    // ─── تسجيل الدخول بـ GitHub ──────────────────────────────────────────
    async signInWithGitHub() {
        const supabase = await getSupabase();
        if (!supabase) {
            console.error('[Auth] Supabase not available');
            return { error: { message: 'Supabase not configured' } };
        }

        const redirectTo = new URL('../auth/callback.html', import.meta.url).href;

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                redirectTo,
                scopes: 'read:user user:email'
            }
        });

        if (error) {
            console.error('[Auth] GitHub sign-in error:', error);
        }

        return { data, error };
    }

    // ─── Alias مؤقت للتوافق الخلفي ───────────────────────────────────────
    async signInWithGoogle() {
        return this.signInWithGitHub();
    }

    // ─── وضع الضيف ────────────────────────────────────────────────────────
    async signInAsGuest(guestName = null) {
        this.isGuest = true;
        this.guestId = this._getOrCreateGuestId();
        
        const guestProfile = {
            id: this.guestId,
            username: guestName || `ضيف_${Math.floor(Math.random() * 9999)}`,
            display_name: guestName || 'ضيف',
            avatar_url: `https://www.gravatar.com/avatar/${this._hashString(this.guestId)}?d=identicon&s=200`,
            xp: parseInt(localStorage.getItem('guest_xp') || '0'),
            level: parseInt(localStorage.getItem('guest_level') || '1'),
            games_played: parseInt(localStorage.getItem('guest_games_played') || '0'),
            total_score: parseInt(localStorage.getItem('guest_total_score') || '0'),
            wins: parseInt(localStorage.getItem('guest_wins') || '0'),
            losses: parseInt(localStorage.getItem('guest_losses') || '0'),
            rank_title: this._calculateRankTitle(parseInt(localStorage.getItem('guest_level') || '1'))
        };

        this._notifyListeners('login', { ...guestProfile, isGuest: true });
        return { user: guestProfile, error: null };
    }

    // ─── تسجيل الخروج ─────────────────────────────────────────────────────
    async signOut() {
        const supabase = await getSupabase();
        if (supabase && this.currentUser && !this.isGuest) {
            await supabase.auth.signOut();
        }
        
        this.currentUser = null;
        this.isGuest = false;
        this._notifyListeners('logout', null);
    }

    // ─── الحصول على المستخدم الحالي ──────────────────────────────────────
    getUser() {
        if (this.isGuest) {
            return this._getGuestProfile();
        }
        return this.currentUser;
    }

    getUserId() {
        if (this.isGuest) return this.guestId;
        return this.currentUser?.id || null;
    }

    isAuthenticated() {
        return this.currentUser !== null || this.isGuest;
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    // ─── الحصول على JWT Token (للـ Chess Server) ─────────────────────────
    async getJWT() {
        if (this.isGuest) return null;
        const supabase = await getSupabase();
        if (!supabase) return null;
        const { data } = await supabase.auth.getSession();
        return data?.session?.access_token || null;
    }

    // ─── Event Listeners ──────────────────────────────────────────────────
    onAuthChange(callback) {
        this.listeners.push(callback);
        // إشعار فوري بالحالة الحالية
        if (this.currentUser || this.isGuest) {
            callback(this.currentUser ? 'login' : 'guest', this.getUser());
        }
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    _notifyListeners(event, data) {
        this.listeners.forEach(cb => {
            try { cb(event, data); } catch (e) { console.error(e); }
        });
    }

    // ─── Helper Functions ─────────────────────────────────────────────────
    _getOrCreateGuestId() {
        let id = localStorage.getItem('guest_id');
        if (!id) {
            id = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('guest_id', id);
        }
        return id;
    }

    _getGuestProfile() {
        return {
            id: this.guestId,
            username: localStorage.getItem('guest_username') || `ضيف`,
            display_name: localStorage.getItem('guest_display_name') || 'ضيف',
            avatar_url: `https://www.gravatar.com/avatar/${this._hashString(this.guestId)}?d=identicon&s=200`,
            xp: parseInt(localStorage.getItem('guest_xp') || '0'),
            level: parseInt(localStorage.getItem('guest_level') || '1'),
            games_played: parseInt(localStorage.getItem('guest_games_played') || '0'),
            total_score: parseInt(localStorage.getItem('guest_total_score') || '0'),
            wins: parseInt(localStorage.getItem('guest_wins') || '0'),
            losses: parseInt(localStorage.getItem('guest_losses') || '0'),
            isGuest: true
        };
    }

    _loadGuestFromStorage() {
        const guestId = localStorage.getItem('guest_id');
        if (guestId) {
            this.guestId = guestId;
            this.isGuest = true;
        }
    }

    _hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    _calculateRankTitle(level) {
        if (level >= 50) return 'أسطورة';
        if (level >= 40) return 'بطل';
        if (level >= 30) return 'محترف';
        if (level >= 20) return 'متقدم';
        if (level >= 10) return 'ممارس';
        if (level >= 5) return 'هاوي';
        return 'مبتدئ';
    }
}

export const authManager = new AuthManager();
export default authManager;
