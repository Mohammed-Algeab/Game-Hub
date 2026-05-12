export const GAMEHUB_CONFIG = {
    appName: 'Game Hub',
    profileStorageKey: 'gamehub-profile-local',
    chatHistoryKeyPrefix: 'gamehub-chat-history',
    chatContextKeyPrefix: 'gamehub-game-context',
    aiHistoryWindow: 5,
    chatHistoryLimit: 200,
    defaultAIModel: 'gemini-2.5-flash',
    chatEndpoint: 'https://game-hub-backend.alghaybmhmd606.workers.dev/',
    profileSoonLabel: 'Soon',
};

export function getDefaultAIEndpoint() {
    const fromWindow = typeof window !== 'undefined' ? window.GAMEHUB_AI_ENDPOINT : '';
    if (typeof fromWindow === 'string' && fromWindow.trim()) return fromWindow.trim();
    return GAMEHUB_CONFIG.chatEndpoint;
}
