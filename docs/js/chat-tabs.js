/**
 * chat-tabs.js — Tabbed Chat Widget
 * AI Chat (existing) + Global Chat (Supabase) + Private Chat (Supabase)
 * Does NOT interfere with Chat AI functionality
 */

import { chatGlobalManager, chatPrivateManager } from './chat-system.js';
import { authManager } from '../foundation/auth.js';

export class ChatTabsWidget {
    constructor(aiChatInstance) {
        this.aiChat = aiChatInstance;
        this.currentTab = 'ai';
        this.globalChat = chatGlobalManager;
        this.privateChat = chatPrivateManager;

        this.tabsContainer = null;
        this.globalUI = null;
        this.privateUI = null;
        this.privateListUI = null;
        this.privateChatUI = null;

        this._globalListeners = [];
        this._privateListeners = [];

        this._init();
    }

    async _init() {
        this._injectTabs();
        this._buildGlobalUI();
        this._buildPrivateUI();
        this._bindTabSwitching();
        await this._initGlobalChat();
        await this._initPrivateChat();
        this._syncWithAIChatWindow();
    }

    // ─── Inject Tabs into existing Chat Window ──────────────────────────────

    _injectTabs() {
        const chatWindow = document.getElementById('chat-window');
        if (!chatWindow) return;

        this.tabsContainer = document.createElement('div');
        this.tabsContainer.className = 'chat-tabs';
        this.tabsContainer.innerHTML = `
            <button class="chat-tab active" data-tab="ai" title="AI مساعد">
                <span><span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="12" rx="3"/><path d="M9 9V7a3 3 0 016 0v2"/><circle cx="9" cy="14" r="1.5" fill="currentColor"/><circle cx="15" cy="14" r="1.5" fill="currentColor"/><path d="M9 18h6"/><path d="M12 3v2"/></svg></span></span>
                <span class="chat-tab-label">AI</span>
            </button>
            <button class="chat-tab" data-tab="global" title="الدردشة العامة">
                <span><span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3c-2.5 3-4 5.5-4 9s1.5 6 4 9m0-18c2.5 3 4 5.5 4 9s-1.5 6-4 9"/><path d="M3.6 9h16.8M3.6 15h16.8"/></svg></span></span>
                <span class="chat-tab-label">عامة</span>
                <span class="chat-tab-badge" id="global-badge" style="display:none"></span>
            </button>
            <button class="chat-tab" data-tab="private" title="الدردشة الخاصة">
                <span><span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="3"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></span></span>
                <span class="chat-tab-label">خاصة</span>
                <span class="chat-tab-badge" id="private-badge" style="display:none"></span>
            </button>
        `;

        const header = chatWindow.querySelector('.chat-header');
        if (header && header.nextElementSibling) {
            chatWindow.insertBefore(this.tabsContainer, header.nextElementSibling);
        } else {
            chatWindow.insertBefore(this.tabsContainer, chatWindow.firstChild.nextSibling);
        }
    }

    // ─── Build Global Chat UI ───────────────────────────────────────────────

