const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    isElectron: true,
    ping: () => ipcRenderer.invoke('ping'),
    getMemoryInfo: () => ipcRenderer.invoke('get-memory-info'),
    getRunningWindows: () => ipcRenderer.invoke('get-running-windows'),
    selectProcess: (pid) => ipcRenderer.invoke('select-process', pid),
    resizeWindow: (width, height) => ipcRenderer.send('resize-window', { width, height }),
    onPerformanceUpdate: (callback) => ipcRenderer.on('perf-update', (_event, value) => callback(value)),
    sendGameSettings: (settings) => ipcRenderer.send('game-settings-update', settings),
    onGameSettings: (callback) => {
        const listener = (_event, settings) => callback(settings);
        ipcRenderer.on('game-settings-update', listener);
        return () => ipcRenderer.removeListener('game-settings-update', listener);
    },
    requestGameSettings: () => ipcRenderer.send('request-game-settings'),
    notifyLoggedOut: () => ipcRenderer.send('user-logged-out'),
    notifyLoggedIn: (settings) => ipcRenderer.send('user-logged-in', settings),
    storage: {
        getItem: (key) => ipcRenderer.invoke('storage-get', key),
        setItem: (key, value) => ipcRenderer.invoke('storage-set', key, value),
        removeItem: (key) => ipcRenderer.invoke('storage-remove', key)
    },
    updateShortcuts: (shortcuts) => ipcRenderer.send('update-shortcuts', shortcuts),
    onShortcutStatus: (callback) => {
        const listener = (_event, results) => callback(results);
        ipcRenderer.on('shortcuts-registration-status', listener);
        return () => ipcRenderer.removeListener('shortcuts-registration-status', listener);
    },
    onShortcutsUpdate: (callback) => {
        const listener = (_event, shortcuts) => callback(shortcuts);
        ipcRenderer.on('shortcuts-update', listener);
        return () => ipcRenderer.removeListener('shortcuts-update', listener);
    },
    sendNotification: (data) => ipcRenderer.send('send-notification-to-overlay', data),
    onOverlayNotification: (callback) => ipcRenderer.on('overlay-notification', (_event, data) => callback(data))
});

// ── Persistent notification queue for overlay ──
// This runs in preload (before React), so the listener is ALWAYS active.
// Notifications are stored in a queue and a DOM event is dispatched.
window.__overlayNotifQueue = [];
ipcRenderer.on('overlay-notification', (_event, data) => {
    console.log('[Preload] Overlay notification received:', data);
    window.__overlayNotifQueue.push(data);
    window.dispatchEvent(new CustomEvent('overlay-notif', { detail: data }));
});
