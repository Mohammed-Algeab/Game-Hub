/**
 * chat.js - AI Chat Widget
 * Desktop: Draggable floating button
 * Mobile: Slide-from-right-edge button
 */

import { AIService } from './ai/service.js';
import { GAMEHUB_CONFIG, getDefaultAIEndpoint } from './app/config.js';
import { profileLocalManager } from './app/profile-local.js';

export class ChatWidget {
    constructor(options = {}) {
        this.profileStore   = options.profileStore   || profileLocalManager;
        this.storageKey     = options.storageKey     || this.profileStore.getScopedKey(GAMEHUB_CONFIG.chatHistoryKeyPrefix);
        this.gameContextKey = options.gameContextKey || this.profileStore.getScopedKey(GAMEHUB_CONFIG.chatContextKeyPrefix);
        this.maxHistory     = options.maxHistory     || GAMEHUB_CONFIG.chatHistoryLimit;

        this.floatBtn        = null;
        this.window          = null;
        this.messagesArea    = null;
        this.input           = null;
        this.typingIndicator = null;
        this.gameActionsBar  = null;

        this.isOpen            = false;
        this.history           = [];
        this.backendEndpoint   = getDefaultAIEndpoint();
        this.aiService         = null;
        this.isTyping          = false;
        this.currentGameContext = null;

        // Drag state (desktop)
        this._drag = { active: false, startX: 0, startY: 0, btnX: 0, btnY: 0, moved: false };

        // Mobile state
        this._isMobile = window.innerWidth <= 767;
        this._mobileRevealed = false;

        this.init();
    }

    init() {
        this.buildUI();
        this.bindEvents();
        this.loadHistory();
        if (this.history.length === 0) this.showBadge('!');
    }

    /* ── UI BUILDER ── */

    buildUI() {
        this.floatBtn = document.createElement('button');
        this.floatBtn.className = 'chat-float-btn';
        this.floatBtn.id = 'chat-float-btn';
        this.floatBtn.setAttribute('aria-label', 'فتح مركز الدردشة');
        this.floatBtn.innerHTML = `
            <span class="chat-icon"><span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9a4 4 0 01-4 4H5l-3 3V5a4 4 0 014-4h5a4 4 0 014 4z"/><path d="M18 21l3-3V12a4 4 0 00-3-3.87" stroke-dasharray="2 2" opacity="0.6"/></svg></span></span>
            <span class="close-icon">✕</span>
            <span class="chat-badge" id="chat-badge"></span>
        `;
        document.body.appendChild(this.floatBtn);

        this.window = document.createElement('div');
        this.window.className = 'chat-window';
        this.window.id = 'chat-window';
        this.window.innerHTML = `
            <div class="chat-header">
                <div class="chat-header-info">
                    <div class="chat-avatar"><span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="12" rx="3"/><path d="M9 9V7a3 3 0 016 0v2"/><circle cx="9" cy="14" r="1.5" fill="currentColor"/><circle cx="15" cy="14" r="1.5" fill="currentColor"/><path d="M9 18h6"/><path d="M12 3v2"/></svg></span></div>
                    <div class="chat-header-text">
                        <h3>مساعد AI</h3>
                        <span id="chat-status">متصل</span>
                    </div>
                </div>
                <div class="chat-header-actions">
                    <button class="chat-header-btn" id="chat-clear-btn" title="حذف التاريخ"><span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></span></button>
                    <button class="chat-header-btn" id="chat-close-btn" title="إغلاق">✕</button>
                </div>
            </div>
            <div class="chat-messages" id="chat-messages">
                <div class="chat-empty" id="chat-empty">
                    <div class="chat-empty-icon"><span class="gh-icon gh-icon-2xl"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="12" rx="3"/><path d="M9 9V7a3 3 0 016 0v2"/><circle cx="9" cy="14" r="1.5" fill="currentColor"/><circle cx="15" cy="14" r="1.5" fill="currentColor"/><path d="M9 18h6"/><path d="M12 3v2"/></svg></span></div>
                    <p>مرحباً! أنا مساعدك الذكي.</p>
                    <p style="font-size:0.85rem;margin-top:8px;">اسألني عن أي لعبة أو اطلب شرح القواعد!</p>
                </div>
            </div>
            <div class="chat-game-actions" id="chat-game-actions" style="display:none;"></div>
            <div class="chat-input-area" id="chat-input-area">
                <textarea class="chat-input" id="chat-input" placeholder="اكتب رسالتك..." rows="1"></textarea>
                <button class="chat-send-btn" id="chat-send-btn">➤</button>
            </div>
        `;
        document.body.appendChild(this.window);

        this.messagesArea  = document.getElementById('chat-messages');
        this.input         = document.getElementById('chat-input');
        this.gameActionsBar = document.getElementById('chat-game-actions');

        // Restore desktop position
        if (!this._isMobile) this._restorePosition();
    }

