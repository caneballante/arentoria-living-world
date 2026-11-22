#!/bin/bash
# Double-click (macOS) or run (Linux) to start Arentoria Living World and open it in your browser.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.12 or newer is required. Download it from https://nodejs.org and try again."
  read -r -n 1 -p "Press any key to close."
  exit 1
fi
node scripts/launch.mjs "$@"
