@echo off
echo ========================================
echo ElCommunity - Admin Mode
echo ========================================
echo.
echo Este script inicia o ElCommunity com privilegios de administrador
echo para permitir o uso do PresentMon para monitoramento preciso de FPS.
echo.
echo IMPORTANTE: Voce vera um prompt UAC - clique em "Sim" para continuar.
echo.
pause

echo.
echo [1/2] Limpando processos antigos do PresentMon...
powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList '-Command', 'Get-Process -Name PresentMon -ErrorAction SilentlyContinue | Stop-Process -Force' -Wait"
timeout /t 2 /nobreak >nul

echo [2/2] Iniciando ElCommunity como Administrador...
powershell -Command "Start-Process cmd -Verb RunAs -ArgumentList '/c cd /d %CD% && npm start'"

echo.
echo ========================================
echo Aplicacao iniciada em modo administrador!
echo Verifique a nova janela que foi aberta.
echo ========================================
pause
