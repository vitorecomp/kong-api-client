#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <oss-3.9|ee-3.14> [vitest args...]" >&2
  exit 1
fi

TARGET="$1"
shift

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cleanup() {
  if [[ "${KEEP:-0}" == "1" ]]; then
    echo "KEEP=1 set; leaving ${TARGET} running." >&2
    return 0
  fi
  "${SCRIPT_DIR}/kong.sh" down "${TARGET}"
}

trap cleanup EXIT

"${SCRIPT_DIR}/kong.sh" up "${TARGET}"
eval "$("${SCRIPT_DIR}/kong.sh" env "${TARGET}")"

cd "${REPO_ROOT}"
npx vitest run --project live "$@"
