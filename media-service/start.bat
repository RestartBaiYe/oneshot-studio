@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18+ is required. Install it and reopen this window.
  pause
  exit /b 1
)
if not defined ONESHOT_PORT set ONESHOT_PORT=41739
echo Open http://127.0.0.1:%ONESHOT_PORT% in your browser after the service starts.
echo Keep this window open. Press Ctrl+C to stop.
node server.cjs
if errorlevel 1 pause
