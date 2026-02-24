/**
 * Low-level keyboard shortcut detection via GetAsyncKeyState polling.
 * 
 * Unlike SetWindowsHookEx (WH_KEYBOARD_LL) or Electron's globalShortcut
 * (RegisterHotKey), GetAsyncKeyState reads the PHYSICAL state of keys
 * directly from the hardware input buffer. It works regardless of:
 *   - Which window has focus
 *   - Fullscreen exclusive DirectX mode
 *   - Anti-cheat systems (GameGuard, XignCode, etc.)
 *
 * The polling interval of 50ms gives sub-100ms response time.
 *
 * Usage:
 *   const hook = require('./keyboardHook');
 *   hook.registerShortcut('toggleOverlay', "Alt+'", () => { ... });
 *   hook.start();           // begins polling
 *   hook.unregisterAll();   // clears all shortcuts
 *   hook.stop();            // stops polling
 */

const koffi = require('koffi');

// ── Load user32.dll ──
const user32 = koffi.load('user32.dll');
const GetAsyncKeyState = user32.func('__stdcall', 'GetAsyncKeyState', 'short', ['int']);

// ── Virtual-Key Codes ──
const VK_LSHIFT = 0xA0;
const VK_RSHIFT = 0xA1;
const VK_LCONTROL = 0xA2;
const VK_RCONTROL = 0xA3;
const VK_LMENU = 0xA4;   // Left Alt
const VK_RMENU = 0xA5;   // Right Alt
const VK_LWIN = 0x5B;
const VK_RWIN = 0x5C;

// Accelerator key name → VK code
const KEY_MAP = {
    // Letters A-Z
    ...Object.fromEntries(Array.from({ length: 26 }, (_, i) => [String.fromCharCode(65 + i), 0x41 + i])),
    // Digits 0-9
    ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), 0x30 + i])),
    // F-keys F1-F24
    ...Object.fromEntries(Array.from({ length: 24 }, (_, i) => [`F${i + 1}`, 0x70 + i])),
    // Special keys
    'SPACE': 0x20, 'RETURN': 0x0D, 'ENTER': 0x0D, 'TAB': 0x09,
    'BACKSPACE': 0x08, 'DELETE': 0x2E, 'INSERT': 0x2D,
    'ESC': 0x1B, 'ESCAPE': 0x1B,
    'HOME': 0x24, 'END': 0x23, 'PAGEUP': 0x21, 'PAGEDOWN': 0x22,
    'UP': 0x26, 'DOWN': 0x28, 'LEFT': 0x25, 'RIGHT': 0x27,
    'PLUS': 0xBB, '=': 0xBB, '-': 0xBD, 'MINUS': 0xBD,
    ',': 0xBC, '.': 0xBE, '/': 0xBF, '\\': 0xDC,
    ';': 0xBA, "'": 0xDE, '`': 0xC0,
    '[': 0xDB, ']': 0xDD,
    'NUMLOCK': 0x90,
    'NUM0': 0x60, 'NUM1': 0x61, 'NUM2': 0x62, 'NUM3': 0x63,
    'NUM4': 0x64, 'NUM5': 0x65, 'NUM6': 0x66, 'NUM7': 0x67,
    'NUM8': 0x68, 'NUM9': 0x69,
    'NUMADD': 0x6B, 'NUMSUB': 0x6D, 'NUMMULT': 0x6A, 'NUMDIV': 0x6F, 'NUMDEC': 0x6E,
};

// ── State ──
const POLL_INTERVAL_MS = 50;
let pollTimer = null;
const registeredShortcuts = new Map(); // name → { mods, vk, callback, wasDown }

/**
 * Check if a key is currently pressed.
 * GetAsyncKeyState returns a SHORT where the high bit (0x8000) = key is DOWN.
 */
function isKeyDown(vk) {
    return (GetAsyncKeyState(vk) & 0x8000) !== 0;
}

/**
 * Check if Ctrl is pressed (either side).
 */
function isCtrlDown() {
    return isKeyDown(VK_LCONTROL) || isKeyDown(VK_RCONTROL);
}

/**
 * Check if Alt is pressed (either side).
 */
