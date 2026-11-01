@echo off
setlocal
REM ==========================================================================
REM  SERVER launcher (Windows) - created at the repo root by the wizard.
REM  For hosting and for OteServerManager (OSM): non-interactive (no prompts,
REM  no pause), runs in the foreground, and exits with the SERVER's exit code so
REM  a crash is never reported as a clean stop.
REM  It does NOT install or build (that is deploy_windows.bat's job) - it checks
REM  they were done, applies pending DB migrations, then starts in production.
REM  The port is app.port in Backend\config.json.
REM ==========================================================================
cd /d "%~dp0"
set "NODE_ENV=production"

node scripts\lib\tasks.mjs server
if errorlevel 1 exit /b 1

cd Backend
node server.js
exit /b %errorlevel%
