@echo off
setlocal
REM ==========================================================================
REM  DEPLOY (Windows): bring this clone up to date WITHOUT starting it.
REM  git pull (fast-forward only) - install deps if package.json changed -
REM  build the frontend - apply DB migrations. Stops at the first failure with
REM  a non-zero exit code. Then restart the server (OteServerManager, or
REM  server_windows.bat at the repo root).
REM ==========================================================================
cd /d "%~dp0.."

git pull --ff-only
if errorlevel 1 (
  echo git pull failed - nothing was changed after it.
  exit /b 1
)

node scripts\lib\tasks.mjs deploy
exit /b %errorlevel%
