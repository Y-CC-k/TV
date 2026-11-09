@echo off
rem Registers (or removes) auto-start at login for the TvWall package.
rem Usage:
rem   install-autorun.bat            -> register auto-start
rem   install-autorun.bat remove     -> remove auto-start
rem Notes:
rem   - Registers HKCU Run key (current user only, no admin needed).
rem   - Starts after user login; enable auto-login on TV machines to
rem     make it fully hands-off after a reboot.
rem   - The launcher picks the newest TvWall-*.exe in release\win-unpacked,
rem     so re-packaging does not break auto-start.
setlocal

rem Allow running from inside the package folder or from the project root
set "APPDIR=%~dp0"
if not exist "%APPDIR%resources\app.asar" set "APPDIR=%~dp0release\win-unpacked\"

if /i "%~1"=="remove" (
  reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v TvWall /f >nul 2>&1 && echo [OK] Auto-start removed. || echo [INFO] Auto-start was not registered - nothing to remove.
  pause
  exit /b 0
)

if not exist "%APPDIR%resources\app.asar" (
  echo [ERROR] Package not found: %APPDIR%
  echo Run "npm run dist" first, or place install-autorun.bat next to "release".
  pause
  exit /b 1
)

if not exist "%APPDIR%start-tvwall.vbs" copy /y "%~dp0start-tvwall.vbs" "%APPDIR%\" >nul

reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v TvWall /t REG_SZ /d "wscript.exe \"%APPDIR%start-tvwall.vbs\"" /f >nul

echo [OK] Auto-start registered:
echo        key : HKCU ...Run / TvWall
echo        path: %APPDIR%start-tvwall.vbs
pause
