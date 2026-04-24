#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

if [[ ! -f "package.json" ]]; then
	echo "[installer] Fehler: package.json wurde nicht gefunden."
	echo "[installer] Bitte den Installer aus dem LyfMark-Projektordner starten."
	exit 1
fi

if ! command -v node >/dev/null 2>&1; then
	echo "[installer] Node.js wurde nicht gefunden."
	echo "[installer] Download: https://nodejs.org/en/download"
	echo "[installer] Installiere Node.js und starte den Installer danach erneut."
	exit 1
fi

node "tools/installer/wizard.mjs" "$@"
