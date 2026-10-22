@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Convert needs Node.js 22 or newer on PATH.
  pause
  exit /b 1
)
if not exist "%~dp0node_modules\@convert\core\package.json" (
  call npm install --no-fund --no-audit
  if errorlevel 1 exit /b 1
)
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apps\windows\window.ps1"
) else (
  node --disable-warning=ExperimentalWarning --experimental-strip-types "%~dp0apps\windows\src\host.ts" %*
)
