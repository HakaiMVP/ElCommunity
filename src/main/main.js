const { app, BrowserWindow, ipcMain, screen, globalShortcut, Notification, Tray, Menu } = require('electron');
const path = require('path');
const { getGameStats, getRunningWindows, getSystemStats, getGpuUsage, getDiskUsage, getAllSystemStats, startFpsMonitor, stopFpsMonitor, getCurrentFps } = require('./monitor');
const keyboardHook = require('./keyboardHook');
const fs = require('fs');

if (app) {
    app.name = 'ElCommunity';
}

// ── Secure Storage (Simple JSON File) ──
const storagePath = path.join(app.getPath('userData'), 'session-store.json');
console.log('[Main] Storage Path:', storagePath);

function getStorage() {
    try {
        if (!fs.existsSync(storagePath)) {
            console.log('[Main] Storage file does not exist yet.');
            return {};
        }
        const data = fs.readFileSync(storagePath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('[Main] Error reading storage:', e);
        return {};
    }
}

function setStorage(data) {
    try {
        fs.writeFileSync(storagePath, JSON.stringify(data, null, 2), 'utf8');
        console.log('[Main] Storage saved successfully.');
    } catch (e) {
        console.error('[Main] Error writing storage:', e);
    }
}

// ── IPC Handlers for Storage ──
ipcMain.handle('storage-get', (event, key) => {
    const data = getStorage();
    return data[key] || null;
});

ipcMain.handle('storage-set', (event, key, value) => {
    const data = getStorage();
    data[key] = value;
    setStorage(data);
    return true;
});

ipcMain.handle('storage-remove', (event, key) => {
    const data = getStorage();
    delete data[key];
    setStorage(data);
    return true;
});

// ── State ──
let tray = null;
let isQuitting = false;
let selectedPid = null;
let mainWindow = null;
let overlayWindow = null;
const storedData = getStorage();

let currentSettings = {
    overlayEnabled: true,
    overlayMode: 'minimal',
    overlayPosition: 'top-right',
    showFps: true,
    showCpu: true,
    showGpu: true,
    showRam: true,
    showDisk: true,
    closeToTray: storedData.closeToTray !== undefined ? storedData.closeToTray : true,
};

let currentShortcuts = {
    toggleOverlay: "Alt+'"
};

let perfInterval = null;

// ── Main Window ──
const createWindow = () => {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
        },
        backgroundColor: '#36393f',
        title: 'ElCommunity',
        autoHideMenuBar: true,
    });

    mainWindow.on('close', (event) => {
        if (!isQuitting && currentSettings.closeToTray) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        stopFpsMonitor();
        if (perfInterval) { clearInterval(perfInterval); perfInterval = null; }
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.close();
        }
        mainWindow = null;
        overlayWindow = null;
    });

    const isDev = !app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }
};

// ── Overlay Window ──
const createOverlayWindow = () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) return;

    const { width, height } = screen.getPrimaryDisplay().bounds;
    const iconPath = path.join(__dirname, 'assets', 'icon.png');

    overlayWindow = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        show: false,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
        },
    });

    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.setVisibleOnAllWorkspaces(true);
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });

    const isDev = !app.isPackaged;
    if (isDev) {
        overlayWindow.loadURL('http://localhost:5173#/overlay');
    } else {
        overlayWindow.loadURL(`file://${path.join(__dirname, '../../dist/index.html')}#/overlay`);
    }
};


