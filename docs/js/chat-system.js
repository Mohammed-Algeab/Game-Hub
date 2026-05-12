/**
 * chat-system.js — Global Chat & Private Chat via Supabase Realtime
 * مستقل عن Chat AI — يتصل بـ Supabase فقط
 */

import { getSupabase } from '../foundation/supabase-config.js';
import { authManager } from '../foundation/auth.js';

// ─── Chat Global ──────────────────────────────────────────────────────────

class ChatGlobalManager {
    constructor() {
        this.supabase = null;
        this.channel = null;
        this.messages = [];
        this.listeners = [];
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        this.supabase = await getSupabase();
        if (!this.supabase) {
            console.warn('[ChatGlobal] Supabase not available');
            return;
        }
        await this.loadRecentMessages();
        this._subscribe();
        this.initialized = true;
    }

    async loadRecentMessages(limit = 50) {
        if (!this.supabase) return;
        const { data, error } = await this.supabase
            .from('chat_messages')
            .select(`
                id,
                user_id,
                message,
                created_at,
                profiles:user_id (
                    username,
                    display_name,
                    avatar_url,
                    gravatar_hash
                )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (!error && data) {
            // نُعيد ترتيب الرسائل من الأقدم للأحدث + نُسطّح بيانات البروفايل
            this.messages = data.reverse().map(m => ({
                ...m,
                username:   m.profiles?.display_name || m.profiles?.username || 'لاعب',
                avatar_url: m.profiles?.gravatar_hash
                    ? `https://www.gravatar.com/avatar/${m.profiles.gravatar_hash}?d=identicon&s=40`
                    : (m.profiles?.avatar_url || null)
            }));
            this._notifyListeners('loaded', this.messages);
        } else if (error) {
            console.error('[ChatGlobal] loadRecentMessages error:', error.message);
        }
    }

    async sendMessage(message) {
        if (!this.supabase) return { error: 'Supabase not available' };

        // تأكد أن authManager مهيّأ قبل الإرسال
        if (!authManager.initialized) {
            await authManager.init();
        }

        const user = authManager.getUser();
        const userId = authManager.getUserId();
        if (!userId) return { error: 'Not authenticated' };

        const username = user?.display_name || user?.username || user?.email?.split('@')[0] || 'لاعب';
        const avatar_url = user?.avatar_url || null;

        // فقط الحقول الموجودة في جدول chat_messages
        const payload = {
            user_id: userId,
            message: message.trim().slice(0, 500)
        };

        const { data, error } = await this.supabase
            .from('chat_messages')
            .insert(payload)
            .select(`
                id,
                user_id,
                message,
                created_at,
                profiles:user_id (
                    username,
                    display_name,
                    avatar_url,
                    gravatar_hash
                )
            `)
            .single();

        if (error) return { error: error.message };

        // نُسطّح البروفايل للرسالة المُرجعة
        const flatMsg = data ? {
            ...data,
            username:   data.profiles?.display_name || data.profiles?.username || username,
            avatar_url: data.profiles?.gravatar_hash
                ? `https://www.gravatar.com/avatar/${data.profiles.gravatar_hash}?d=identicon&s=40`
                : (data.profiles?.avatar_url || null)
        } : null;

        return { data: flatMsg };
    }

    _subscribe() {
        if (!this.supabase) return;
        this.channel = this.supabase
            .channel('global-chat')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages'
            }, async (payload) => {
                // نعيد تحميل الرسائل لأن الـ realtime payload لا يحتوي بيانات البروفايل
                await this.loadRecentMessages();
            })
            .subscribe((status) => {
                console.log('[ChatGlobal] Realtime status:', status);
            });
    }

    onMessage(callback) {
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

    destroy() {
        if (this.channel) this.channel.unsubscribe();
        this.channel = null;
        this.initialized = false;
    }
}

// ─── Chat Private ─────────────────────────────────────────────────────────

class ChatPrivateManager {
    constructor() {
        this.supabase = null;
        this.channels = new Map();
        this.conversations = [];
        this.messages = new Map();
        this.listeners = [];
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        this.supabase = await getSupabase();
        if (!this.supabase) {
            console.warn('[ChatPrivate] Supabase not available');
            return;
        }
        await this.loadConversations();
        this.initialized = true;
    }

