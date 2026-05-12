/**
 * foundation/game-manager.js
 * يدير دورة حياة الألعاب، ويوفر واجهة موحدة للألعاب للتفاعل مع Game Hub.
 * يعتمد على GameFoundation ويستخدمه لإدارة حالة اللعبة.
 */

import { GameFoundation } from './game-api.js';

class GameManager {
    constructor() {
        this.currentGame = null;
        this.gameFoundationInstance = null;
    }

    /**
     * تهيئة لعبة جديدة.
     * إن كانت هناك لعبة نشطة يتم تنظيفها تلقائياً (مؤقتات + listeners + جلسة).
     * @param {object} gameConfig - إعدادات اللعبة (مثل الاسم، مفتاح التخزين، الـ callbacks).
     * @returns {GameFoundation} - نسخة من GameFoundation للعبة الحالية.
     */
    initGame(gameConfig) {
        if (this.gameFoundationInstance) {
            // تنظيف النسخة السابقة تلقائياً (مؤقتات + listeners + جلسة نشطة)
            this.gameFoundationInstance.destroy();
        }
        this.gameFoundationInstance = new GameFoundation(gameConfig);
        this.currentGame = gameConfig.name;
        console.log(`[GameManager] تم تهيئة اللعبة: ${this.currentGame}`);
        return this.gameFoundationInstance;
    }

    /**
     * الحصول على نسخة GameFoundation للعبة الحالية.
     * @returns {GameFoundation|null}
     */
    getGameFoundation() {
        return this.gameFoundationInstance;
    }

    /**
     * إنهاء اللعبة الحالية وتنظيف كامل.
     */
    endGame() {
        if (this.gameFoundationInstance) {
            this.gameFoundationInstance.destroy();
            this.gameFoundationInstance = null;
            this.currentGame = null;
            console.log('[GameManager] تم إنهاء اللعبة الحالية.');
        }
    }
}

export const gameManager = new GameManager();
