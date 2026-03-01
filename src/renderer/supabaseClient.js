import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;


const customStorageAdapter = {
    getItem: async (key) => {
        console.log('[Supabase] Adapter getItem:', key);
        if (window.electron?.storage) {
            const val = await window.electron.storage.getItem(key);
            console.log('[Supabase] Electron storage returned:', val ? 'VALUE_FOUND' : 'NULL');
            return val;
        }
        console.warn('[Supabase] Electron storage unavailable, falling back to localStorage');
        return window.localStorage.getItem(key);
    },
    setItem: async (key, value) => {
        console.log('[Supabase] Adapter setItem:', key);
        if (window.electron?.storage) {
            await window.electron.storage.setItem(key, value);
            console.log('[Supabase] Saved to Electron storage');
            return;
        }
        console.warn('[Supabase] Electron storage unavailable, falling back to localStorage');
        return window.localStorage.setItem(key, value);
    },
    removeItem: async (key) => {
        console.log('[Supabase] Adapter removeItem:', key);
        if (window.electron?.storage) {
            await window.electron.storage.removeItem(key);
            return;
        }
        return window.localStorage.removeItem(key);
    }
};

const isOverlay = window.location.hash.includes('overlay');

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        storageKey: 'elcommunity-auth-token', // Explicit key
        persistSession: !isOverlay, // Do not persist or read in overlay
        storage: customStorageAdapter, // Use custom adapter
        autoRefreshToken: !isOverlay, // Overlay MUST NOT refresh tokens
        detectSessionInUrl: !isOverlay
    }
});
