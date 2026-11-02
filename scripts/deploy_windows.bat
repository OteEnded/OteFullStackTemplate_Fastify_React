@echo off
setlocal
REM ==========================================================================
REM  DEPLOY (Windows): bring this clone up to date WITHOUT starting it.
REM  git pull (fast-forward only, refuses a clone with local changes) - install
REM  deps if package.json changed - build the frontend - apply DB migrations.
REM  Stops at the first failure with a non-zero exit code. Then restart the
REM  server (OteServerManager, or server_windows.bat at the repo root).
REM ==========================================================================
cd /d "%~dp0.."

node scripts\lib\tasks.mjs deploy
exit /b %errorlevel%
