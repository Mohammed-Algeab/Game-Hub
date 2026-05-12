/**
 * foundation/profile-system.js
 * نظام إدارة البروفايل - الملف الشخصي والمستوى والـ XP
 */

import { getSupabase } from './supabase-config.js';
import { authManager } from './auth.js';

class ProfileManager {
    constructor() {
        this.profile = null;
        this.listeners = [];
    }

    // ─── تحميل البروفايل ──────────────────────────────────────────────────
    async loadProfile() {
        const user = authManager.getUser();
        if (!user) {
            this.profile = null;
            return null;
        }

        // وضع الضيف - بيانات محلية
        if (authManager.isGuest) {
            this.profile = { ...user, isGuest: true };
            return this.profile;
        }

        // مستخدم مسجل - تحميل من Supabase
        const supabase = await getSupabase();
        if (!supabase) {
            // Fallback للبيانات المحلية
            this.profile = this._loadLocalProfile(user.id) || await this._createDefaultProfile(user);
            return this.profile;
        }

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('[Profile] Error loading profile:', error);
                this.profile = await this._createDefaultProfile(user);
            } else if (data) {
                this.profile = { ...data, isGuest: false };

                // Bug 7+9 Fix: حدّث gravatar_hash إذا كان فارغاً
                if (!data.gravatar_hash) {
                    const email = this._getUserEmail(authManager.currentUser);
                    if (email) {
                        const hash = this._md5(email.toLowerCase().trim());
                        const avatarUrl = `https://www.gravatar.com/avatar/${hash}?d=identicon&s=200`;
                        supabase.from('profiles').update({ gravatar_hash: hash, avatar_url: avatarUrl })
                            .eq('id', user.id).then(() => {});
                        this.profile.gravatar_hash = hash;
                        this.profile.avatar_url = avatarUrl;
                    }
                }
            } else {
                // إنشاء بروفايل جديد
                this.profile = await this._createDefaultProfile(user);
                await this._saveProfileToSupabase();
            }
        } catch (err) {
            console.error('[Profile] Exception:', err);
            this.profile = await this._createDefaultProfile(user);
        }

        this._notifyListeners('loaded', this.profile);
        return this.profile;
    }

    // ─── الحصول على البروفايل الحالي ──────────────────────────────────────
    getProfile() {
        return this.profile;
    }

    // ─── تحديث البروفايل ──────────────────────────────────────────────────
    async updateProfile(updates) {
        if (!this.profile) return { error: 'No profile loaded' };

        const userId = authManager.getUserId();
        if (!userId) return { error: 'Not authenticated' };

        // تحديث محلياً أولاً
        this.profile = { ...this.profile, ...updates };
        this._notifyListeners('updated', this.profile);

        // وضع الضيف - حفظ في localStorage
        if (authManager.isGuest) {
            this._saveGuestProfile();
            return { error: null };
        }

        // مستخدم مسجل - حفظ في Supabase
        const supabase = await getSupabase();
        if (!supabase) {
            this._saveLocalProfile(userId, this.profile);
            return { error: null };
        }

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId);

        if (error) {
            console.error('[Profile] Update error:', error);
            this._saveLocalProfile(userId, this.profile);
        }

        return { error };
    }

    // ─── إضافة XP ─────────────────────────────────────────────────────────
    async addXP(amount) {
        if (!this.profile) return;
        
        const newXP = (this.profile.xp || 0) + amount;
        const newLevel = this._calculateLevel(newXP);
        const oldLevel = this.profile.level || 1;

        await this.updateProfile({
            xp: newXP,
            level: newLevel,
            last_online: new Date().toISOString()
        });

        // إشعار عند ترقية المستوى
        if (newLevel > oldLevel) {
            this._notifyListeners('levelUp', { oldLevel, newLevel, xp: newXP });
        }
    }

    // ─── تحديث الإحصائيات ─────────────────────────────────────────────────
    async updateStats(gameResult) {
        if (!this.profile) return;

        const updates = {
            games_played: (this.profile.games_played || 0) + 1,
            total_score: (this.profile.total_score || 0) + (gameResult.score || 0),
            last_online: new Date().toISOString()
        };

        if (gameResult.isWin) {
            updates.wins = (this.profile.wins || 0) + 1;
        } else if (gameResult.gameId === 'chess') {
            updates.losses = (this.profile.losses || 0) + 1;
        }

        // إضافة XP حسب النتيجة
        const xpGained = this._calculateGameXP(gameResult);
        updates.xp = (this.profile.xp || 0) + xpGained;
        updates.level = this._calculateLevel(updates.xp);

        await this.updateProfile(updates);
        return xpGained;
    }

    // ─── Event Listeners ──────────────────────────────────────────────────
    onProfileChange(callback) {
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

    // ─── Helper Functions ─────────────────────────────────────────────────
    async _createDefaultProfile(user) {
        const email = this._getUserEmail(user);
        // Bug 7 Fix: Gravatar يتطلب MD5 وليس SHA-256
        const gravatarHash = email ? this._md5(email.toLowerCase().trim()) : null;
        const avatar_url = gravatarHash
            ? `https://www.gravatar.com/avatar/${gravatarHash}?d=identicon&s=200`
            : (user.user_metadata?.avatar_url || `https://www.gravatar.com/avatar/00000000?d=identicon&s=200`);

        return {
            id:           user.id,
            username:     user.user_metadata?.user_name || user.user_metadata?.preferred_username || (email ? email.split('@')[0] : 'لاعب'),
            display_name: user.user_metadata?.name || user.user_metadata?.full_name || (email ? email.split('@')[0] : 'لاعب'),
            avatar_url,
            gravatar_hash: gravatarHash,
            xp:           0,
            level:        1,
            games_played: 0,
            total_score:  0,
            wins:         0,
            losses:       0,
            rank_title:   'مبتدئ',
            isGuest:      authManager.isGuest
        };
    }

    // ─── MD5 (مطلوب لـ Gravatar) ──────────────────────────────────────────
    _md5(str) {
        // تطبيق MD5 بسيط في المتصفح
        function safeAdd(x, y) { const lsw=(x&0xFFFF)+(y&0xFFFF); const msw=(x>>16)+(y>>16)+(lsw>>16); return (msw<<16)|(lsw&0xFFFF); }
        function bitRotateLeft(num, cnt) { return (num<<cnt)|(num>>>(32-cnt)); }
        function md5cmn(q,a,b,x,s,t) { return safeAdd(bitRotateLeft(safeAdd(safeAdd(a,q),safeAdd(x,t)),s),b); }
        function md5ff(a,b,c,d,x,s,t){return md5cmn((b&c)|((~b)&d),a,b,x,s,t);}
        function md5gg(a,b,c,d,x,s,t){return md5cmn((b&d)|(c&(~d)),a,b,x,s,t);}
        function md5hh(a,b,c,d,x,s,t){return md5cmn(b^c^d,a,b,x,s,t);}
        function md5ii(a,b,c,d,x,s,t){return md5cmn(c^(b|(~d)),a,b,x,s,t);}
        function utf8Encode(s){return unescape(encodeURIComponent(s));}
        function str2binl(s){const b=[];for(let i=0;i<s.length*8;i+=8)b[i>>5]|=(s.charCodeAt(i/8)&0xFF)<<(i%32);return b;}
        function binl2hex(b){let h='';const hex='0123456789abcdef';for(let i=0;i<b.length*4;i++)h+=hex[(b[i>>2]>>((i%4)*8+4))&0xF]+hex[(b[i>>2]>>((i%4)*8))&0xF];return h;}
        function binlMD5(x,len){
            x[len>>5]|=0x80<<(len%32);x[(((len+64)>>>9)<<4)+14]=len;
            let a=1732584193,b=-271733879,c=-1732584194,d=271733878;
            for(let i=0;i<x.length;i+=16){
                const oa=a,ob=b,oc=c,od=d;
                a=md5ff(a,b,c,d,x[i],7,-680876936);d=md5ff(d,a,b,c,x[i+1],12,-389564586);c=md5ff(c,d,a,b,x[i+2],17,606105819);b=md5ff(b,c,d,a,x[i+3],22,-1044525330);
                a=md5ff(a,b,c,d,x[i+4],7,-176418897);d=md5ff(d,a,b,c,x[i+5],12,1200080426);c=md5ff(c,d,a,b,x[i+6],17,-1473231341);b=md5ff(b,c,d,a,x[i+7],22,-45705983);
                a=md5ff(a,b,c,d,x[i+8],7,1770035416);d=md5ff(d,a,b,c,x[i+9],12,-1958414417);c=md5ff(c,d,a,b,x[i+10],17,-42063);b=md5ff(b,c,d,a,x[i+11],22,-1990404162);
                a=md5ff(a,b,c,d,x[i+12],7,1804603682);d=md5ff(d,a,b,c,x[i+13],12,-40341101);c=md5ff(c,d,a,b,x[i+14],17,-1502002290);b=md5ff(b,c,d,a,x[i+15],22,1236535329);
                a=md5gg(a,b,c,d,x[i+1],5,-165796510);d=md5gg(d,a,b,c,x[i+6],9,-1069501632);c=md5gg(c,d,a,b,x[i+11],14,643717713);b=md5gg(b,c,d,a,x[i],20,-373897302);
                a=md5gg(a,b,c,d,x[i+5],5,-701558691);d=md5gg(d,a,b,c,x[i+10],9,38016083);c=md5gg(c,d,a,b,x[i+15],14,-660478335);b=md5gg(b,c,d,a,x[i+4],20,-405537848);
                a=md5gg(a,b,c,d,x[i+9],5,568446438);d=md5gg(d,a,b,c,x[i+14],9,-1019803690);c=md5gg(c,d,a,b,x[i+3],14,-187363961);b=md5gg(b,c,d,a,x[i+8],20,1163531501);
                a=md5gg(a,b,c,d,x[i+13],5,-1444681467);d=md5gg(d,a,b,c,x[i+2],9,-51403784);c=md5gg(c,d,a,b,x[i+7],14,1735328473);b=md5gg(b,c,d,a,x[i+12],20,-1926607734);
                a=md5hh(a,b,c,d,x[i+5],4,-378558);d=md5hh(d,a,b,c,x[i+8],11,-2022574463);c=md5hh(c,d,a,b,x[i+11],16,1839030562);b=md5hh(b,c,d,a,x[i+14],23,-35309556);
                a=md5hh(a,b,c,d,x[i+1],4,-1530992060);d=md5hh(d,a,b,c,x[i+4],11,1272893353);c=md5hh(c,d,a,b,x[i+7],16,-155497632);b=md5hh(b,c,d,a,x[i+10],23,-1094730640);
                a=md5hh(a,b,c,d,x[i+13],4,681279174);d=md5hh(d,a,b,c,x[i],11,-358537222);c=md5hh(c,d,a,b,x[i+3],16,-722521979);b=md5hh(b,c,d,a,x[i+6],23,76029189);
                a=md5hh(a,b,c,d,x[i+9],4,-640364487);d=md5hh(d,a,b,c,x[i+12],11,-421815835);c=md5hh(c,d,a,b,x[i+15],16,530742520);b=md5hh(b,c,d,a,x[i+2],23,-995338651);
                a=md5ii(a,b,c,d,x[i],6,-198630844);d=md5ii(d,a,b,c,x[i+7],10,1126891415);c=md5ii(c,d,a,b,x[i+14],15,-1416354905);b=md5ii(b,c,d,a,x[i+5],21,-57434055);
                a=md5ii(a,b,c,d,x[i+12],6,1700485571);d=md5ii(d,a,b,c,x[i+3],10,-1894986606);c=md5ii(c,d,a,b,x[i+10],15,-1051523);b=md5ii(b,c,d,a,x[i+1],21,-2054922799);
                a=md5ii(a,b,c,d,x[i+8],6,1873313359);d=md5ii(d,a,b,c,x[i+15],10,-30611744);c=md5ii(c,d,a,b,x[i+6],15,-1560198380);b=md5ii(b,c,d,a,x[i+13],21,1309151649);
                a=md5ii(a,b,c,d,x[i+4],6,-145523070);d=md5ii(d,a,b,c,x[i+11],10,-1120210379);c=md5ii(c,d,a,b,x[i+2],15,718787259);b=md5ii(b,c,d,a,x[i+9],21,-343485551);
                a=safeAdd(a,oa);b=safeAdd(b,ob);c=safeAdd(c,oc);d=safeAdd(d,od);
            }
            return [a,b,c,d];
        }
        const s = utf8Encode(str);
        return binl2hex(binlMD5(str2binl(s), s.length*8));
    }

    _getUserEmail(user) {
        return user?.email
            || user?.user_metadata?.email
            || user?.user_metadata?.preferred_email
            || user?.identities?.[0]?.identity_data?.email
            || '';
    }

    _calculateLevel(xp) {
        return Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
    }

    _calculateGameXP(result) {
        let xp = Math.floor(result.score / 100) || 5; // نقاط أساسية
        if (result.isWin) xp += 10;
        if (result.level && result.level > 1) xp += result.level * 2;
        return xp;
    }

    _saveLocalProfile(userId, profile) {
        try {
            localStorage.setItem(`gh_profile_${userId}`, JSON.stringify(profile));
        } catch (e) {}
    }

    _loadLocalProfile(userId) {
        try {
            const data = localStorage.getItem(`gh_profile_${userId}`);
            return data ? JSON.parse(data) : null;
        } catch (e) { return null; }
    }

    _saveGuestProfile() {
        if (!this.profile) return;
        localStorage.setItem('guest_xp', this.profile.xp || 0);
        localStorage.setItem('guest_level', this.profile.level || 1);
        localStorage.setItem('guest_games_played', this.profile.games_played || 0);
        localStorage.setItem('guest_total_score', this.profile.total_score || 0);
        localStorage.setItem('guest_wins', this.profile.wins || 0);
        localStorage.setItem('guest_losses', this.profile.losses || 0);
        localStorage.setItem('guest_username', this.profile.username || 'ضيف');
        localStorage.setItem('guest_display_name', this.profile.display_name || 'ضيف');
    }

    async _saveProfileToSupabase() {
        const supabase = await getSupabase();
        if (!supabase || !this.profile) return;

        // Bug 8 Fix: فقط الأعمدة الموجودة في الـ schema
        const { error } = await supabase
            .from('profiles')
            .upsert({
                id:           this.profile.id,
                username:     this.profile.username,
                display_name: this.profile.display_name,
                avatar_url:   this.profile.avatar_url,
                gravatar_hash: this.profile.gravatar_hash || null,
                xp:           this.profile.xp || 0,
                level:        this.profile.level || 1,
                games_played: this.profile.games_played || 0,
                total_score:  this.profile.total_score || 0,
                wins:         this.profile.wins || 0,
                losses:       this.profile.losses || 0
            });

        if (error) console.error('[Profile] Save error:', error);
    }
}

export const profileManager = new ProfileManager();
export default profileManager;
