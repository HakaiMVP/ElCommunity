using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

class GameMonitor {
    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();
    
    [DllImport("user32.dll")]
    static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }

    static void Main(string[] args) {
        string targetProcess = "x2"; 
        if (args.Length > 0) targetProcess = args[0];

        Console.WriteLine("{\"status\":\"Initializing\",\"monitoring\":\"" + targetProcess + "\"}");

        while (true) {
            try {
                var processes = Process.GetProcessesByName(targetProcess);
                if (processes.Length > 0) {
                    var proc = processes[0];
                    proc.Refresh();
                    
                    float cpu = GetCpuUsage(proc);
                    long ram = proc.WorkingSet64 / 1024 / 1024;
                    
                    // We can't easily get DX FPS without hooks, 
                    // so we compute a "Stability Index" (0-100)
                    // High CPU usage often correlates with frame drops in Elsword (single-core limited)
                    double stability = 100 - (cpu / Environment.ProcessorCount);
                    if (stability < 0) stability = 0;

                    // Output JSON for Electron
                    Console.WriteLine($"{{\"name\":\"{targetProcess}\",\"cpu\":{cpu.ToString("F1")},\"memory\":{ram},\"stability\":{stability.ToString("F0")},\"status\":\"Active\"}}");
                } else {
                    Console.WriteLine("{\"status\":\"Searching\"}");
                }
            } catch (Exception) { }
            Thread.Sleep(1000);
        }
    }

    static float GetCpuUsage(Process proc) {
        try {
            var startTime = DateTime.UtcNow;
            var startCpuUsage = proc.TotalProcessorTime;
            Thread.Sleep(500);
            var endTime = DateTime.UtcNow;
            var endCpuUsage = proc.TotalProcessorTime;
            var cpuUsedMs = (endCpuUsage - startCpuUsage).TotalMilliseconds;
            var totalMsPassed = (endTime - startTime).TotalMilliseconds;
            var cpuUsageTotal = cpuUsedMs / totalMsPassed; // Overall usage relative to 1 core
            return (float)(cpuUsageTotal * 100);
        } catch { return 0; }
    }
}