    /* ── EVENT BINDING ── */

    bindEvents() {
        if (this._isMobile) {
            this._bindMobile();
        } else {
            this._bindDraggable();
        }

        // Chat window close button
        document.getElementById('chat-close-btn').addEventListener('click', () => this.close());

        // Send
        document.getElementById('chat-send-btn').addEventListener('click', () => this.sendMessage());
        this.input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
        });
        this.input.addEventListener('input', () => this.autoResizeInput());

        // Clear
        document.getElementById('chat-clear-btn').addEventListener('click', () => this.clearHistory());

        // Resize: update mobile/desktop state
        window.addEventListener('resize', () => {
            const nowMobile = window.innerWidth <= 767;
            if (nowMobile !== this._isMobile) {
                this._isMobile = nowMobile;
                this._mobileRevealed = false;
                this.floatBtn.classList.remove('mobile-revealed');
            }
            if (!this._isMobile) this._updateWindowPosition();
        });
    }

    /* ── DESKTOP: DRAGGABLE ── */

    _bindDraggable() {
        const btn = this.floatBtn;

        const onPointerDown = (e) => {
            if (e.button !== 0 && e.type === 'mousedown') return;
            this._drag.active = true;
            this._drag.moved  = false;
            this._drag.startX = e.clientX;
            this._drag.startY = e.clientY;
            const rect = btn.getBoundingClientRect();
            this._drag.btnX = rect.left;
            this._drag.btnY = rect.top;
            btn.classList.add('dragging');
            e.preventDefault();
        };

        const onPointerMove = (e) => {
            if (!this._drag.active) return;
            const dx = e.clientX - this._drag.startX;
            const dy = e.clientY - this._drag.startY;
            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) this._drag.moved = true;

            let newX = this._drag.btnX + dx;
            let newY = this._drag.btnY + dy;

            // Clamp to viewport
            const bw = btn.offsetWidth, bh = btn.offsetHeight;
            newX = Math.max(8, Math.min(window.innerWidth  - bw - 8, newX));
            newY = Math.max(8, Math.min(window.innerHeight - bh - 8, newY));

            btn.style.left   = newX + 'px';
            btn.style.bottom = 'auto';
            btn.style.top    = newY + 'px';
            btn.style.right  = 'auto';

            this._updateWindowPosition();
        };

        const onPointerUp = () => {
            if (!this._drag.active) return;
            this._drag.active = false;
            btn.classList.remove('dragging');
            if (!this._drag.moved) {
                this.toggle();
            } else {
                this._savePosition();
            }
        };

        btn.addEventListener('mousedown',  onPointerDown);
        document.addEventListener('mousemove', onPointerMove);
        document.addEventListener('mouseup',   onPointerUp);

        // Touch drag (desktop touch screens)
        btn.addEventListener('touchstart', e => {
            const t = e.touches[0];
            onPointerDown({ button: 0, clientX: t.clientX, clientY: t.clientY, preventDefault: () => e.preventDefault() });
        }, { passive: false });
        document.addEventListener('touchmove', e => {
            if (this._drag.active) {
                const t = e.touches[0];
                onPointerMove({ clientX: t.clientX, clientY: t.clientY });
                e.preventDefault();
            }
        }, { passive: false });
        document.addEventListener('touchend', onPointerUp);
    }

    _savePosition() {
        const rect = this.floatBtn.getBoundingClientRect();
        try {
            localStorage.setItem('chat-btn-pos', JSON.stringify({ x: rect.left, y: rect.top }));
        } catch(_) {}
    }

    _restorePosition() {
        try {
            const saved = JSON.parse(localStorage.getItem('chat-btn-pos') || 'null');
            if (!saved) return;
            const btn = this.floatBtn;
            const bw = 60, bh = 60;
            const x = Math.max(8, Math.min(window.innerWidth  - bw - 8, saved.x));
            const y = Math.max(8, Math.min(window.innerHeight - bh - 8, saved.y));
            btn.style.left   = x + 'px';
            btn.style.top    = y + 'px';
            btn.style.bottom = 'auto';
            btn.style.right  = 'auto';
        } catch(_) {}
    }

    _updateWindowPosition() {
        if (this._isMobile) return;
        const btn = this.floatBtn;
        const win = this.window;
        const bRect = btn.getBoundingClientRect();
        const ww = win.offsetWidth  || 380;
        const wh = win.offsetHeight || 520;
        const gap = 12;

        let left = bRect.left;
        let top  = bRect.top - wh - gap;

        // Keep window inside viewport
        if (left + ww > window.innerWidth - 8)  left = window.innerWidth - ww - 8;
        if (left < 8) left = 8;
        if (top < 8)  top  = bRect.bottom + gap;
        if (top + wh > window.innerHeight - 8) top = window.innerHeight - wh - 8;

        win.style.left   = left + 'px';
        win.style.top    = top  + 'px';
        win.style.bottom = 'auto';
        win.style.right  = 'auto';
    }

    /* ── MOBILE: SLIDE FROM EDGE ── */

    _bindMobile() {
        this.floatBtn.addEventListener('click', () => {
            if (!this._mobileRevealed) {
                // First tap: slide button fully into view
                this._mobileRevealed = true;
                this.floatBtn.classList.add('mobile-revealed');
            } else if (!this.isOpen) {
                // Second tap: open chat
                this.open();
            } else {
                // Chat is open: close everything
                this.close();
                // Slide button back out after short delay
                setTimeout(() => {
                    this._mobileRevealed = false;
                    this.floatBtn.classList.remove('mobile-revealed');
                }, 350);
            }
        });

        // Tap outside to close + retract
        document.addEventListener('click', e => {
            if (this._isMobile && this._mobileRevealed) {
                if (!this.floatBtn.contains(e.target) && !this.window.contains(e.target)) {
                    if (this.isOpen) this.close();
                    setTimeout(() => {
                        this._mobileRevealed = false;
                        this.floatBtn.classList.remove('mobile-revealed');
                    }, this.isOpen ? 350 : 0);
                }
            }
        });
    }

    /* ── TOGGLE / OPEN / CLOSE ── */

    toggle() { this.isOpen ? this.close() : this.open(); }

    open() {
        this.isOpen = true;
        this.window.classList.add('open');
        this.floatBtn.classList.add('active');
        if (!this._isMobile) this._updateWindowPosition();
        this.hideBadge();
        setTimeout(() => this.input.focus(), 300);
        this.scrollToBottom();
    }

    close() {
        this.isOpen = false;
        this.window.classList.remove('open');
        this.floatBtn.classList.remove('active');
    }

    /* ── MESSAGE SYSTEM ── */

    addMessage(role, content, options = {}) {
        const emptyEl = document.getElementById('chat-empty');
        if (emptyEl) emptyEl.remove();

        const msgEl = document.createElement('div');
        msgEl.className = `chat-message ${role}`;

        const time = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

        if (role === 'game-context') {
            msgEl.innerHTML = `
                <div class="game-context-card">
                    <div class="game-context-header"><span class="gh-icon gh-icon-xs" style="margin-inline-end:4px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 12h4m-2-2v4"/><circle cx="16" cy="11" r="1" fill="currentColor"/><circle cx="19" cy="13" r="1" fill="currentColor"/></svg></span>${options.gameName || 'لعبة'} - ${options.actionLabel || 'معلومات'}</div>
                    <div class="game-context-body">${this.escapeHtml(content)}</div>
                </div>
            `;
        } else {
            const userIcon = `<span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></span>`;
            const botIcon = `<span class="gh-icon gh-icon-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="12" rx="3"/><path d="M9 9V7a3 3 0 016 0v2"/><circle cx="9" cy="14" r="1.5" fill="currentColor"/><circle cx="15" cy="14" r="1.5" fill="currentColor"/><path d="M9 18h6"/><path d="M12 3v2"/></svg></span>`;
            const avatar = role === 'user' ? userIcon : botIcon;
            msgEl.innerHTML = `
                <div class="message-avatar">${avatar}</div>
                <div>
                    <div class="message-content">${this.formatMessage(content)}</div>
                    <div class="message-time">${time}</div>
                </div>
            `;
        }

        this.messagesArea.appendChild(msgEl);
        this.scrollToBottom();

        if (!options.noSave) {
            this.history.push({ role, content, time: Date.now(), options });
            this.trimHistory();
            this.saveHistory();
        }

        return msgEl;
    }

    async sendMessage() {
        const text = this.input.value.trim();
        if (!text || this.isTyping) return;
        
        // Don't send AI message if not on AI tab (tabs system is active)
        const chatTabs = document.querySelector('.chat-tabs');
        if (chatTabs) {
            const activeTab = chatTabs.querySelector('.chat-tab.active');
            if (activeTab && activeTab.dataset.tab !== 'ai') return;
        }

        this.addMessage('user', text);
        this.input.value = '';
        this.autoResizeInput();
        this.showTyping();

        try {
            const response   = await this.getAIResponse(text);
            this.hideTyping();
            this.addMessage('ai', response);
        } catch (error) {
            this.hideTyping();
            let errorMsg;
            const status = error.status || 0;

            if (status === 429) {
                const wait = error.retryAfter ? `انتظر ${error.retryAfter} ثانية ثم حاول مجدداً.` : 'حاول بعد قليل.';
                errorMsg = `⏳ تم تجاوز الحد اليومي للذكاء الاصطناعي. ${wait}`;
            } else if (status === 401 || error.message?.includes('API key')) {
                errorMsg = '🔑 مفتاح الـ API غير صحيح، تحقق من إعدادات الـ Worker.';
            } else if (status >= 500) {
                errorMsg = '🔧 خطأ في الـ Worker، حاول لاحقاً.';
            } else if (error.message?.includes('network') || error.name === 'TypeError') {
                errorMsg = '📡 تعذر الاتصال، تحقق من الإنترنت.';
            } else if (error.name === 'AbortError') {
                errorMsg = '⏱ انتهت مهلة الاتصال، حاول مجدداً.';
            } else {
                errorMsg = '⚠️ حدث خطأ غير متوقع، حاول مجدداً.';
            }

            this.addMessage('ai', errorMsg);
        }
    }

    buildPrompt(userMessage) {
        const parts = [];
        if (this.currentGameContext) {
            parts.push(`[لعبة: ${this.currentGameContext.name}]`);
            if (this.currentGameContext.state) {
                parts.push(`[حالة اللعبة]\n${this.currentGameContext.state}`);
            }
        }

        const recent = this.history.filter(m => m.role === 'user' || m.role === 'ai').slice(-5);
        if (recent.length > 0) {
            parts.push(
                '[سياق المحادثة السابقة]\n' +
                recent.map(m => `${m.role === 'user' ? 'المستخدم' : 'المساعد'}: ${m.content}`).join('\n')
            );
        }

        parts.push(`[رسالة المستخدم]\n${userMessage}`);
        return parts.join('\n\n');
    }

    async getAIResponse(userMessage) {
        if (!this.aiService) this.initAIService();

        const recentHistory = this.history
            .filter(m => m.role === 'user' || m.role === 'ai')
            .slice(-GAMEHUB_CONFIG.aiHistoryWindow)
            .map(m => ({
                role: m.role === 'ai' ? 'assistant' : 'user',
                content: m.content
            }));

        const payload = {
            message: userMessage,
            history: recentHistory,
            historyLimit: GAMEHUB_CONFIG.aiHistoryWindow,
            profileId: this.profileStore?.getProfileId?.() || 'local',
            gameContext: this.currentGameContext
                ? {
                    name: this.currentGameContext.name,
                    state: this.currentGameContext.state || ''
                }
                : null
        };

        const endpoint = this.backendEndpoint || getDefaultAIEndpoint();
        this.aiService.setEndpoint(endpoint || null);

        if (!this.aiService.endpoint) {
            return this.getOfflineResponse();
        }

        try {
            return await this.aiService.sendMessage(payload);
        } catch (error) {
            if (!this.aiService.endpoint) {
                return this.getOfflineResponse();
            }
            throw error;
        }
    }

    getOfflineResponse() {
        return "مرحباً! أنا مساعد Game Hub.\n\nهذا الشات يعمل عبر Cloudflare Worker backend، لذلك يحتاج رابط الـ backend في الإعدادات.\nالتاريخ محفوظ محلياً على هذا الجهاز وفق الملف الشخصي المحلي.";
    }

    initAIService() {
        this.aiService = new AIService({
            mode: 'worker',
            endpoint: this.backendEndpoint || getDefaultAIEndpoint() || null,
            apiProvider: 'gemini',
            systemPrompt: 'أنت مساعد Game Hub الذكي، إضافة مدمجة في منصة ألعاب تضم شطرنج، سودوكو، تيتريس والمزيد، شخصيتك ودودة وعفوية تحس إنك تحاور صديق يحب الألعاب، خفيف الظل ما تخاف تمزح أو تتفاعل بحماس، تتكلم بنفس لغة المستخدم وبأسلوبه، ردودك مناسبة للسؤال مو قصيرة زيادة ومو طويلة زيادة، إذا السؤال يستاهل نقاش تناقش، إذا المستخدم ذكر لعبة أو أنمي أو أي شيء يحبه تتفاعل معه بصدق، تخصصك نصائح الألعاب والاستراتيجيات وشرح القواعد لكن مو محصور فيها.'
        });
    }

    /* ── GAME CONTEXT ── */

    setGameContext(context) {
        this.currentGameContext = context;
        if (context.actions?.length > 0) this.buildGameActions(context);
        this.saveGameContext();
    }

    clearGameContext() {
        this.currentGameContext = null;
        if (this.gameActionsBar) { this.gameActionsBar.style.display = 'none'; this.gameActionsBar.innerHTML = ''; }
        try { localStorage.removeItem(this.gameContextKey); } catch(_) {}
    }

    buildGameActions(context) {
        this.gameActionsBar.innerHTML = '';
        this.gameActionsBar.style.display = 'flex';
        const label = document.createElement('span');
        label.innerHTML = '<span class="gh-icon gh-icon-xs"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 12h4m-2-2v4"/><circle cx="16" cy="11" r="1" fill="currentColor"/><circle cx="19" cy="13" r="1" fill="currentColor"/></svg></span>';
        label.style.cssText = 'font-size:0.8rem;color:var(--text-muted)';
        this.gameActionsBar.appendChild(label);
        context.actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = 'chat-game-action-btn';
            btn.textContent = action.label;
            btn.addEventListener('click', () => {
                const state = action.getState ? action.getState() : context.state;
                this.sendGameAction(action.id, action.label, state, context.name);
            });
            this.gameActionsBar.appendChild(btn);
        });
    }

    sendGameAction(actionId, actionLabel, state, gameName) {
        const stateStr = typeof state === 'object' ? JSON.stringify(state, null, 2) : state;
        // لا نعرض الـ card — المعلومة موجودة في الـ prompt للـ AI
        const prompts = {
            'analyze':   `حلل هذا الموقف في لعبة ${gameName}:\n${stateStr}`,
            'best-move': `ما أفضل حركة في لعبة ${gameName}؟\n${stateStr}`,
            'hint':      `أعطني تلميحاً في لعبة ${gameName}:\n${stateStr}`,
            'default':   `أنا ألعب ${gameName}. ${actionLabel}:\n${stateStr}`
        };
        this.input.value = prompts[actionId] || prompts['default'];
        this.autoResizeInput();
        this.sendMessage();
    }

    detectGameContext() {
        const path = window.location.pathname;
        if (path.includes('/games/')) this.loadGameContext();
    }

    /* ── TYPING ── */

    showTyping() {
        this.isTyping = true;
        this.typingIndicator = document.createElement('div');
        this.typingIndicator.className = 'chat-typing';
        this.typingIndicator.innerHTML = `<div class="message-avatar" style="background:var(--primary);"><span class="gh-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="12" rx="3"/><path d="M9 9V7a3 3 0 016 0v2"/><circle cx="9" cy="14" r="1.5" fill="currentColor"/><circle cx="15" cy="14" r="1.5" fill="currentColor"/><path d="M9 18h6"/><path d="M12 3v2"/></svg></span></div><div class="typing-dots"><span></span><span></span><span></span></div>`;
        this.messagesArea.appendChild(this.typingIndicator);
        this.scrollToBottom();
        document.getElementById('chat-send-btn').disabled = true;
    }

    hideTyping() {
        this.isTyping = false;
        if (this.typingIndicator) { this.typingIndicator.remove(); this.typingIndicator = null; }
        document.getElementById('chat-send-btn').disabled = false;
    }

    /* ── HISTORY ── */

    saveHistory() {
        try { localStorage.setItem(this.storageKey, JSON.stringify(this.history)); } catch(_) {}
    }

    loadHistory() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
            this.history = Array.isArray(saved) ? saved : [];
            this.history.forEach(msg => {
                if (msg.role === 'user' || msg.role === 'ai') {
                    this.addMessage(msg.role, msg.content, { noSave: true, ...msg.options });
                }
            });
        } catch(_) {}
    }

    trimHistory() {
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }
    }

    clearHistory() {
        this.history = [];
        try { localStorage.removeItem(this.storageKey); } catch(_) {}
        this.messagesArea.innerHTML = `
            <div class="chat-empty" id="chat-empty">
                <div class="chat-empty-icon"><span class="gh-icon gh-icon-2xl"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="12" rx="3"/><path d="M9 9V7a3 3 0 016 0v2"/><circle cx="9" cy="14" r="1.5" fill="currentColor"/><circle cx="15" cy="14" r="1.5" fill="currentColor"/><path d="M9 18h6"/><path d="M12 3v2"/></svg></span></div>
                <p>تم مسح التاريخ. يمكنك البدء من جديد!</p>
            </div>
        `;
    }

    saveGameContext() {
        if (!this.currentGameContext) return;
        try { localStorage.setItem(this.gameContextKey, JSON.stringify({ name: this.currentGameContext.name })); } catch(_) {}
    }

    loadGameContext() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.gameContextKey) || 'null');
            if (saved?.name) this.currentGameContext = { name: saved.name, state: '' };
        } catch(_) {}
    }

    /* ── HELPERS ── */

    scrollToBottom() {
        requestAnimationFrame(() => {
            if (this.messagesArea) this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
        });
    }

    autoResizeInput() {
        const el = this.input;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 100) + 'px';
    }

    showBadge(text) {
        const badge = document.getElementById('chat-badge');
        if (badge) { badge.textContent = text; badge.classList.add('show'); }
    }

    hideBadge() {
        const badge = document.getElementById('chat-badge');
        if (badge) badge.classList.remove('show');
    }

    formatMessage(text) {
        return this.escapeHtml(text)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }
}

/* ── Singleton exports ── */

let _instance = null;

export function initChat(options = {}) {
    if (_instance) return _instance;
    _instance = new ChatWidget(options);
    window.chatWidget = _instance;
    // Initialize chat tabs (Global + Private) after AI chat is ready
    try {
        import('./chat-tabs.js').then(({ initChatTabs }) => {
            initChatTabs(_instance);
            console.log('[Chat] Tabs initialized: AI + Global + Private');
        }).catch(err => {
            console.warn('[Chat] Tabs not available:', err.message);
        });
    } catch (e) {
        console.warn('[Chat] Could not load tabs:', e.message);
    }
    return _instance;
}

export function setChatGameContext(context) {
    if (_instance) _instance.setGameContext(context);
}

export function clearChatGameContext() {
    if (_instance) _instance.clearGameContext();
}

export default ChatWidget;
