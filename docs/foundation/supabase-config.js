/**
 * foundation/supabase-config.js
 * إعداد Supabase Client - يتحقق من صحة الإعدادات قبل الاتصال
 * إذا لم تكن الإعدادات موجودة، يعمل التطبيق بوضع Offline تلقائياً
 */

let supabaseClient = null;
let initAttempted = false;

function isConfigured() {
    const url = window.GAMEHUB_CONFIG?.SUPABASE_URL;
    const key = window.GAMEHUB_CONFIG?.SUPABASE_ANON_KEY;
    return typeof url === 'string' && url.startsWith('https://') &&
           typeof key === 'string' && key.length > 10;
}

export async function getSupabase() {
    if (supabaseClient) return supabaseClient;
    if (initAttempted) return null;
    initAttempted = true;

    if (!isConfigured()) {
        console.info('[Supabase] لم يتم إعداد Supabase - وضع Offline نشط (طبيعي للعب كضيف)');
        return null;
    }

    try {
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm');

        supabaseClient = createClient(
            window.GAMEHUB_CONFIG.SUPABASE_URL,
            window.GAMEHUB_CONFIG.SUPABASE_ANON_KEY,
            {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: true,
                    flowType: 'pkce'
                },
                realtime: { params: { eventsPerSecond: 10 } }
            }
        );

        console.log('[Supabase] ✅ تم الاتصال بنجاح');
        return supabaseClient;
    } catch (err) {
        console.warn('[Supabase] فشل الاتصال - سيعمل التطبيق بوضع Offline:', err.message);
        return null;
    }
}

export async function isSupabaseReady() {
    const client = await getSupabase();
    return client !== null;
}

export async function clearSupabaseSession() {
    const client = await getSupabase();
    if (client) {
        await client.auth.signOut();
        supabaseClient = null;
        initAttempted = false;
    }
}

export { supabaseClient };
