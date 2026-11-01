@echo off
setlocal
REM ==========================================================================
REM  DEV launcher (Windows) - created at the repo root by the wizard.
REM  Installs deps if package.json changed, builds the frontend, applies DB
REM  migrations, then runs the server in THIS window (Ctrl+C to stop).
REM  No watch mode: after changing code, stop it and run it again.
REM  The port is app.port in Backend\config.json.
REM  For hosting / OteServerManager use server_windows.bat instead.
REM ==========================================================================
cd /d "%~dp0"

node scripts\lib\tasks.mjs dev
if errorlevel 1 goto failed

cd Backend
node server.js
set "CODE=%errorlevel%"
if not "%CODE%"=="0" (
  echo.
  echo Server stopped with exit code %CODE%.
  pause
)
exit /b %CODE%

:failed
echo.
echo A setup step failed - the server was NOT started. See the message above.
pause
exit /b 1
