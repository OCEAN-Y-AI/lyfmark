@echo off
setlocal

cd /d "%~dp0\..\.."

if not exist "package.json" (
	echo [installer] Error: package.json was not found.
	echo [installer] Start this installer from the LyfMark project folder.
	if not "%LYFMARK_INSTALLER_NO_PAUSE%"=="1" pause
	exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
	echo [installer] Node.js was not found.
	echo [installer] Opening download page: https://nodejs.org/en/download
	start "" "https://nodejs.org/en/download"
	echo [installer] Install Node.js and start the installer again.
	if not "%LYFMARK_INSTALLER_NO_PAUSE%"=="1" pause
	exit /b 1
)

node "tools\installer\wizard.mjs" %*
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
	echo.
	echo [installer] The installer exited with error code %EXIT_CODE%.
)

if not "%LYFMARK_INSTALLER_NO_PAUSE%"=="1" pause
exit /b %EXIT_CODE%
