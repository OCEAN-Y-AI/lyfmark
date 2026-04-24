#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

if [[ ! -f "package.json" ]]; then
	echo "[installer] Error: package.json was not found."
	echo "[installer] Start this installer from the LyfMark project folder."
	if [[ "${LYFMARK_INSTALLER_NO_PAUSE:-0}" != "1" ]]; then
		read -r -n 1 -p "Press any key to close ..."
	fi
	echo
	exit 1
fi

if ! command -v node >/dev/null 2>&1; then
	echo "[installer] Node.js was not found."
	echo "[installer] Opening download page: https://nodejs.org/en/download"
	open "https://nodejs.org/en/download" || true
	echo "[installer] Install Node.js and start the installer again."
	if [[ "${LYFMARK_INSTALLER_NO_PAUSE:-0}" != "1" ]]; then
		read -r -n 1 -p "Press any key to close ..."
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
	echo "[installer] The installer exited with error code ${EXIT_CODE}."
fi

if [[ "${LYFMARK_INSTALLER_NO_PAUSE:-0}" != "1" ]]; then
	read -r -n 1 -p "Press any key to close ..."
fi
echo
exit ${EXIT_CODE}
