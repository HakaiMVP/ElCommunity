@echo off
title ElCommunity Installer Builder
cd /d "%~dp0"

echo ==========================================
echo      ElCommunity Installer Builder
echo ==========================================
echo.
echo Cleaning up previous builds...
rmdir /s /q dist release 2>nul
echo.
echo Starting Build Process...
echo This may take a few minutes. Please wait.
echo.

call npm run build:win

if %errorlevel% neq 0 (
    echo.
    echo ==========================================
    echo [ERROR] Build Failed!
    echo ==========================================
    echo.
    echo Please check the error messages above.
    pause
    exit /b %errorlevel%
)

echo.
echo ==========================================
echo [SUCCESS] Build Complete!
echo ==========================================
echo.
echo The installer can be found in the 'release' folder.
echo.
pause
