@echo off
title FinCrew
cd /d "%~dp0"
echo.
echo  FinCrew - Your business. Watched 24/7.
echo.
where node >nul 2>nul
if not errorlevel 1 (
  if not exist node_modules (
    echo  Installing frontend dependencies...
    call npm install
  )
  if exist package.json (
    echo  Building the 3D home page...
    call npm run build
  )
)
python --version >nul 2>nul
if errorlevel 1 (
  echo  Python is not installed. Get it from https://www.python.org/downloads/
  echo  and tick "Add Python to PATH" during setup. Then double-click this file again.
  pause
  exit /b 1
)
if not exist .venv (
  echo  First-time setup, please wait...
  python -m venv .venv
)
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt
if not exist .env copy .env.example .env >nul
start "" cmd /c "timeout /t 3 >nul & start http://localhost:5000"
python server.py
pause
