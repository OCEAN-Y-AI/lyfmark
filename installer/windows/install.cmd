@echo off
setlocal

cd /d "%~dp0\..\.."

if not exist "package.json" (
	echo [installer] Fehler: package.json wurde nicht gefunden.
	echo [installer] Bitte den Installer aus dem LyfMark-Projektordner starten.
	if not "%LYFMARK_INSTALLER_NO_PAUSE%"=="1" pause
	exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
	echo [installer] Node.js wurde nicht gefunden.
	echo [installer] Download wird geoeffnet: https://nodejs.org/en/download
	start "" "https://nodejs.org/en/download"
	echo [installer] Installiere Node.js und starte den Installer danach erneut.
	if not "%LYFMARK_INSTALLER_NO_PAUSE%"=="1" pause
	exit /b 1
)

node "tools\installer\wizard.mjs" %*
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
	echo.
	echo [installer] Der Installer wurde mit Fehlercode %EXIT_CODE% beendet.
)

if not "%LYFMARK_INSTALLER_NO_PAUSE%"=="1" pause
exit /b %EXIT_CODE%
