@echo off
setlocal
cd /d "%~dp0"
node server.cjs
if errorlevel 1 (
  echo.
  echo OneShot local media service stopped with an error.
  pause
)