    async loadConversations() {
        if (!this.supabase) return;
        const userId = authManager.getUserId();
        if (!userId) return;

        const { data, error } = await this.supabase
            .from('conversations')
            .select('*')
            .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
            .order('last_message_at', { ascending: false });

        if (!error && data) {
            this.conversations = data;
            this._notifyListeners('conversations_loaded', this.conversations);
        }
    }

    async getOrCreateConversation(otherUserId) {
        if (!this.supabase) return { error: 'Supabase not available' };
        const userId = authManager.getUserId();
        if (!userId) return { error: 'Not authenticated' };
        if (userId === otherUserId) return { error: 'Cannot chat with yourself' };

        const p1 = userId < otherUserId ? userId : otherUserId;
        const p2 = userId < otherUserId ? otherUserId : userId;

        const { data: existing } = await this.supabase
            .from('conversations')
            .select('*')
            .eq('participant1_id', p1)
            .eq('participant2_id', p2)
            .maybeSingle();

        if (existing) return { data: existing };

        const { data, error } = await this.supabase
            .from('conversations')
            .insert({ participant1_id: p1, participant2_id: p2 })
            .select()
            .single();

        if (error) return { error: error.message };

        await this.loadConversations();
        return { data };
    }

    async loadMessages(conversationId, limit = 50) {
        if (!this.supabase) return;
        const { data, error } = await this.supabase
            .from('private_messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (!error && data) {
            const reversed = data.reverse();
            this.messages.set(conversationId, reversed);
            this._notifyListeners('messages_loaded', { conversationId, messages: reversed });
        }
    }

    async sendMessage(conversationId, message) {
        if (!this.supabase) return { error: 'Supabase not available' };

        // تأكد أن authManager مهيّأ
        if (!authManager.initialized) {
            await authManager.init();
        }

        const userId = authManager.getUserId();
        if (!userId) return { error: 'Not authenticated' };

        const conv = this.conversations.find(c => c.id === conversationId);
        const receiverId = conv
            ? (conv.participant1_id === userId ? conv.participant2_id : conv.participant1_id)
            : null;

        if (!receiverId) return { error: 'Conversation not found' };

        const payload = {
            conversation_id: conversationId,
            sender_id: userId,
            receiver_id: receiverId,
            message: message.trim().slice(0, 500)
        };

        const { data, error } = await this.supabase
            .from('private_messages')
            .insert(payload)
            .select()
            .single();

        if (error) return { error: error.message };
        return { data };
    }

    async markAsRead(conversationId) {
        if (!this.supabase) return;
        const userId = authManager.getUserId();
        if (!userId) return;

        await this.supabase
            .from('private_messages')
            .update({ is_read: true })
            .eq('conversation_id', conversationId)
            .eq('receiver_id', userId)
            .eq('is_read', false);
    }

    async getUnreadCount() {
        if (!this.supabase) return 0;
        const userId = authManager.getUserId();
        if (!userId) return 0;

        const { count, error } = await this.supabase
            .from('private_messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', userId)
            .eq('is_read', false);

        return error ? 0 : (count || 0);
    }

    subscribeToConversation(conversationId) {
        if (!this.supabase || this.channels.has(conversationId)) return;

        const channel = this.supabase
            .channel(`private-chat-${conversationId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'private_messages',
                filter: `conversation_id=eq.${conversationId}`
            }, (payload) => {
                const msgs = this.messages.get(conversationId) || [];
                msgs.push(payload.new);
                this.messages.set(conversationId, msgs);
                this._notifyListeners('new_private_message', payload.new);
                this.loadConversations();
            })
            .subscribe();

        this.channels.set(conversationId, channel);
    }

    onEvent(callback) {
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

    destroy() {
        this.channels.forEach(ch => ch.unsubscribe());
        this.channels.clear();
        this.initialized = false;
    }
}

export const chatGlobalManager = new ChatGlobalManager();
export const chatPrivateManager = new ChatPrivateManager();