// ── Performance Monitoring Loop ──
let isPerfRunning = false;
function startPerfLoop() {
    if (perfInterval) return;

    perfInterval = setInterval(async () => {
        try {
            if (!overlayWindow || overlayWindow.isDestroyed()) return;
            // Skip tick if previous one is still running (prevents process pile-up)
            if (isPerfRunning) return;
            isPerfRunning = true;

            // Single batched call for CPU/RAM/GPU/Disk (1 PowerShell process instead of 5)
            const allStats = await getAllSystemStats();
            const gameData = await getGameStats(selectedPid);
            const gameFps = getCurrentFps();

            const payload = {
                memory: allStats.ramPercent,
                freeMb: allStats.freeMb,
                cpu: allStats.totalCpu,
                gpu: allStats.gpuPercent,
                gameFps: gameFps,
                gpuPercent: allStats.gpuPercent,
                ramPercent: allStats.ramPercent,
                diskPercent: allStats.diskPercent,
                game: null
            };

            if (gameData) {
                const cores = parseInt(process.env.NUMBER_OF_PROCESSORS) || 8;
                payload.game = {
                    ...gameData,
                    stability: Math.max(0, Math.min(100, 100 - (gameData.cpu / cores / 0.7)))
                };
                startFpsMonitor(gameData.pid);
            } else if (selectedPid) {
                let processAlive = false;
                try {
                    process.kill(selectedPid, 0);
                    processAlive = true;
                } catch (e) {
                    processAlive = e.code === 'EPERM';
                }

                if (!processAlive) {
                    selectedPid = null;
                    stopFpsMonitor();
                }
            }

            overlayWindow.webContents.send('perf-update', payload);

            // Always keep overlay window visible (for notifications)
            // The FPS HUD is shown/hidden via React based on overlayEnabled setting
            if (!overlayWindow.isVisible()) {
                overlayWindow.showInactive();
                overlayWindow.setAlwaysOnTop(true, 'screen-saver');
                overlayWindow.setIgnoreMouseEvents(true, { forward: true });
            }
        } catch (e) {
            console.error('[Main] Error in perf update loop:', e.message);
        } finally {
            isPerfRunning = false;
        }
    }, 1000);
}

// ── App Lifecycle ──
if (app) {
    app.whenReady().then(() => {
        createWindow();

        // ── Tray Setup ──
        const iconPath = path.join(__dirname, 'assets', 'icon.png');
        tray = new Tray(iconPath);

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Abrir ElCommunity',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Sair',
                click: () => {
                    isQuitting = true;
                    app.quit();
                }
            }
        ]);

        tray.setToolTip('ElCommunity');
        tray.setContextMenu(contextMenu);

        tray.on('click', () => {
            if (mainWindow) {
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        });

        // Start the low-level keyboard hook (works in fullscreen games)
        keyboardHook.start();
    });

    app.on('will-quit', () => {
        globalShortcut.unregisterAll();
        keyboardHook.stop();
    });

    app.on('before-quit', () => {
        stopFpsMonitor();
        if (perfInterval) { clearInterval(perfInterval); perfInterval = null; }
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
}

// ── IPC Handlers ──
ipcMain.on('resize-window', (event, { width, height }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setSize(Math.round(width), Math.round(height), false);
});

ipcMain.handle('get-running-windows', async () => {
    return await getRunningWindows();
});

ipcMain.handle('select-process', (event, pid) => {
    selectedPid = parseInt(pid) || null;
    if (selectedPid) {
        startFpsMonitor(selectedPid);
    } else {
        stopFpsMonitor();
    }
    return true;
});

ipcMain.handle('get-memory-info', async () => {
    const memory = await process.getProcessMemoryInfo();
    return {
        private: Math.round(memory.private / 1024),
        shared: Math.round(memory.shared / 1024)
    };
});

function tryRegisterOverlayShortcut() {
    const accelerator = currentShortcuts.toggleOverlay;
    if (!accelerator) return false;

    const callback = () => {
        console.log(`[Main] Shortcut triggered: ${accelerator}`);
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            // Toggle the setting only — window stays visible for notifications
            currentSettings.overlayEnabled = !currentSettings.overlayEnabled;
            console.log('[Main] Overlay HUD toggled:', currentSettings.overlayEnabled ? 'ON' : 'OFF');

            // Notify windows to sync UI toggle
            const payload = { ...currentSettings };
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('game-settings-update', payload);
            }
            if (overlayWindow && !overlayWindow.isDestroyed()) {
                overlayWindow.webContents.send('game-settings-update', payload);
            }
        } else {
            console.warn('[Main] Shortcut triggered but overlayWindow is null');
        }
    };

    // Register using the low-level hook ONLY (works in fullscreen games)
    // Do NOT also register with globalShortcut — it would cause double-trigger
    const hookResult = keyboardHook.registerShortcut(accelerator, callback);

    console.log(`[Main] Shortcut registered via hook: ${hookResult}`);
    return hookResult;
}

