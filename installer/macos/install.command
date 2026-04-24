#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

if [[ ! -f "package.json" ]]; then
	echo "[installer] Fehler: package.json wurde nicht gefunden."
	echo "[installer] Bitte den Installer aus dem LyfMark-Projektordner starten."
	if [[ "${LYFMARK_INSTALLER_NO_PAUSE:-0}" != "1" ]]; then
		read -r -n 1 -p "Taste drücken zum Beenden ..."
	fi
	echo
	exit 1
fi

if ! command -v node >/dev/null 2>&1; then
	echo "[installer] Node.js wurde nicht gefunden."
	echo "[installer] Download wird geöffnet: https://nodejs.org/en/download"
	open "https://nodejs.org/en/download" || true
	echo "[installer] Installiere Node.js und starte den Installer danach erneut."
	if [[ "${LYFMARK_INSTALLER_NO_PAUSE:-0}" != "1" ]]; then
		read -r -n 1 -p "Taste drücken zum Beenden ..."
	fi
	echo
	exit 1
fi

set +e
node "tools/installer/wizard.mjs" "$@"
EXIT_CODE=$?
set -e

if [[ ${EXIT_CODE} -ne 0 ]]; then
	echo
	echo "[installer] Der Installer wurde mit Fehlercode ${EXIT_CODE} beendet."
fi

if [[ "${LYFMARK_INSTALLER_NO_PAUSE:-0}" != "1" ]]; then
	read -r -n 1 -p "Taste drücken zum Beenden ..."
fi
echo
exit ${EXIT_CODE}
