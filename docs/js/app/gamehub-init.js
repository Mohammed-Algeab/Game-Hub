/**
 * gamehub-init.js
 * ملف مركزي للإعدادات - يُحمَّل أولاً في كل صفحة HTML
 * يمنع تكرار window.GAMEHUB_CONFIG في كل ملف
 *
 * للإعداد: استبدل القيم أدناه ببيانات مشروع Supabase الخاص بك
 * احصل عليها من: supabase.com → مشروعك → Settings → API
 */
(function () {
    if (window.GAMEHUB_CONFIG) return; // تجنب التعريف المزدوج

    window.GAMEHUB_CONFIG = {
        // ── Supabase (اختياري - يعمل بدونه كـ Guest) ──────────────────────
        // للتفعيل: أنشئ مشروعاً على supabase.com وضع بياناته هنا
        SUPABASE_URL: 'https://srvqbfntrfofqpucevyz.supabase.co',       // مثال: 'https://xyzxyz.supabase.co'
        SUPABASE_ANON_KEY: 'sb_publishable_j2hdAh6pxRaaLgk7lqSIuw_tSwHv97G',  // مفتاح anon العام من لوحة Supabase

        // ── إعدادات التطبيق ────────────────────────────────────────────────
        APP_VERSION: 'V15',
        APP_NAME: 'Game Hub',
    };
})();
