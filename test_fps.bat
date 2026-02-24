@echo off
echo ========================================
echo ElCommunity FPS Monitor - Test Script
echo ========================================
echo.

echo [1/4] Cleaning up old PresentMon processes...
powershell -Command "Get-Process -Name PresentMon -ErrorAction SilentlyContinue | Stop-Process -Force"
timeout /t 1 /nobreak >nul

echo [2/4] Checking if game is running...
powershell -Command "Get-Process -Name x2 -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, MainWindowTitle"

echo.
echo [3/4] Cleaning temp CSV file...
del "%TEMP%\el-osd-fps.csv" 2>nul

echo.
echo [4/4] Starting ElCommunity...
echo.
echo ========================================
echo Watch the console for these messages:
echo   - [FPS Monitor] Starting PresentMon
echo   - [FPS Monitor] PresentMon spawned
echo   - [FPS Monitor] FPS calculated: XX
echo ========================================
echo.

npm start
