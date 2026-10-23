#!/usr/bin/env bash
# Stage the hidden checker outside the workspace so the engineer cannot read it.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$HOME/.eval-check"
/bin/cp -f "$here/check_gitignore.py" "$HOME/.eval-check/check_gitignore.py"
