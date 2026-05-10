@echo off
title BLACKCOIN - Inicio Rapido
cd /d "%~dp0"
echo ========================================
echo    BLACKCOIN - Iniciando todo el
echo    proyecto (Node + Discord Bot)
echo ========================================
echo.
powershell.exe -ExecutionPolicy Bypass -File "%~dp0start-all.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Ocurrio un error. Revisa los logs.
    pause
)
