/**
 * online/room-client.js
 * إدارة الاتصال بالخادم وأحداث الغرفة
 */

// Socket.io يُحمَّل من CDN في HTML
const SOCKET_CDN = 'https://cdn.socket.io/4.7.2/socket.io.min.js';

export class RoomClient {
    /**
     * @param {string} serverUrl - رابط الخادم على Render
     * @param {object} handlers
     * @param {Function} handlers.onConnected
     * @param {Function} handlers.onDisconnected
     * @param {Function} handlers.onRoomState    - (state)
     * @param {Function} handlers.onMove         - ({ from, to, promotion, fen, san })
     * @param {Function} handlers.onGameOver     - ({ status, winner })
     * @param {Function} handlers.onPlayerLeft
     * @param {Function} handlers.onDrawOffer
     * @param {Function} handlers.onDrawDeclined
     * @param {Function} handlers.onChat         - ({ from, text })
     * @param {Function} handlers.onError        - (message)
     */
    constructor(serverUrl, handlers = {}) {
        this._url      = serverUrl;
        this._handlers = handlers;
        this._socket   = null;
        this._color    = null;   // 'w' | 'b'
        this._roomCode = null;
        this._connected = false;
    }

    // ─── الاتصال ─────────────────────────────────────────────────────────────

    async connect() {
        // تحميل Socket.io من CDN إن لم يكن محملاً
        if (!window.io) {
            await this._loadScript(SOCKET_CDN);
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('انتهت مهلة الاتصال')), 10000);

            this._socket = window.io(this._url, {
                transports:       ['websocket', 'polling'],
                reconnection:     true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5,
            });

            this._socket.on('connect', () => {
                clearTimeout(timeout);
                this._connected = true;
                this._handlers.onConnected?.();
                resolve();
            });

            this._socket.on('connect_error', (err) => {
                clearTimeout(timeout);
                this._handlers.onError?.('تعذّر الاتصال بالخادم');
                reject(err);
            });

            this._socket.on('disconnect', () => {
                this._connected = false;
                this._handlers.onDisconnected?.();
            });

            this._bindEvents();
        });
    }

    disconnect() {
        this._socket?.disconnect();
        this._socket   = null;
        this._connected = false;
    }

    // ─── ربط الأحداث ─────────────────────────────────────────────────────────

    _bindEvents() {
        const s = this._socket;
        s.on('room:state',      (d) => this._handlers.onRoomState?.(d));
        s.on('game:move',       (d) => this._handlers.onMove?.(d));
        s.on('game:over',       (d) => this._handlers.onGameOver?.(d));
        s.on('room:player_left',()  => this._handlers.onPlayerLeft?.());
        s.on('game:draw_offer', ()  => this._handlers.onDrawOffer?.());
        s.on('game:draw_declined',()=> this._handlers.onDrawDeclined?.());
        s.on('room:chat',       (d) => this._handlers.onChat?.(d));
    }

    // ─── إجراءات اللاعب ──────────────────────────────────────────────────────

    /**
     * إنشاء غرفة جديدة
     * @returns {Promise<{code: string, color: string}>}
     */
    createRoom() {
        return this._emit('room:create', {});
    }

    /**
     * الانضمام لغرفة
     * @param {string} code
     * @returns {Promise<{code, color, fen}>}
     */
    joinRoom(code) {
        return this._emit('room:join', { code: code.toUpperCase() });
    }

    /**
     * إرسال حركة
     * @param {object} moveData - { from, to, promotion, fen, san }
     */
    sendMove(moveData) {
        return this._emit('game:move', moveData);
    }

    /** إبلاغ الخادم بنهاية اللعبة */
    sendGameOver(status, winner) {
        this._socket?.emit('game:over', { status, winner });
    }

    /** عرض تعادل */
    offerDraw()   { this._socket?.emit('game:draw_offer');   }
    acceptDraw()  { this._socket?.emit('game:draw_accept');  }
    declineDraw() { this._socket?.emit('game:draw_decline'); }

    /** استسلام */
    resign()      { this._socket?.emit('game:resign'); }

    /** رسالة دردشة */
    sendChat(text) { this._socket?.emit('room:chat', { text }); }

    // ─── مساعدات ─────────────────────────────────────────────────────────────

    get color()     { return this._color; }
    get roomCode()  { return this._roomCode; }
    get connected() { return this._connected; }

    setColor(color)     { this._color    = color; }
    setRoomCode(code)   { this._roomCode = code;  }

    _emit(event, data) {
        return new Promise((resolve, reject) => {
            if (!this._socket?.connected) {
                return reject(new Error('غير متصل'));
            }
            const timeout = setTimeout(() => reject(new Error('لم يرد الخادم')), 8000);
            this._socket.emit(event, data, (res) => {
                clearTimeout(timeout);
                if (res?.ok) resolve(res);
                else reject(new Error(res?.error || 'خطأ من الخادم'));
            });
        });
    }

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload  = resolve;
            s.onerror = () => reject(new Error(`فشل تحميل ${src}`));
            document.head.appendChild(s);
        });
    }
}
