@echo off
rem Double-click to start Arentoria Living World and open it in your browser.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.12 or newer is required. Download it from https://nodejs.org and try again.
  pause
  exit /b 1
)
node scripts\launch.mjs %*
if errorlevel 1 pause
