#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

if [[ ! -f "package.json" ]]; then
	echo "[installer] Error: package.json was not found."
	echo "[installer] Start this installer from the LyfMark project folder."
	exit 1
fi

if ! command -v node >/dev/null 2>&1; then
	echo "[installer] Node.js was not found."
	echo "[installer] Download: https://nodejs.org/en/download"
	echo "[installer] Install Node.js and start the installer again."
	exit 1
fi

node "tools/installer/wizard.mjs" "$@"
