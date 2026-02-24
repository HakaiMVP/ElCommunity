# Lightweight foreground window PID detector
# Pre-compiles the C# type once, then loops efficiently
try {
    Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class FgWin {
        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
        public static uint GetForegroundPid() {
            uint pid = 0;
            GetWindowThreadProcessId(GetForegroundWindow(), out pid);
            return pid;
        }
    }
"@
}
catch {
    # Type already loaded in this session
}

# Output the foreground PID every 500ms
while ($true) {
    try {
        $pid = [FgWin]::GetForegroundPid()
        [Console]::Out.WriteLine($pid)
        [Console]::Out.Flush()
    }
    catch {
        [Console]::Out.WriteLine(0)
        [Console]::Out.Flush()
    }
    Start-Sleep -Milliseconds 500
}
