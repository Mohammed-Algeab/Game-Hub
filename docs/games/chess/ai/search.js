/**
 * ai/search.js
 * محرك البحث — Minimax مع Alpha-Beta Pruning
 */

import { COLOR, TYPE }          from '../core/pieces.js';
import { getAllLegalMoves,
         applyMove, nextGameState,
         isCheckmate, isStalemate } from '../core/rules.js';
import { evaluate, pieceValue }    from './evaluator.js';

const INF = 999999;

// ─── ترتيب الحركات (Move Ordering) ───────────────────────────────────────────
// يُرتَّب الأكل أولاً لتحسين قطع Alpha-Beta

function scoreMoveForOrdering(move) {
    let score = 0;
    if (move.flags.includes('capture') || move.flags.includes('enPassant')) {
        // MVV-LVA: أكل قطعة ثمينة بقطعة رخيصة أفضل
        const victimValue   = pieceValue(move.captured?.type ?? TYPE.PAWN);
        const attackerValue = pieceValue(move.piece.type);
        score += 10 * victimValue - attackerValue;
    }
    if (move.flags.includes('promotion')) score += 800;
    if (move.flags.includes('castleKing') || move.flags.includes('castleQueen')) score += 50;
    return score;
}

function orderMoves(moves, board) {
    return moves
        .map(m => {
            // إضافة معلومة القطعة المأخوذة
            const captured = board.get(m.to.row, m.to.col);
            return { ...m, captured };
        })
        .sort((a, b) => scoreMoveForOrdering(b) - scoreMoveForOrdering(a));
}

// ─── Alpha-Beta ───────────────────────────────────────────────────────────────

/**
 * @param {Board}  board
 * @param {object} gameState
 * @param {number} depth      - العمق المتبقي
 * @param {number} alpha
 * @param {number} beta
 * @param {boolean} maximizing - true = أبيض، false = أسود
 * @param {object} ctx         - { nodes } عداد للتشخيص
 */
function alphaBeta(board, gameState, depth, alpha, beta, maximizing, ctx) {
    ctx.nodes++;

    // حالات نهاية اللعبة
    const color = maximizing ? COLOR.WHITE : COLOR.BLACK;
    if (isCheckmate(board, color, gameState)) return maximizing ? -INF : INF;
    if (isStalemate(board, color, gameState)) return 0;

    // العمق صفر → تقييم مباشر
    if (depth === 0) return evaluate(board);

    const moves = orderMoves(getAllLegalMoves(board, gameState.turn, gameState), board);
    if (moves.length === 0) return evaluate(board);

    if (maximizing) {
        let best = -INF;
        for (const move of moves) {
            const { board: nb } = applyMove(board, move);
            const ngs = nextGameState(board, move, gameState);
            const val = alphaBeta(nb, ngs, depth - 1, alpha, beta, false, ctx);
            best  = Math.max(best, val);
            alpha = Math.max(alpha, best);
            if (beta <= alpha) break; // Beta cutoff
        }
        return best;
    } else {
        let best = INF;
        for (const move of moves) {
            const { board: nb } = applyMove(board, move);
            const ngs = nextGameState(board, move, gameState);
            const val = alphaBeta(nb, ngs, depth - 1, alpha, beta, true, ctx);
            best = Math.min(best, val);
            beta = Math.min(beta, best);
            if (beta <= alpha) break; // Alpha cutoff
        }
        return best;
    }
}

// ─── الدالة الرئيسية ─────────────────────────────────────────────────────────

/**
 * إيجاد أفضل حركة للـ AI
 * @param {Board}  board
 * @param {object} gameState
 * @param {number} depth     - عمق البحث (1=سهل، 2=متوسط، 3=صعب، 4=خبير)
 * @returns {{ move: object, score: number, nodes: number }|null}
 */
export function findBestMove(board, gameState, depth = 2) {
    const isMaximizing = gameState.turn === COLOR.WHITE;
    const moves = orderMoves(getAllLegalMoves(board, gameState.turn, gameState), board);

    if (moves.length === 0) return null;

    const ctx = { nodes: 0 };
    let bestMove  = null;
    let bestScore = isMaximizing ? -INF : INF;

    for (const move of moves) {
        const { board: nb } = applyMove(board, move);
        const ngs = nextGameState(board, move, gameState);
        const score = alphaBeta(nb, ngs, depth - 1, -INF, INF, !isMaximizing, ctx);

        if (isMaximizing ? score > bestScore : score < bestScore) {
            bestScore = score;
            bestMove  = move;
        }
    }

    return { move: bestMove, score: bestScore, nodes: ctx.nodes };
}

// ─── مستويات الصعوبة ─────────────────────────────────────────────────────────

export const DIFFICULTY = {
    easy:   { depth: 1, label: 'سهل',    addRandomness: true },
    medium: { depth: 2, label: 'متوسط',  addRandomness: false },
    hard:   { depth: 3, label: 'صعب',    addRandomness: false },
    expert: { depth: 4, label: 'خبير',   addRandomness: false },
};

/**
 * نفس findBestMove لكن مع عشوائية للمستوى السهل
 */
export function findMoveForDifficulty(board, gameState, difficulty = 'medium') {
    const cfg = DIFFICULTY[difficulty] ?? DIFFICULTY.medium;

    // المستوى السهل: أحياناً يختار حركة عشوائية
    if (cfg.addRandomness && Math.random() < 0.4) {
        const moves = getAllLegalMoves(board, gameState.turn, gameState);
        if (moves.length > 0) {
            const move = moves[Math.floor(Math.random() * moves.length)];
            return { move, score: 0, nodes: 0 };
        }
    }

    return findBestMove(board, gameState, cfg.depth);
}
