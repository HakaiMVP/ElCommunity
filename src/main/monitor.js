const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { spawn } = require('child_process');
const path = require('path');

/**
 * Gets performance stats for Elsword (x2.exe)
 * @param {string|number} selectedPid Optional PID to force monitor
 */
async function getGameStats(selectedPid = null) {
    try {
        let targetId = selectedPid;
        let targetRam = 0;
        let targetName = 'x2.exe';

        if (!targetId) {
            // Auto-detect Elsword via tasklist
            const { stdout } = await execPromise('tasklist /v /fo csv /nh /fi "IMAGENAME eq x2.exe"', { windowsHide: true });
            if (stdout) {
                const lines = stdout.trim().split('\n');
                for (const line of lines) {
                    const parts = line.split('","').map(p => p.replace(/"/g, ''));
                    if (parts.length < 9) continue;

                    const pid = parts[1];
                    const ramStr = parts[4].replace(/[^\d]/g, '');
                    const ram = parseInt(ramStr) || 0;
                    const title = parts[8];

                    if (title.toLowerCase().includes('elsword')) {
                        targetId = pid;
                        targetRam = ram;
                        break;
                    }
                }
            }
        } else {
            // Validate if selected PID still exists and get its RAM
            const { stdout } = await execPromise(`tasklist /fi "PID eq ${targetId}" /fo csv /nh`, { windowsHide: true });
            if (stdout && stdout.includes(targetId)) {
                const parts = stdout.split('","').map(p => p.replace(/"/g, ''));
                const ramStr = parts[4].replace(/[^\d]/g, '');
                targetRam = parseInt(ramStr) || 0;
                targetName = parts[0];
            } else {
                return null;
            }
        }

        if (targetId) {
            // Get CPU Usage
            const cpuCmd = `powershell -Command "(Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -Filter 'IDProcess = ${targetId}' -ErrorAction SilentlyContinue).PercentProcessorTime"`;
            const { stdout: cpuOut } = await execPromise(cpuCmd);
            let cpuValue = parseInt(cpuOut.trim()) || 0;

            const cores = parseInt(process.env.NUMBER_OF_PROCESSORS) || 1;
            cpuValue = Math.round(cpuValue / cores);

            return {
                name: targetName,
                pid: targetId,
                memory: Math.round(targetRam / 1024),
                cpu: cpuValue,
                status: 'Active'
            };
        }
    } catch (error) {
        // Silent fail
    }
    return null;
}

/**
 * Gets a list of all visible windows for manual selection
 */
async function getRunningWindows() {
    try {
        const { stdout } = await execPromise('tasklist /v /fo csv /nh /fi "STATUS eq RUNNING"', { windowsHide: true });
        if (!stdout) return [];

        const lines = stdout.trim().split('\n');
        const processes = lines.map(line => {
            const parts = line.split('","').map(p => p.replace(/"/g, ''));
            if (parts.length < 9) return null;

            // Parse Memory Usage (e.g., "123,456 K")
            const memStr = parts[4].replace(/[^\d]/g, '');
            const memory = parseInt(memStr) || 0;

            return {
                name: parts[0],
                pid: parts[1],
                title: parts[8],
                memory: memory
            };
        }).filter(p => p && p.title && p.title !== 'N/A' && p.title.trim().length > 0);

        // Sort by Memory Usage (Descending)
        return processes.sort((a, b) => b.memory - a.memory);
    } catch (e) {
        return [];
    }
}

/**
 * Gets Global System Stats, GPU Usage, and Disk Usage — ALL IN ONE PowerShell call
 * This drastically reduces the number of child processes (from 5 separate PowerShell
 * invocations down to 1).
 */
async function getAllSystemStats() {
    try {
        const cmd = `powershell -NoProfile -Command "` +
            `$cpu = (Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter \\"Name='_Total'\\").PercentProcessorTime; ` +
            `$os = Get-CimInstance Win32_OperatingSystem; ` +
            `$free = $os.FreePhysicalMemory; ` +
            `$total = $os.TotalVisibleMemorySize; ` +
            `$gpu = 0; try { $gpu = (Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction SilentlyContinue | Measure-Object -Property UtilizationPercentage -Maximum).Maximum } catch {}; ` +
            `$d = Get-CimInstance Win32_LogicalDisk -Filter 'DeviceID=''C:'''; ` +
            `$disk = [math]::Round(($d.Size - $d.FreeSpace) / $d.Size * 100); ` +
            `$cpu, $free, $total, $gpu, $disk -join '|'"`;

        const { stdout } = await execPromise(cmd, { windowsHide: true });
        const parts = stdout.trim().split('|');

        const cpu = parseInt(parts[0]) || 0;
        const freeKb = parseInt(parts[1]) || 0;
        const totalKb = parseInt(parts[2]) || 1;
        const gpu = parseInt(parts[3]) || 0;
        const disk = parseInt(parts[4]) || 0;
        const ramPercent = Math.round(((totalKb - freeKb) / totalKb) * 100);

        return {
            totalCpu: cpu,
            ramPercent: ramPercent,
            freeMb: Math.round(freeKb / 1024),
            gpuPercent: gpu,
            diskPercent: disk
        };
    } catch (e) {
        return { totalCpu: 0, ramPercent: 0, freeMb: 0, gpuPercent: 0, diskPercent: 0 };
    }
}

// Keep individual functions as wrappers for backward compatibility
async function getSystemStats() {
    const stats = await getAllSystemStats();
    return { totalCpu: stats.totalCpu, ramPercent: stats.ramPercent, freeMb: stats.freeMb };
}
async function getGpuUsage() {
    return 0; // Now fetched via getAllSystemStats
}
async function getDiskUsage() {
    return 0; // Now fetched via getAllSystemStats
}

// ============================================
// Direct PresentMon FPS Monitoring (Node.js)
// No Python dependency — spawns PresentMon.exe directly
// ============================================

const { app } = require('electron'); // Need app for getting paths

// Enhanced Logging
const logPath = path.join(app.getPath('userData'), 'fps-monitor.log');
function logToFile(msg) {
    const time = new Date().toISOString();
    const logLine = `[${time}] ${msg}\n`;
    console.log(msg); // Keep console log
    try {
        require('fs').appendFileSync(logPath, logLine);
    } catch (e) { /* ignore */ }
}

// Correct path handling for ASAR
let PRESENTMON_PATH = path.join(__dirname, 'tools', 'PresentMon.exe');
if (app.isPackaged) {
    PRESENTMON_PATH = PRESENTMON_PATH.replace('app.asar', 'app.asar.unpacked');
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const STALE_TIMEOUT_MS = 3000;
const FPS_HISTORY_SIZE = 10;

let presentmonProcess = null;
let currentFps = 0;
let fpsMonitorPid = null;
let isStarting = false;
let retryCount = 0;
let retryTimer = null;
let staleTimer = null;
let fpsHistory = [];
let csvHeaderColumns = null;
let lastFpsUpdate = 0;

/**
 * Starts PresentMon directly for a specific process PID
 * @param {number|string} pid - The process ID to monitor
 */
function startFpsMonitor(pid) {
    pid = Number(pid);
    // Already monitoring this PID
    if (fpsMonitorPid === pid && presentmonProcess) return;
    // Prevent race conditions from multiple rapid calls
    if (isStarting && fpsMonitorPid === pid) return;

    stopFpsMonitor();
    fpsMonitorPid = pid;
    currentFps = 0;
    retryCount = 0;

    _launchPresentMon(pid);
}

/**
 * Internal: launch the PresentMon.exe process
 */
function _launchPresentMon(pid) {
    if (isStarting) return;
    isStarting = true;

    // Reset parsing state
    csvHeaderColumns = null;
    fpsHistory = [];
    lastFpsUpdate = 0;

    const fs = require('fs');

    logToFile(`[FPS Monitor] Checking path: ${PRESENTMON_PATH}`);

    if (!fs.existsSync(PRESENTMON_PATH)) {
        logToFile(`[FPS Monitor] ERROR: PresentMon.exe not found at: ${PRESENTMON_PATH}`);
        currentFps = -1;
        isStarting = false;
        return;
    }

    logToFile(`[FPS Monitor] Starting PresentMon for PID ${pid} (attempt ${retryCount + 1}/${MAX_RETRIES})`);

    try {
        presentmonProcess = spawn(PRESENTMON_PATH, [
            '--process_id', String(pid),
            '--output_stdout',
            '--no_console_stats',
            '--terminate_on_proc_exit',
            '--stop_existing_session'
        ], {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        });

        let lineBuffer = '';

        presentmonProcess.stdout.on('data', (chunk) => {
            // logToFile(`[FPS Monitor] stdout chunk received`); // Too verbose
            lineBuffer += chunk.toString();
            // ... strict buffer parsing ...

            const lines = lineBuffer.split('\n');
            // Keep the last incomplete line in buffer
            lineBuffer = lines.pop() || '';

            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line) continue;
                _processLine(line);
            }
        });

        presentmonProcess.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) logToFile(`[FPS Monitor] stderr: ${msg}`);
        });

        presentmonProcess.on('error', (err) => {
            logToFile(`[FPS Monitor] Failed to spawn PresentMon: ${err.message}`);
            currentFps = -1;
            presentmonProcess = null;
            isStarting = false;
        });

        presentmonProcess.on('exit', (code) => {
            logToFile(`[FPS Monitor] PresentMon exited with code ${code}`);
            presentmonProcess = null;
            isStarting = false;
            _clearStaleTimer();

            // Auto-restart if we were still supposed to be monitoring this PID
            if (fpsMonitorPid === pid) {
                currentFps = 0;
                retryCount++;
                if (retryCount < MAX_RETRIES) {
                    logToFile(`[FPS Monitor] Auto-restarting in ${RETRY_DELAY_MS}ms...`);
                    retryTimer = setTimeout(() => {
                        if (fpsMonitorPid === pid) {
                            _launchPresentMon(pid);
                        }
                    }, RETRY_DELAY_MS);
                } else {
                    logToFile('[FPS Monitor] Max retries reached, giving up.');
                    currentFps = -1;
                }
            }
        });

        isStarting = false;
        _startStaleTimer();
        logToFile('[FPS Monitor] PresentMon spawned successfully');

    } catch (e) {
        logToFile(`[FPS Monitor] Exception starting PresentMon: ${e.message}`);
        currentFps = -1;
        isStarting = false;
    }
}

/**
 * Process a single line from PresentMon CSV output
 */
function _processLine(line) {
    // Detect CSV header line
    if (!csvHeaderColumns && line.includes('Application') && line.includes('MsBetweenPresents')) {
        csvHeaderColumns = line.split(',').map(col => col.trim());
        console.log('[FPS Monitor] CSV header detected, columns:', csvHeaderColumns.length);
        return;
    }

    // Skip lines before header is found
    if (!csvHeaderColumns) return;

    // Parse data line
    const values = line.split(',').map(v => v.trim());
    if (values.length < csvHeaderColumns.length) return;

    // Find MsBetweenPresents column index
    const msIndex = csvHeaderColumns.indexOf('MsBetweenPresents');
    if (msIndex === -1) return;

    const msValue = parseFloat(values[msIndex]);
    if (isNaN(msValue) || msValue <= 0) return;

    const instantFps = 1000.0 / msValue;

    // Add to rolling history
    fpsHistory.push(instantFps);
    if (fpsHistory.length > FPS_HISTORY_SIZE) {
        fpsHistory.shift();
    }

    // Calculate rolling average
    const avgFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
    currentFps = Math.round(avgFps * 10) / 10; // 1 decimal place
    lastFpsUpdate = Date.now();

    // Reset retry count on successful data
    retryCount = 0;
}

/**
 * Start a timer that resets FPS to 0 if no data arrives for STALE_TIMEOUT_MS
 */
function _startStaleTimer() {
    _clearStaleTimer();
    staleTimer = setInterval(() => {
        if (lastFpsUpdate > 0 && (Date.now() - lastFpsUpdate) > STALE_TIMEOUT_MS) {
            currentFps = 0;
            fpsHistory = [];
        }
    }, 1000);
}

function _clearStaleTimer() {
    if (staleTimer) {
        clearInterval(staleTimer);
        staleTimer = null;
    }
}

/**
 * Stops the FPS monitor
 */
function stopFpsMonitor() {
    // Clear retry timer
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }
    _clearStaleTimer();

    if (presentmonProcess) {
        try {
            presentmonProcess.kill();
            console.log('[FPS Monitor] PresentMon terminated');
        } catch (e) {
            console.error('[FPS Monitor] Error stopping PresentMon:', e.message);
        }
        presentmonProcess = null;
    }
    fpsMonitorPid = null;
    currentFps = 0;
    fpsHistory = [];
    csvHeaderColumns = null;
    isStarting = false;
    retryCount = 0;
    lastFpsUpdate = 0;
}

/**
 * Returns the current measured game FPS
 */
function getCurrentFps() {
    return currentFps;
}

module.exports = {
    getGameStats,
    getRunningWindows,
    getSystemStats,
    getGpuUsage,
    getDiskUsage,
    getAllSystemStats,
    startFpsMonitor,
    stopFpsMonitor,
    getCurrentFps
};
