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

mkdir -p "${REPO_ROOT}/coverage"
: > "${REPO_ROOT}/coverage/live-requests-${TARGET}.jsonl"

"${SCRIPT_DIR}/kong.sh" up "${TARGET}"
eval "$("${SCRIPT_DIR}/kong.sh" env "${TARGET}")"

cd "${REPO_ROOT}"
if [[ $# -eq 0 ]]; then
  npx vitest run --project live
  npx vitest run --project live-destructive
else
  live_args=()
  destructive_args=()
  shared_flags=()
  for arg in "$@"; do
    case "${arg}" in
      -*) shared_flags+=("${arg}") ;;
      *live-destructive*) destructive_args+=("${arg}") ;;
      *) live_args+=("${arg}") ;;
    esac
  done
  if [[ ${#live_args[@]} -gt 0 ]]; then
    npx vitest run --project live "${shared_flags[@]}" "${live_args[@]}"
  fi
  if [[ ${#destructive_args[@]} -gt 0 ]]; then
    npx vitest run --project live-destructive "${shared_flags[@]}" "${destructive_args[@]}"
  fi
  if [[ ${#live_args[@]} -eq 0 && ${#destructive_args[@]} -eq 0 ]]; then
    npx vitest run --project live "${shared_flags[@]}"
  fi
fi

if [[ -n "${LIVE_COVERAGE:-}" ]]; then
  COVERAGE_MODE="${LIVE_COVERAGE}"
elif [[ $# -eq 0 ]]; then
  COVERAGE_MODE="strict"
else
  COVERAGE_MODE="report"
fi

LIVE_COVERAGE="${COVERAGE_MODE}" node "${SCRIPT_DIR}/live-coverage.mjs" "${TARGET}"
