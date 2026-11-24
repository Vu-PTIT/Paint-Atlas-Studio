@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  py -3.12 -m venv .venv
  if errorlevel 1 goto :failed
)
if not exist ".venv\paint-atlas-installed-v1" (
  ".venv\Scripts\python.exe" -m pip install -r backend\requirements.lock
  if errorlevel 1 goto :failed
  type nul > ".venv\paint-atlas-installed-v1"
)
".venv\Scripts\python.exe" run_studio.py --open
if errorlevel 1 goto :failed
exit /b 0
:failed
echo Studio could not start. Check Python 3.12 and the command output above.
pause
exit /b 1
