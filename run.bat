@echo off
setlocal
REM ==========================================================================
REM  Run launcher for the Fastify + React template.
REM  - Installs backend + frontend dependencies on first run (if missing).
REM  - Builds the React frontend into Backend/public/dist (Fastify serves it).
REM  - Starts the Fastify backend, which serves the API AND the built frontend
REM    from a single origin (http://localhost:3000).
REM  Just double-click this file, or run "run.bat" from any terminal.
REM ==========================================================================

set "ROOT=%~dp0"

REM --- Install backend deps if missing ---
if not exist "%ROOT%Backend\node_modules" (
  echo Installing backend dependencies ^(first run^)...
  pushd "%ROOT%Backend" && call npm install && popd
)

REM --- Install frontend deps if missing ---
if not exist "%ROOT%Frontend\node_modules" (
  echo Installing frontend dependencies ^(first run^)...
  pushd "%ROOT%Frontend" && call npm install && popd
)

REM --- Build the frontend so Fastify has assets to serve ---
echo Building frontend into Backend/public/dist...
pushd "%ROOT%Frontend" && call npm run build && popd

REM --- Start the Fastify backend (serves API + built frontend) ---
echo Starting Fastify backend on http://localhost:3000 ...
pushd "%ROOT%Backend" && call npm start
endlocal
