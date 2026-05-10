@echo off
title Verification Bot
cd /d "%~dp0"
echo ========================================
echo    Verification Bot - Iniciando...
echo ========================================
echo.
npm run deploy
echo.
echo Comandos registrados. Iniciando bot...
echo.
npm start
pause
