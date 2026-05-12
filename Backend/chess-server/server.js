/**
 * gamehub-chess-server/server.js
 * خادم الشطرنج الأونلاين — Node.js + Socket.io
 * يُنشر على Render كـ Web Service
 */

const express   = require('express');
const http      = require('http');
const { Server }= require('socket.io');
const cors      = require('cors');

// ─── إعداد Express ───────────────────────────────────────────────────────────

const app    = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = [
    process.env.FRONTEND_URL || 'https://alghaybmhmd606.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:5500',  // Live Server للتطوير
];

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());

// Health check لـ Render
app.get('/',       (_, res) => res.json({ status: 'ok', service: 'GameHub Chess Server' }));
app.get('/health', (_, res) => res.json({ status: 'ok', rooms: rooms.size, players: players.size }));

// ─── Socket.io ────────────────────────────────────────────────────────────────

const io = new Server(server, {
    cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
    pingTimeout:  20000,
    pingInterval: 10000,
});

// ─── قواعد البيانات في الذاكرة ───────────────────────────────────────────────

/** @type {Map<string, Room>} */
const rooms   = new Map();   // roomCode → Room
/** @type {Map<string, string>} */
const players = new Map();   // socketId → roomCode

/**
 * @typedef {object} Room
 * @property {string}   code
 * @property {string}   white       - socketId اللاعب الأبيض
 * @property {string|null} black    - socketId اللاعب الأسود (null قبل الانضمام)
 * @property {string}   fen         - الموقف الحالي
 * @property {string[]} moves       - قائمة الحركات SAN
 * @property {string}   status      - 'waiting'|'playing'|'over'
 * @property {string|null} winner   - 'w'|'b'|'draw'|null
 * @property {number}   createdAt
 * @property {number}   lastActivity
 */

// ─── مساعدات ─────────────────────────────────────────────────────────────────

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    while (code.length < 6 || rooms.has(code)) {
        code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }
    return code;
}

function getRoomOf(socketId) {
    const code = players.get(socketId);
    return code ? rooms.get(code) : null;
}

function broadcastRoom(room) {
    const state = {
        code:       room.code,
        fen:        room.fen,
        moves:      room.moves,
        status:     room.status,
        winner:     room.winner,
        whiteReady: !!room.white,
        blackReady: !!room.black,
    };
    io.to(room.code).emit('room:state', state);
}

function cleanupPlayer(socketId) {
    const room = getRoomOf(socketId);
    if (!room) return;

    const isWhite = room.white === socketId;
    const isBlack = room.black === socketId;

    if (isWhite) room.white = null;
    if (isBlack) room.black = null;

    players.delete(socketId);

    // إبلاغ الخصم إن كانت اللعبة جارية
    if (room.status === 'playing') {
        room.status = 'over';
        room.winner = isWhite ? 'b' : 'w';
        broadcastRoom(room);
        io.to(room.code).emit('room:player_left', {
            color: isWhite ? 'w' : 'b',
        });
    }

    // حذف الغرفة إن فرغت
    if (!room.white && !room.black) {
        rooms.delete(room.code);
        console.log(`[Room] ${room.code} deleted (empty)`);
    }
}

// ─── أحداث Socket.io ─────────────────────────────────────────────────────────

