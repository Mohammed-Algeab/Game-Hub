import { GAMEHUB_CONFIG } from './config.js';

const DEFAULT_PROFILE = {
    id: 'local',
    name: GAMEHUB_CONFIG.profileSoonLabel,
    avatar: 'SOON',
    createdAt: null,
};

export class ProfileLocalManager {
    constructor(storageKey = GAMEHUB_CONFIG.profileStorageKey) {
        this.storageKey = storageKey;
        this.profile = this.loadProfile();
    }

    loadProfile() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
            if (saved && typeof saved === 'object') {
                return {
                    ...DEFAULT_PROFILE,
                    ...saved,
                    id: String(saved.id || DEFAULT_PROFILE.id),
                    name: String(saved.name || DEFAULT_PROFILE.name),
                };
            }
        } catch (_) {}
        return { ...DEFAULT_PROFILE };
    }

    getProfile() {
        this.profile = this.loadProfile();
        return { ...this.profile };
    }

    getProfileId() {
        return this.getProfile().id || DEFAULT_PROFILE.id;
    }

    getDisplayName() {
        return this.getProfile().name || DEFAULT_PROFILE.name;
    }

    getAvatarText() {
        return this.getProfile().avatar || DEFAULT_PROFILE.avatar;
    }

    getScopedKey(baseKey) {
        return `${baseKey}:${this.getProfileId()}`;
    }

    saveProfile(profile) {
        const next = {
            ...DEFAULT_PROFILE,
            ...profile,
            id: String(profile?.id || DEFAULT_PROFILE.id),
            name: String(profile?.name || DEFAULT_PROFILE.name),
        };
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(next));
        } catch (_) {}
        this.profile = next;
        return { ...next };
    }

    clearProfile() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (_) {}
        this.profile = { ...DEFAULT_PROFILE };
        return { ...this.profile };
    }
}

export const profileLocalManager = new ProfileLocalManager();
export default profileLocalManager;