function registerShortcuts(triggerWindow) {
    // Unregister previous shortcuts from both systems
    globalShortcut.unregisterAll();
    keyboardHook.unregisterAll();
    const results = {};

    if (currentShortcuts.toggleOverlay) {
        let success = tryRegisterOverlayShortcut();

        // Retry once after 500ms if first attempt fails
        if (!success) {
            console.warn(`[Main] First attempt failed for: ${currentShortcuts.toggleOverlay}, retrying in 500ms...`);
            setTimeout(() => {
                globalShortcut.unregisterAll();
                keyboardHook.unregisterAll();
                const retrySuccess = tryRegisterOverlayShortcut();
                console.log(`[Main] Retry result: ${retrySuccess}`);

                if (triggerWindow && !triggerWindow.isDestroyed()) {
                    triggerWindow.webContents.send('shortcuts-registration-status', { toggleOverlay: retrySuccess });
                }
            }, 500);
        }

        results.toggleOverlay = success;
        if (!success) {
            console.warn(`[Main] Failed to register shortcut: ${currentShortcuts.toggleOverlay}`);
        }
    }

    // Send registration results to the triggering window
    if (triggerWindow && !triggerWindow.isDestroyed()) {
        triggerWindow.webContents.send('shortcuts-registration-status', results);
    }

    // Send current shortcut names to overlay so it can display them dynamically
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('shortcuts-update', currentShortcuts);
    }
}

ipcMain.on('user-logged-in', (event, savedSettings) => {
    if (savedSettings) {
        currentSettings = { ...currentSettings, ...savedSettings };
        if (savedSettings.shortcuts) {
            currentShortcuts = { ...currentShortcuts, ...savedSettings.shortcuts };
        }
    }
    registerShortcuts(BrowserWindow.fromWebContents(event.sender));
    createOverlayWindow();
    startPerfLoop();
});

ipcMain.on('user-logged-out', () => {
    currentSettings.overlayEnabled = false;
    globalShortcut.unregisterAll();
    keyboardHook.unregisterAll();
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
    if (perfInterval) { clearInterval(perfInterval); perfInterval = null; }
});

ipcMain.on('update-shortcuts', (event, shortcuts) => {
    currentShortcuts = { ...currentShortcuts, ...shortcuts };
    registerShortcuts(BrowserWindow.fromWebContents(event.sender));
});

ipcMain.on('game-settings-update', (event, settings) => {
    currentSettings = { ...currentSettings, ...settings };
    if (settings.shortcuts) {
        currentShortcuts = { ...currentShortcuts, ...settings.shortcuts };
        registerShortcuts(BrowserWindow.fromWebContents(event.sender));
    }

    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('game-settings-update', currentSettings);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('game-settings-update', currentSettings);
        }
        if (currentSettings.overlayEnabled) {
            if (!overlayWindow.isVisible()) {
                overlayWindow.showInactive();
                overlayWindow.setAlwaysOnTop(true, 'screen-saver');
                overlayWindow.setIgnoreMouseEvents(true, { forward: true });
            }
        } else {
            if (overlayWindow.isVisible()) overlayWindow.hide();
        }
    }
});

ipcMain.on('request-game-settings', (event) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('game-settings-update', currentSettings);
    }
});

// ── Forward notifications from main window to overlay + native Windows popup ──
ipcMain.on('send-notification-to-overlay', (event, notification) => {
    // Forward to overlay window (game overlay toasts)
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('overlay-notification', notification);
    }

    // Show native Windows notification popup (works even when minimized)
    if (Notification.isSupported()) {
        const nativeNotif = new Notification({
            title: notification?.title || 'ElCommunity',
            body: notification?.body || 'Nova notificação',
            icon: path.join(__dirname, 'assets', 'icon.png'),
            silent: false
        });
        nativeNotif.on('click', () => {
            // Bring main window to focus when notification is clicked
            if (mainWindow && !mainWindow.isDestroyed()) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();
            }
        });
        nativeNotif.show();
    }
});