io.on('connection', (socket) => {
    console.log(`[+] ${socket.id} connected`);

    // ── إنشاء غرفة ─────────────────────────────────────────────────────────
    socket.on('room:create', (_, callback) => {
        // تأكد أن اللاعب لم يكن في غرفة سابقة
        cleanupPlayer(socket.id);

        const code = generateCode();
        const room = {
            code,
            white:        socket.id,
            black:        null,
            fen:          STARTING_FEN,
            moves:        [],
            status:       'waiting',
            winner:       null,
            createdAt:    Date.now(),
            lastActivity: Date.now(),
        };

        rooms.set(code, room);
        players.set(socket.id, code);
        socket.join(code);

        console.log(`[Room] ${code} created by ${socket.id}`);
        callback?.({ ok: true, code, color: 'w' });
        broadcastRoom(room);
    });

    // ── الانضمام لغرفة ─────────────────────────────────────────────────────
    socket.on('room:join', ({ code }, callback) => {
        const room = rooms.get(code?.toUpperCase());

        if (!room) {
            return callback?.({ ok: false, error: 'الغرفة غير موجودة' });
        }
        if (room.black) {
            return callback?.({ ok: false, error: 'الغرفة ممتلئة' });
        }
        if (room.white === socket.id) {
            return callback?.({ ok: false, error: 'أنت منشئ هذه الغرفة' });
        }

        cleanupPlayer(socket.id);

        room.black  = socket.id;
        room.status = 'playing';
        room.lastActivity = Date.now();

        players.set(socket.id, code.toUpperCase());
        socket.join(code.toUpperCase());

        console.log(`[Room] ${code} joined by ${socket.id}`);
        callback?.({ ok: true, code: room.code, color: 'b', fen: room.fen });
        broadcastRoom(room);
    });

    // ── إرسال حركة ─────────────────────────────────────────────────────────
    socket.on('game:move', ({ from, to, promotion, fen, san }, callback) => {
        const room = getRoomOf(socket.id);
        if (!room || room.status !== 'playing') {
            return callback?.({ ok: false, error: 'غير مسموح' });
        }

        // التحقق من الدور
        const isWhiteTurn = room.fen.split(' ')[1] === 'w';
        const isWhite     = room.white === socket.id;
        if (isWhiteTurn !== isWhite) {
            return callback?.({ ok: false, error: 'ليس دورك' });
        }

        // تحديث الغرفة
        room.fen   = fen;
        room.moves = [...room.moves, san].filter(Boolean);
        room.lastActivity = Date.now();

        callback?.({ ok: true });

        // إبلاغ الخصم بالحركة
        const opponentId = isWhite ? room.black : room.white;
        if (opponentId) {
            io.to(opponentId).emit('game:move', { from, to, promotion, fen, san });
        }
    });

    // ── نهاية اللعبة ───────────────────────────────────────────────────────
    socket.on('game:over', ({ status, winner }) => {
        const room = getRoomOf(socket.id);
        if (!room) return;

        room.status = 'over';
        room.winner = winner ?? null;
        room.lastActivity = Date.now();

        broadcastRoom(room);
        io.to(room.code).emit('game:over', { status, winner });
    });

    // ── عرض تعادل ──────────────────────────────────────────────────────────
    socket.on('game:draw_offer', () => {
        const room = getRoomOf(socket.id);
        if (!room || room.status !== 'playing') return;

        const opponentId = room.white === socket.id ? room.black : room.white;
        if (opponentId) io.to(opponentId).emit('game:draw_offer');
    });

    socket.on('game:draw_accept', () => {
        const room = getRoomOf(socket.id);
        if (!room || room.status !== 'playing') return;

        room.status = 'over';
        room.winner = 'draw';
        io.to(room.code).emit('game:over', { status: 'draw', winner: 'draw' });
        broadcastRoom(room);
    });

    socket.on('game:draw_decline', () => {
        const room = getRoomOf(socket.id);
        if (!room) return;
        const opponentId = room.white === socket.id ? room.black : room.white;
        if (opponentId) io.to(opponentId).emit('game:draw_declined');
    });

    // ── استسلام ────────────────────────────────────────────────────────────
    socket.on('game:resign', () => {
        const room = getRoomOf(socket.id);
        if (!room || room.status !== 'playing') return;

        const isWhite  = room.white === socket.id;
        room.status    = 'over';
        room.winner    = isWhite ? 'b' : 'w';
        room.lastActivity = Date.now();

        broadcastRoom(room);
        io.to(room.code).emit('game:over', {
            status: 'resign',
            winner: room.winner,
        });
    });

    // ── رسالة دردشة داخل الغرفة ───────────────────────────────────────────
    socket.on('room:chat', ({ text }) => {
        const room = getRoomOf(socket.id);
        if (!room || !text?.trim()) return;

        const isWhite = room.white === socket.id;
        const from    = isWhite ? 'w' : 'b';
        io.to(room.code).emit('room:chat', { from, text: text.trim() });
    });

    // ── قطع الاتصال ────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
        console.log(`[-] ${socket.id} disconnected`);
        cleanupPlayer(socket.id);
    });
});

// ─── تنظيف الغرف المتروكة (كل 10 دقائق) ────────────────────────────────────

setInterval(() => {
    const now     = Date.now();
    const timeout = 30 * 60 * 1000; // 30 دقيقة
    for (const [code, room] of rooms.entries()) {
        if (now - room.lastActivity > timeout) {
            rooms.delete(code);
            console.log(`[Cleanup] Room ${code} expired`);
        }
    }
}, 10 * 60 * 1000);

// ─── تشغيل الخادم ────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Chess Server running on port ${PORT}`);
    console.log(`   Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
