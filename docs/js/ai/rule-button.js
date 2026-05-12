/**
 * ai/rule-button.js - Button that opens chat and asks for game rules only.
 */

const DEFAULT_PROMPTS = {
    Sudoku: 'اشرح قواعد Sudoku للمبتدئ بشكل مختصر وواضح.',
    Tetris: 'اشرح قواعد Tetris الأساسية بشكل مختصر وواضح للمبتدئ.',
    Chess: 'اشرح قواعد الشطرنج الأساسية بشكل مختصر وواضح للمبتدئ.'
};

export class GameRuleRequestButton {
    constructor(options = {}) {
        this.gameName = options.gameName || 'اللعبة';
        this.buttonLabel = options.buttonLabel || '📘 شرح القواعد';
        this.buttonClass = options.buttonClass || '';
        this.cooldown = options.cooldown || 3000;
        this.prompt = options.prompt || DEFAULT_PROMPTS[this.gameName] || `اشرح قواعد ${this.gameName} بشكل مختصر وواضح للمبتدئ.`;
        this.setGameContext = options.setGameContext || null;
        this.onMissingChat = options.onMissingChat || null;

        this._button = null;
        this._isOnCooldown = false;
    }

    mount(container) {
        if (!container) return null;
        this._button = document.createElement('button');
        this._button.type = 'button';
        this._button.className = `game-ai-help-btn ${this.buttonClass}`.trim();
        this._button.textContent = this.buttonLabel;
        this._button.addEventListener('click', () => this._onPress());
        container.appendChild(this._button);
        return this._button;
    }

    _onPress() {
        if (this._isOnCooldown) return;
        const chat = window.chatWidget;
        if (!chat) {
            if (typeof this.onMissingChat === 'function') this.onMissingChat();
            else alert('الدردشة غير متاحة حالياً.');
            return;
        }

        if (typeof chat.open === 'function' && !chat.isOpen) chat.open();
        if (typeof this.setGameContext === 'function') {
            this.setGameContext(chat);
        } else if (chat.currentGameContext) {
            chat.currentGameContext = { name: this.gameName, state: '' };
        }

        if (chat.input) {
            chat.input.value = this.prompt;
            if (typeof chat.autoResizeInput === 'function') chat.autoResizeInput();
            if (typeof chat.sendMessage === 'function') chat.sendMessage();
        }

        this._setCooldown();
    }

    _setCooldown() {
        if (!this._button) return;
        this._isOnCooldown = true;
        this._button.disabled = true;
        const original = this.buttonLabel;
        let remaining = Math.max(1, Math.ceil(this.cooldown / 1000));
        this._button.textContent = `⏳ ${remaining}s`;
        const timer = setInterval(() => {
            remaining -= 1;
            if (!this._button) {
                clearInterval(timer);
                return;
            }
            if (remaining > 0) {
                this._button.textContent = `⏳ ${remaining}s`;
            } else {
                clearInterval(timer);
                this._button.textContent = original;
                this._button.disabled = false;
                this._isOnCooldown = false;
            }
        }, 1000);
    }

    destroy() {
        if (this._button) this._button.remove();
        this._button = null;
    }
}

export default GameRuleRequestButton;
