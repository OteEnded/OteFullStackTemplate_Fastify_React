@echo off
setlocal
REM ==========================================================================
REM  Setup wizard (Windows). Run once after cloning; re-runnable.
REM  The logic lives in scripts\wizard.mjs (shared with wizard.sh).
REM ==========================================================================
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 or newer is required - install it from https://nodejs.org and run the wizard again.
  pause
  exit /b 1
)

node scripts\wizard.mjs %*
set "CODE=%errorlevel%"
pause
exit /b %CODE%