function isAltDown() {
    return isKeyDown(VK_LMENU) || isKeyDown(VK_RMENU);
}

/**
 * Check if Shift is pressed (either side).
 */
function isShiftDown() {
    return isKeyDown(VK_LSHIFT) || isKeyDown(VK_RSHIFT);
}

/**
 * Check if Win/Super is pressed (either side).
 */
function isMetaDown() {
    return isKeyDown(VK_LWIN) || isKeyDown(VK_RWIN);
}

/**
 * Parse an Electron-style accelerator string.
 * Example: "Alt+'" → { ctrl: false, alt: true, shift: false, meta: false, vk: 0xDE }
 */
function parseAccelerator(accel) {
    const parts = accel.split('+');
    const mods = { ctrl: false, alt: false, shift: false, meta: false };
    let keyPart = null;

    for (const part of parts) {
        const upper = part.toUpperCase().trim();
        if (upper === 'COMMANDORCONTROL' || upper === 'CTRL' || upper === 'CONTROL') {
            mods.ctrl = true;
        } else if (upper === 'ALT') {
            mods.alt = true;
        } else if (upper === 'SHIFT') {
            mods.shift = true;
        } else if (upper === 'SUPER' || upper === 'META' || upper === 'WIN') {
            mods.meta = true;
        } else {
            keyPart = upper;
        }
    }

    if (!keyPart) return null;

    const vk = KEY_MAP[keyPart];
    if (vk === undefined) {
        console.warn(`[KeyboardHook] Unknown key in accelerator: "${keyPart}"`);
        return null;
    }

    return { mods, vk };
}

/**
 * Polling function — checks all registered shortcuts every tick.
 * Uses edge detection (trigger on keyDown transition, not while held).
 */
function pollKeys() {
    for (const [name, shortcut] of registeredShortcuts) {
        const mainKeyDown = isKeyDown(shortcut.vk);
        const modsMatch =
            shortcut.mods.ctrl === isCtrlDown() &&
            shortcut.mods.alt === isAltDown() &&
            shortcut.mods.shift === isShiftDown() &&
            shortcut.mods.meta === isMetaDown();

        const isActive = mainKeyDown && modsMatch;

        // Edge detection: trigger only on the transition from NOT pressed → pressed
        if (isActive && !shortcut.wasDown) {
            console.log(`[KeyboardHook] Shortcut triggered: ${name} (${shortcut.accelerator})`);
            try {
                shortcut.callback();
            } catch (e) {
                console.error(`[KeyboardHook] Error in callback for "${name}":`, e);
            }
        }

        shortcut.wasDown = isActive;
    }
}

/**
 * Register a named shortcut.
 * @param {string} name         Unique name (e.g. 'toggleOverlay')
 * @param {string} accelerator  Electron-style accelerator (e.g. "Alt+'")
 * @param {Function} callback   Function to call when shortcut fires
 * @returns {boolean}
 */
function registerShortcut(accelerator, callback) {
    const parsed = parseAccelerator(accelerator);
    if (!parsed) return false;

    registeredShortcuts.set(accelerator, {
        accelerator,
        mods: parsed.mods,
        vk: parsed.vk,
        callback,
        wasDown: false,
    });
    console.log(`[KeyboardHook] Registered: "${accelerator}" → VK 0x${parsed.vk.toString(16).toUpperCase()}`);
    return true;
}

/**
 * Unregister all shortcuts.
 */
function unregisterAll() {
    registeredShortcuts.clear();
    console.log('[KeyboardHook] All shortcuts cleared');
}

/**
 * Start the polling loop. Call once at app startup.
 */
function start() {
    if (pollTimer) {
        console.log('[KeyboardHook] Already running');
        return;
    }
    pollTimer = setInterval(pollKeys, POLL_INTERVAL_MS);
    console.log(`[KeyboardHook] Polling started (${POLL_INTERVAL_MS}ms interval)`);
}

/**
 * Stop the polling loop. Call at app shutdown.
 */
function stop() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
        console.log('[KeyboardHook] Polling stopped');
    }
    registeredShortcuts.clear();
}

module.exports = { registerShortcut, unregisterAll, start, stop };
