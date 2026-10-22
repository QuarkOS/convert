@echo off
setlocal
cd /d "%~dp0"
set "NODE=%~dp0runtime\node.exe"
if not exist "%NODE%" (
  echo Convert's included runtime is missing.
  pause
  exit /b 1
)
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apps\windows\window.ps1"
) else if exist "%~dp0apps\windows\host.mjs" (
  "%NODE%" --disable-warning=ExperimentalWarning "%~dp0apps\windows\host.mjs" %*
) else (
  "%NODE%" --disable-warning=ExperimentalWarning --experimental-strip-types "%~dp0apps\windows\src\host.ts" %*
)
