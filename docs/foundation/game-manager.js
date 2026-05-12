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
     * @param {object} gameConfig - إعدادات اللعبة (مثل الاسم، مفتاح التخزين، الـ callbacks).
     * @returns {GameFoundation} - نسخة من GameFoundation للعبة الحالية.
     */
    initGame(gameConfig) {
        if (this.gameFoundationInstance) {
            console.warn('لعبة سابقة لا تزال نشطة. يرجى التأكد من إنهاء اللعبة قبل بدء لعبة جديدة.');
            // يمكن إضافة منطق لإنهاء اللعبة السابقة هنا إذا لزم الأمر.
        }
        this.gameFoundationInstance = new GameFoundation(gameConfig);
        this.currentGame = gameConfig.name; // تخزين اسم اللعبة الحالية
        console.log(`تم تهيئة اللعبة: ${this.currentGame}`);
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
     * إنهاء اللعبة الحالية.
     */
    endGame() {
        if (this.gameFoundationInstance) {
            this.gameFoundationInstance.clearState(); // مسح حالة اللعبة المحفوظة
            this.gameFoundationInstance = null;
            this.currentGame = null;
            console.log('تم إنهاء اللعبة الحالية.');
        }
    }

    // يمكن إضافة المزيد من الوظائف هنا لإدارة الألعاب، مثل:
    // - تحميل الأصول المشتركة
    // - إدارة الأحداث العامة
    // - التفاعل مع واجهة المستخدم العامة لـ Game Hub
}

export const gameManager = new GameManager();
