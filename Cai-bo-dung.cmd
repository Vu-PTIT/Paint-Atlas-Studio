@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  py -3.12 -m venv .venv
  if errorlevel 1 goto :failed
)
".venv\Scripts\python.exe" -m pip install -r backend\requirements.lock
if errorlevel 1 goto :failed
".venv\Scripts\python.exe" -m playwright install chromium
if errorlevel 1 goto :failed
call npm --prefix frontend ci
if errorlevel 1 goto :failed
type nul > ".venv\paint-atlas-installed-v1"
echo The scene builder is ready. Open Mo-Studio.cmd to launch the studio.
pause
exit /b 0
:failed
echo Check Python 3.12, Node.js 24 and the command output above.
pause
exit /b 1