    _buildGlobalUI() {
        this.globalUI = document.createElement('div');
        this.globalUI.className = 'chat-tab-panel global-panel';
        this.globalUI.style.display = 'none';
        this.globalUI.innerHTML = `
            <div class="chat-auth-warning" id="global-auth-warning" style="display:none">
                <span><span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="3"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></span></span>
                <p>سجل الدخول للمشاركة في الدردشة العامة</p>
            </div>
            <div class="chat-messages global-messages" id="global-messages"></div>
            <div class="chat-input-area global-input-area">
                <textarea class="chat-input" id="global-input" placeholder="اكتب رسالة عامة..." rows="1" maxlength="500"></textarea>
                <button class="chat-send-btn" id="global-send-btn">➤</button>
            </div>
        `;

        const chatWindow = document.getElementById('chat-window');
        const messagesArea = document.getElementById('chat-messages');
        if (chatWindow && messagesArea) {
            chatWindow.insertBefore(this.globalUI, messagesArea);
        }

        document.getElementById('global-send-btn')?.addEventListener('click', () => this._sendGlobalMessage());
        document.getElementById('global-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._sendGlobalMessage(); }
        });
    }

    // ─── Build Private Chat UI ──────────────────────────────────────────────

    _buildPrivateUI() {
        this.privateUI = document.createElement('div');
        this.privateUI.className = 'chat-tab-panel private-panel';
        this.privateUI.style.display = 'none';
        this.privateUI.innerHTML = `
            <div class="chat-auth-warning" id="private-auth-warning" style="display:none">
                <span><span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="3"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></span></span>
                <p>سجل الدخول لاستخدام الدردشة الخاصة</p>
            </div>
            <div class="private-views">
                <div class="private-conversations-view" id="private-conversations-view">
                    <div class="private-header">
                        <h4>المحادثات</h4>
                        <button class="private-new-btn" id="private-new-btn" title="محادثة جديدة">➕</button>
                    </div>
                    <div class="private-conversations-list" id="private-conversations-list">
                        <div class="chat-empty">
                            <div class="chat-empty-icon"><span class="gh-icon gh-icon-2xl"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></span></div>
                            <p>لا توجد محادثات</p>
                            <p style="font-size:0.8rem;margin-top:4px;">ابدأ محادثة جديدة</p>
                        </div>
                    </div>
                </div>
                <div class="private-chat-view" id="private-chat-view" style="display:none">
                    <div class="private-chat-header">
                        <button class="private-back-btn" id="private-back-btn">←</button>
                        <span class="private-chat-title" id="private-chat-title">محادثة</span>
                    </div>
                    <div class="chat-messages private-messages" id="private-messages"></div>
                    <div class="chat-input-area private-input-area">
                        <textarea class="chat-input" id="private-input" placeholder="اكتب رسالة..." rows="1" maxlength="500"></textarea>
                        <button class="chat-send-btn" id="private-send-btn">➤</button>
                    </div>
                </div>
            </div>
        `;

        const chatWindow = document.getElementById('chat-window');
        const messagesArea = document.getElementById('chat-messages');
        if (chatWindow && messagesArea) {
            chatWindow.insertBefore(this.privateUI, messagesArea);
        }

        document.getElementById('private-send-btn')?.addEventListener('click', () => this._sendPrivateMessage());
        document.getElementById('private-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._sendPrivateMessage(); }
        });
        document.getElementById('private-back-btn')?.addEventListener('click', () => this._showConversationsList());
        document.getElementById('private-new-btn')?.addEventListener('click', () => this._showNewConversationPrompt());

        this.privateListUI = document.getElementById('private-conversations-view');
        this.privateChatUI = document.getElementById('private-chat-view');
    }

    // ─── Sync with existing AI Chat window ──────────────────────────────────

    _syncWithAIChatWindow() {
        const observer = new MutationObserver(() => {
            if (this.currentTab !== 'ai') {
                this._switchTab(this.currentTab);
            }
        });
        const chatWindow = document.getElementById('chat-window');
        if (chatWindow) {
            observer.observe(chatWindow, { attributes: true, attributeFilter: ['class'] });
        }
    }

    // ─── Tab Switching ──────────────────────────────────────────────────────

    _bindTabSwitching() {
        this.tabsContainer?.addEventListener('click', (e) => {
            const tabBtn = e.target.closest('.chat-tab');
            if (!tabBtn) return;
            const tab = tabBtn.dataset.tab;
            this._switchTab(tab);
        });
    }

    _switchTab(tab) {
        this.currentTab = tab;

        this.tabsContainer?.querySelectorAll('.chat-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        const aiMessages    = document.getElementById('chat-messages');
        const aiGameActions = document.getElementById('chat-game-actions');
        // Use specific ID to avoid selecting global/private input areas
        const aiInput       = document.getElementById('chat-input-area');
        const clearBtn      = document.getElementById('chat-clear-btn');

        if (aiMessages)    aiMessages.style.display    = tab === 'ai' ? '' : 'none';
        if (aiGameActions) aiGameActions.style.display = tab === 'ai' ? '' : 'none';
        if (aiInput)       aiInput.style.display       = tab === 'ai' ? '' : 'none';
        if (this.globalUI)  this.globalUI.style.display  = tab === 'global'  ? 'flex' : 'none';
        if (this.privateUI) this.privateUI.style.display = tab === 'private' ? 'flex' : 'none';

        // ─── إخفاء زر حذف التاريخ إلا في تبويب AI ──────────────────────
        if (clearBtn) clearBtn.style.display = tab === 'ai' ? '' : 'none';

        // ─── تحديث عنوان النافذة حسب التبويب الحالي ─────────────────────
        const tabMeta = {
            ai:      { title: 'مساعد AI',        status: 'متصل',          avatar: '<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="12" rx="3"/><path d="M9 9V7a3 3 0 016 0v2"/><circle cx="9" cy="14" r="1.5" fill="currentColor"/><circle cx="15" cy="14" r="1.5" fill="currentColor"/><path d="M9 18h6"/><path d="M12 3v2"/></svg></span>' },
            global:  { title: 'الدردشة العامة',   status: '● مباشر',       avatar: '<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3c-2.5 3-4 5.5-4 9s1.5 6 4 9m0-18c2.5 3 4 5.5 4 9s-1.5 6-4 9"/><path d="M3.6 9h16.8M3.6 15h16.8"/></svg></span>' },
            private: { title: 'الرسائل الخاصة',   status: '⊞ محادثاتك',    avatar: '<span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="3"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></span>' }
        };
        const meta = tabMeta[tab] || tabMeta.ai;

        const headerTitle  = document.querySelector('.chat-header-text h3');
        const headerStatus = document.getElementById('chat-status');
        const headerAvatar = document.querySelector('.chat-avatar');

        if (headerTitle)  headerTitle.textContent  = meta.title;
        if (headerStatus) headerStatus.textContent = meta.status;
        if (headerAvatar) headerAvatar.innerHTML = meta.avatar;

        if (tab === 'ai') {
            this.aiChat._updateWindowPosition?.();
        }
    }

    // ─── Global Chat Logic ──────────────────────────────────────────────────

    async _initGlobalChat() {
        // ✅ سجّل الـ listener أولاً قبل init() عشان يستقبل 'loaded'
        this.globalChat.onMessage((event, data) => {
            if (event === 'new_message' || event === 'loaded') {
                this._renderGlobalMessages();
                if (this.currentTab !== 'global') {
                    this._showBadge('global-badge');
                }
            }
            if (event === 'message_deleted') {
                this._renderGlobalMessages();
            }
        });
        await this.globalChat.init();
    }

    _renderGlobalMessages() {
        const container = document.getElementById('global-messages');
        if (!container) return;

        const userId = authManager.getUserId();
        const messages = this.globalChat.messages;

        container.innerHTML = messages.map(msg => {
            const isMe = msg.user_id === userId;
            const time = msg.created_at
                ? new Date(msg.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
                : '';
            const deleteBtn = isMe
                ? `<button class="chat-delete-btn" data-msgid="${msg.id}" data-type="global" title="حذف"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>`
                : '';
            return `
                <div class="chat-message ${isMe ? 'user' : 'ai'} global-msg" data-msgid="${msg.id}">
                    ${!isMe ? `<div class="global-avatar" style="background-image:url('${msg.avatar_url || ''}')">${msg.avatar_url ? '' : (msg.username?.[0] || '?')}</div>` : ''}
                    <div>
                        ${!isMe ? `<div class="global-username">${this._escapeHtml(msg.username || 'unknown')}</div>` : ''}
                        <div class="message-content">${this._formatMessage(msg.message)}</div>
                        <div class="message-time">${time} ${deleteBtn}</div>
                    </div>
                </div>
            `;
        }).join('');

        // ربط أزرار الحذف
        container.querySelectorAll('.chat-delete-btn[data-type="global"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm('حذف هذه الرسالة؟')) return;
                btn.disabled = true;
                const { error } = await this.globalChat.deleteMessage(btn.dataset.msgid);
                if (error) { console.error('[ChatGlobal] Delete error:', error); btn.disabled = false; }
            });
        });

        container.scrollTop = container.scrollHeight;
    }

    async _sendGlobalMessage() {
        const input = document.getElementById('global-input');
        const text = input?.value.trim();
        if (!text) return;

        if (!authManager.isAuthenticated()) {
            this._showAuthWarning('global');
            return;
        }

        input.value = '';
        input.style.height = 'auto';
        const { error } = await this.globalChat.sendMessage(text);
        if (error) {
            this._addGlobalSystemMessage('خطأ في الإرسال: ' + error);
        }
    }

    _addGlobalSystemMessage(text) {
        const container = document.getElementById('global-messages');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'chat-system-msg';
        div.textContent = text;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    _showAuthWarning(type) {
        const el = document.getElementById(`${type}-auth-warning`);
        if (el) {
            el.style.display = 'flex';
            setTimeout(() => { el.style.display = 'none'; }, 3000);
        }
    }

    // ─── Private Chat Logic ─────────────────────────────────────────────────

    async _initPrivateChat() {
        // ✅ سجّل الـ listener أولاً
        this.privateChat.onEvent((event, data) => {
            if (event === 'conversations_loaded') {
                this._renderConversationsList();
            }
            if (event === 'new_private_message') {
                if (this.currentConversationId === data.conversation_id) {
                    this._renderPrivateMessages(this.currentConversationId);
                } else {
                    this._showBadge('private-badge');
                }
                this.privateChat.loadConversations();
            }
            if (event === 'messages_loaded') {
                this._renderPrivateMessages(data.conversationId);
            }
            if (event === 'private_message_deleted') {
                if (this.currentConversationId) {
                    this._renderPrivateMessages(this.currentConversationId);
                }
            }
        });
        await this.privateChat.init();
        this._updateUnreadBadge();
    }

    currentConversationId = null;

    _renderConversationsList() {
        const container = document.getElementById('private-conversations-list');
        if (!container) return;

        const userId = authManager.getUserId();
        const convs = this.privateChat.conversations;

        if (convs.length === 0) {
            container.innerHTML = `
                <div class="chat-empty">
                    <div class="chat-empty-icon"><span class="gh-icon gh-icon-2xl"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></span></div>
                    <p>لا توجد محادثات</p>
                    <p style="font-size:0.8rem;margin-top:4px;">اضغط ➕ لبدء محادثة</p>
                </div>`;
            return;
        }

        container.innerHTML = convs.map(conv => {
            const otherId = conv.participant1_id === userId ? conv.participant2_id : conv.participant1_id;
            const time = conv.last_message_at
                ? new Date(conv.last_message_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
                : '';
            return `
                <div class="private-conv-item" data-convid="${conv.id}" data-other="${otherId}">
                    <div class="private-conv-avatar"><span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></span></div>
                    <div class="private-conv-info">
                        <div class="private-conv-user">${this._escapeHtml(otherId.slice(0, 8))}…</div>
                        <div class="private-conv-preview">${time ? 'آخر رسالة: ' + time : 'لا توجد رسائل'}</div>
                    </div>
                    <div class="private-conv-meta">
                        <span class="private-conv-time">${time}</span>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.private-conv-item').forEach(item => {
            item.addEventListener('click', () => {
                const convId = item.dataset.convid;
                const otherId = item.dataset.other;
                this._openConversation(convId, otherId);
            });
        });
    }

    async _openConversation(convId, otherUserId) {
        this.currentConversationId = convId;
        this.privateListUI.style.display = 'none';
        this.privateChatUI.style.display = 'flex';

        document.getElementById('private-chat-title').textContent = 'محادثة مع ' + otherUserId.slice(0, 8);

        await this.privateChat.loadMessages(convId);
        this.privateChat.subscribeToConversation(convId);
        await this.privateChat.markAsRead(convId);
        this._updateUnreadBadge();
    }

    _showConversationsList() {
        this.currentConversationId = null;
        this.privateListUI.style.display = 'flex';
        this.privateChatUI.style.display = 'none';
    }

    _renderPrivateMessages(conversationId) {
        const container = document.getElementById('private-messages');
        if (!container) return;

        const userId = authManager.getUserId();
        const messages = this.privateChat.messages.get(conversationId) || [];

        container.innerHTML = messages.map(msg => {
            const isMe = msg.sender_id === userId;
            const time = msg.created_at
                ? new Date(msg.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
                : '';
            const status = isMe ? (msg.is_read ? '✓✓' : '✓') : '';
            const deleteBtn = isMe
                ? `<button class="chat-delete-btn" data-msgid="${msg.id}" data-type="private" title="حذف"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>`
                : '';
            return `
                <div class="chat-message ${isMe ? 'user' : 'ai'}" data-msgid="${msg.id}">
                    <div class="message-avatar"><span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></span></div>
                    <div>
                        <div class="message-content">${this._formatMessage(msg.message)}</div>
                        <div class="message-time">${time} ${status} ${deleteBtn}</div>
                    </div>
                </div>
            `;
        }).join('');

        // ربط أزرار الحذف
        container.querySelectorAll('.chat-delete-btn[data-type="private"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm('حذف هذه الرسالة؟')) return;
                btn.disabled = true;
                const { error } = await this.privateChat.deleteMessage(btn.dataset.msgid, conversationId);
                if (error) { console.error('[ChatPrivate] Delete error:', error); btn.disabled = false; }
            });
        });

        container.scrollTop = container.scrollHeight;
    }

    async _sendPrivateMessage() {
        const input = document.getElementById('private-input');
        const text = input?.value.trim();
        if (!text || !this.currentConversationId) return;

        if (!authManager.isAuthenticated()) {
            this._showAuthWarning('private');
            return;
        }

        input.value = '';
        input.style.height = 'auto';
        const { error } = await this.privateChat.sendMessage(this.currentConversationId, text);
        if (error) {
            const container = document.getElementById('private-messages');
            const div = document.createElement('div');
            div.className = 'chat-system-msg';
            div.textContent = 'خطأ: ' + error;
            container?.appendChild(div);
        }
        await this.privateChat.loadMessages(this.currentConversationId);
    }

    _showNewConversationPrompt() {
        const userId = prompt('أدخل معرف المستخدم (UUID):');
        if (!userId || !userId.trim()) return;
        this._createConversation(userId.trim());
    }

    async _createConversation(otherUserId) {
        const { data, error } = await this.privateChat.getOrCreateConversation(otherUserId);
        if (error) {
            alert('خطأ: ' + error);
            return;
        }
        if (data) {
            this._renderConversationsList();
            this._openConversation(data.id, otherUserId);
        }
    }

    async _updateUnreadBadge() {
        const count = await this.privateChat.getUnreadCount();
        const badge = document.getElementById('private-badge');
        if (badge) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    _showBadge(badgeId) {
        const badge = document.getElementById(badgeId);
        if (badge) {
            const current = parseInt(badge.textContent) || 0;
            badge.textContent = current + 1;
            badge.style.display = 'flex';
        }
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    _formatMessage(text) {
        return this._escapeHtml(text)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }
}

let _tabsInstance = null;

export function initChatTabs(aiChatInstance) {
    if (_tabsInstance) return _tabsInstance;
    _tabsInstance = new ChatTabsWidget(aiChatInstance);
    return _tabsInstance;
}

export default ChatTabsWidget;
