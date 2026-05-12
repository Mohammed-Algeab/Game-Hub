/**
 * ai/advice-button.js
 * زر طلب النصيحة — يرسل الموقف الحالي للـ Chat AI ويعرض رد مقروء
 */

import { boardToFEN }        from '../core/fen.js';
import { COLOR, ARABIC_COLOR, ARABIC_NAME } from '../core/pieces.js';
import { Board }             from '../core/board.js';

/**
 * @param {object} options
 * @param {HTMLElement} options.buttonEl    - زر النصيحة
 * @param {HTMLElement} options.outputEl    - العنصر لعرض النصيحة فيه
 * @param {Function}    options.getBoard    - () => Board
 * @param {Function}    options.getGameState- () => gameState
 * @param {Function}    options.getHistory  - () => MoveHistory
 * @param {string}      options.endpoint    - Cloudflare Worker URL
 */
export class AdviceButton {
    constructor({ buttonEl, outputEl, getBoard, getGameState, getHistory, endpoint }) {
        this._btn       = buttonEl;
        this._out       = outputEl;
        this._getBoard  = getBoard;
        this._getGS     = getGameState;
        this._getHist   = getHistory;
        this._endpoint  = endpoint;
        this._loading   = false;

        this._btn.addEventListener('click', () => this._request());
    }

    async _request() {
        if (this._loading) return;
        this._loading = true;
        this._setUI('loading');

        try {
            const board     = this._getBoard();
            const gameState = this._getGS();
            const history   = this._getHist();

            const prompt = this._buildPrompt(board, gameState, history);
            const advice  = await this._callAI(prompt);

            this._setUI('result', advice);
        } catch (err) {
            this._setUI('error', 'تعذّر الحصول على النصيحة. حاول مرة أخرى.');
        } finally {
            this._loading = false;
        }
    }

    // ─── بناء الـ Prompt ──────────────────────────────────────────────────────

    _buildPrompt(board, gameState, history) {
        const fen      = boardToFEN(board, gameState);
        const turnAr   = ARABIC_COLOR[gameState.turn];
        const pgn      = history.toPGN();
        const lastMoves = history.toArabicSummary(6);

        // وصف القطع الموجودة بشكل مقروء
        const pieces = this._describePieces(board, gameState.turn);

        return `أنت مساعد شطرنج. الموقف الحالي في اللعبة:

الدور: ${turnAr}
FEN: ${fen}

آخر الحركات:
${lastMoves || 'بداية اللعبة'}

القطع على الرقعة (من منظور ${turnAr}):
${pieces}

المطلوب: أعطني نصيحة عملية واضحة للاعب ${turnAr}. 
- اقترح الحركة المناسبة بصيغة: "حرّك [اسم القطعة] من [عمود+صف] إلى [عمود+صف]"
- اشرح السبب في جملتين بسيطتين
- لا تستخدم رموز الشطرنج التقنية مثل Nf3 أو e4 وحدها، بل دائماً اشرح بالعربية
- الرد لا يتجاوز 4 جمل`;
    }

    _describePieces(board, color) {
        const lines = [];
        const myPieces    = [];
        const theirPieces = [];

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board.get(r, c);
                if (!p) continue;
                const sq      = Board.toAlgebraic(r, c);
                const typeAr  = ARABIC_NAME[p.type];
                const entry   = `${typeAr} في ${sq}`;
                if (p.color === color) myPieces.push(entry);
                else theirPieces.push(entry);
            }
        }

        const colorAr = ARABIC_COLOR[color];
        const oppAr   = color === COLOR.WHITE ? 'الأسود' : 'الأبيض';

        lines.push(`قطع ${colorAr}: ${myPieces.join('، ')}`);
        lines.push(`قطع ${oppAr}: ${theirPieces.join('، ')}`);
        return lines.join('\n');
    }

    // ─── استدعاء AI ──────────────────────────────────────────────────────────

    async _callAI(prompt) {
        const res = await fetch(this._endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: prompt,
                history: [],
                systemPrompt: 'أنت مساعد شطرنج ذكي. ردودك واضحة وعملية باللغة العربية، بدون رموز تقنية معقدة.',
            }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.response ?? data.reply ?? data.text ?? data.message ?? 'لم يصل رد.';
    }

    // ─── تحديث الواجهة ────────────────────────────────────────────────────────

    _setUI(state, text = '') {
        if (!this._out) return;
        this._out.classList.remove('hidden');

        if (state === 'loading') {
            this._btn.disabled    = true;
            this._btn.textContent = '⏳ جارٍ التحليل...';
            this._out.innerHTML   = '<div class="advice-loading">يفكر المساعد...</div>';
        } else if (state === 'result') {
            this._btn.disabled    = false;
            this._btn.textContent = '💡 اطلب نصيحة';
            this._out.innerHTML   = `<div class="advice-text">${this._formatAdvice(text)}</div>`;
        } else {
            this._btn.disabled    = false;
            this._btn.textContent = '💡 اطلب نصيحة';
            this._out.innerHTML   = `<div class="advice-error">${text}</div>`;
        }
    }

    _formatAdvice(text) {
        // تحويل نص عادي إلى HTML مع الحفاظ على الأسطر
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/\n/g, '<br>');
    }
}
