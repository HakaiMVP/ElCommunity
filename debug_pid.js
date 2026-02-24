const koffi = require('koffi');
const user32 = koffi.load('user32.dll');

// Define types correctly for Windows API
// BOOL is int (4 bytes), not bool (1 byte)
const GetForegroundWindow = user32.func('void* __stdcall GetForegroundWindow()');
const GetWindowThreadProcessId = user32.func('uint32 __stdcall GetWindowThreadProcessId(void* hwnd, uint32* pid)');

function getForegroundPid() {
    try {
        const hwnd = GetForegroundWindow();
        if (!hwnd) {
            console.log('No foreground window');
            return 0;
        }
        const pidBuffer = Buffer.alloc(4);
        GetWindowThreadProcessId(hwnd, pidBuffer);
        return pidBuffer.readUInt32LE(0);
    } catch (e) {
        console.error('Error:', e);
        return 0;
    }
}

console.log('--- Debugging Foreground PID ---');
setInterval(() => {
    const pid = getForegroundPid();
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] Foreground PID: ${pid}`);
}, 1000);
