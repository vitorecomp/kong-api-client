#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <up|down|status|env|logs> <oss-3.9|ee-3.14> [kong|dbless|pg|upstream]" >&2
  exit 1
}

if [[ $# -lt 2 ]]; then
  usage
fi

ACTION="$1"
TARGET="$2"
LOG_SERVICE="${3:-kong}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -n "${CONTAINER_ENGINE:-}" ]]; then
  ENGINE="${CONTAINER_ENGINE}"
elif command -v podman >/dev/null 2>&1; then
  ENGINE="podman"
elif command -v docker >/dev/null 2>&1; then
  ENGINE="docker"
else
  echo "Error: neither podman nor docker found in PATH (or set CONTAINER_ENGINE)." >&2
  exit 1
fi

OFFSET="${KONG_TEST_PORT_OFFSET:-0}"
if ! [[ "${OFFSET}" =~ ^[0-9]+$ ]]; then
  echo "Error: KONG_TEST_PORT_OFFSET must be a non-negative integer (got '${OFFSET}')." >&2
  exit 1
fi

PG_IMAGE="docker.io/library/postgres:16-alpine"
NODE_IMAGE="docker.io/library/node:22-alpine"

case "${TARGET}" in
  oss-3.9)
    KONG_IMAGE="docker.io/library/kong:3.9.5"
    ADMIN_PORT=$((18001 + OFFSET))
    DBLESS_ADMIN_PORT=$((18002 + OFFSET))
    PROXY_PORT=$((18000 + OFFSET))
    UPSTREAM_PORT=$((18080 + OFFSET))
    ;;
  ee-3.14)
    KONG_IMAGE="docker.io/kong/kong-gateway:3.14.0.18"
    ADMIN_PORT=$((18101 + OFFSET))
    DBLESS_ADMIN_PORT=$((18102 + OFFSET))
    PROXY_PORT=$((18100 + OFFSET))
    UPSTREAM_PORT=$((18180 + OFFSET))
    ;;
  *)
    echo "Error: unknown target '${TARGET}'. Expected 'oss-3.9' or 'ee-3.14'." >&2
    exit 1
    ;;
esac

PREFIX="kac-${TARGET}-${OFFSET}"
NETWORK="${PREFIX}"
PG_NAME="${PREFIX}-pg"
KONG_NAME="${PREFIX}-kong"
DBLESS_NAME="${PREFIX}-dbless"
UPSTREAM_NAME="${PREFIX}-upstream"

ADMIN_URL="http://127.0.0.1:${ADMIN_PORT}"
DBLESS_ADMIN_URL="http://127.0.0.1:${DBLESS_ADMIN_PORT}"
PROXY_URL="http://127.0.0.1:${PROXY_PORT}"
UPSTREAM_URL="http://127.0.0.1:${UPSTREAM_PORT}"
UPSTREAM_INTERNAL_URL="http://upstream:8080"

KONG_ENV=(
  -e KONG_DATABASE=postgres
  -e "KONG_PG_HOST=${PG_NAME}"
  -e KONG_PG_USER=kong
  -e KONG_PG_PASSWORD=kong
  -e KONG_NGINX_WORKER_PROCESSES=2
)

do_down() {
  for name in "${KONG_NAME}" "${DBLESS_NAME}" "${UPSTREAM_NAME}" "${PG_NAME}"; do
    "${ENGINE}" rm -f "${name}" >/dev/null 2>&1 || true
  done
  "${ENGINE}" network rm "${NETWORK}" >/dev/null 2>&1 || true
}

do_env() {
  cat <<EOF
export KONG_TARGET="${TARGET}"
export KONG_ADMIN_URL="${ADMIN_URL}"
export KONG_DBLESS_ADMIN_URL="${DBLESS_ADMIN_URL}"
export KONG_PROXY_URL="${PROXY_URL}"
export KONG_UPSTREAM_URL="${UPSTREAM_URL}"
export KONG_UPSTREAM_INTERNAL_URL="${UPSTREAM_INTERNAL_URL}"
EOF
}

do_up() {
  do_down

  if ! "${ENGINE}" network create "${NETWORK}" >/dev/null; then
    echo "Error: failed to create network '${NETWORK}'." >&2
    exit 1
  fi

  if ! "${ENGINE}" run -d \
    --name "${PG_NAME}" \
    --network "${NETWORK}" \
    -e POSTGRES_USER=kong \
    -e POSTGRES_DB=kong \
    -e POSTGRES_PASSWORD=kong \
    "${PG_IMAGE}" >/dev/null; then
    echo "Error: failed to start Postgres container '${PG_NAME}'." >&2
    exit 1
  fi

  if ! "${ENGINE}" create \
    --name "${UPSTREAM_NAME}" \
    --network "${NETWORK}" \
    --network-alias upstream \
    -p "127.0.0.1:${UPSTREAM_PORT}:8080" \
    "${NODE_IMAGE}" \
    node /fake-upstream.mjs >/dev/null; then
    echo "Error: failed to create fake upstream container '${UPSTREAM_NAME}'." >&2
    exit 1
  fi

  if ! "${ENGINE}" cp \
    "${REPO_ROOT}/test/support/fake-upstream.mjs" \
    "${UPSTREAM_NAME}:/fake-upstream.mjs" >/dev/null; then
    echo "Error: failed to copy fake-upstream.mjs into '${UPSTREAM_NAME}'." >&2
    exit 1
  fi

  if ! "${ENGINE}" start "${UPSTREAM_NAME}" >/dev/null; then
    echo "Error: failed to start fake upstream container '${UPSTREAM_NAME}'." >&2
    exit 1
  fi

  if ! "${ENGINE}" run -d \
    --name "${DBLESS_NAME}" \
    --network "${NETWORK}" \
    -e KONG_DATABASE=off \
    -e KONG_NGINX_WORKER_PROCESSES=2 \
    -e KONG_NEW_DNS_CLIENT=on \
    -e KONG_ADMIN_LISTEN=0.0.0.0:8001 \
    -e KONG_PROXY_LISTEN=0.0.0.0:8000 \
    -p "127.0.0.1:${DBLESS_ADMIN_PORT}:8001" \
    "${KONG_IMAGE}" >/dev/null; then
    echo "Error: failed to start DB-less Kong container '${DBLESS_NAME}'." >&2
    exit 1
  fi

  pg_ready=0
  for _ in $(seq 1 60); do
    if "${ENGINE}" exec "${PG_NAME}" pg_isready -h 127.0.0.1 -U kong -d kong >/dev/null 2>&1; then
      pg_ready=1
      break
    fi
    sleep 1
  done
  if [[ "${pg_ready}" -ne 1 ]]; then
    echo "Error: Postgres '${PG_NAME}' did not become ready within 60s." >&2
    "${ENGINE}" logs --tail 30 "${PG_NAME}" >&2 || true
    exit 1
  fi

  if ! migration_out="$("${ENGINE}" run --rm \
    --network "${NETWORK}" \
    "${KONG_ENV[@]}" \
    "${KONG_IMAGE}" \
    kong migrations bootstrap 2>&1)"; then
    echo "Error: Kong migrations bootstrap failed for ${TARGET}:" >&2
    echo "${migration_out}" >&2
    exit 1
  fi

  if ! "${ENGINE}" run -d \
    --name "${KONG_NAME}" \
    --network "${NETWORK}" \
    "${KONG_ENV[@]}" \
    -e KONG_ADMIN_LISTEN=0.0.0.0:8001 \
    -e KONG_PROXY_LISTEN=0.0.0.0:8000 \
    -p "127.0.0.1:${ADMIN_PORT}:8001" \
    -p "127.0.0.1:${PROXY_PORT}:8000" \
    "${KONG_IMAGE}" >/dev/null; then
    echo "Error: failed to start Kong container '${KONG_NAME}'." >&2
    exit 1
  fi

  upstream_ready=0
  for _ in $(seq 1 30); do
    if curl -sf -m 5 "${UPSTREAM_URL}/__health" >/dev/null 2>&1; then
      upstream_ready=1
      break
    fi
    sleep 1
  done
  if [[ "${upstream_ready}" -ne 1 ]]; then
    echo "Error: fake upstream '${UPSTREAM_NAME}' did not become healthy at ${UPSTREAM_URL}/__health." >&2
    "${ENGINE}" logs --tail 30 "${UPSTREAM_NAME}" >&2 || true
    exit 1
  fi

  kong_ready=0
  for _ in $(seq 1 90); do
    if curl -sf -m 5 "${ADMIN_URL}/status" >/dev/null 2>&1; then
      kong_ready=1
      break
    fi
    state="$("${ENGINE}" inspect --format '{{.State.Status}}' "${KONG_NAME}" 2>/dev/null || echo "missing")"
    if [[ "${state}" != "running" && "${state}" != "created" ]]; then
      echo "Error: Kong container '${KONG_NAME}' stopped unexpectedly (state: ${state})." >&2
      "${ENGINE}" logs --tail 40 "${KONG_NAME}" >&2 || true
      exit 1
    fi
    sleep 1
  done
  if [[ "${kong_ready}" -ne 1 ]]; then
    echo "Error: Kong Admin API did not respond at ${ADMIN_URL}/status within 90s." >&2
    "${ENGINE}" logs --tail 40 "${KONG_NAME}" >&2 || true
    exit 1
  fi

  dbless_ready=0
  for _ in $(seq 1 90); do
    if curl -sf -m 5 "${DBLESS_ADMIN_URL}/status" >/dev/null 2>&1; then
      dbless_ready=1
      break
    fi
    state="$("${ENGINE}" inspect --format '{{.State.Status}}' "${DBLESS_NAME}" 2>/dev/null || echo "missing")"
    if [[ "${state}" != "running" && "${state}" != "created" ]]; then
      echo "Error: DB-less Kong container '${DBLESS_NAME}' stopped unexpectedly (state: ${state})." >&2
      "${ENGINE}" logs --tail 40 "${DBLESS_NAME}" >&2 || true
      exit 1
    fi
    sleep 1
  done
  if [[ "${dbless_ready}" -ne 1 ]]; then
    echo "Error: DB-less Kong Admin API did not respond at ${DBLESS_ADMIN_URL}/status within 90s." >&2
    "${ENGINE}" logs --tail 40 "${DBLESS_NAME}" >&2 || true
    exit 1
  fi
}

do_status() {
  local ok=0
  for name in "${PG_NAME}" "${UPSTREAM_NAME}" "${KONG_NAME}" "${DBLESS_NAME}"; do
    local state
    state="$("${ENGINE}" inspect --format '{{.State.Status}}' "${name}" 2>/dev/null || echo "missing")"
    echo "${name}: ${state}"
    if [[ "${state}" != "running" ]]; then
      ok=1
    fi
  done

  if curl -sf -m 5 "${ADMIN_URL}/status" >/dev/null 2>&1; then
    echo "admin (${ADMIN_URL}/status): ok"
  else
    echo "admin (${ADMIN_URL}/status): unreachable"
    ok=1
  fi

  if curl -sf -m 5 "${DBLESS_ADMIN_URL}/status" >/dev/null 2>&1; then
    echo "dbless (${DBLESS_ADMIN_URL}/status): ok"
  else
    echo "dbless (${DBLESS_ADMIN_URL}/status): unreachable"
    ok=1
  fi

  if curl -sf -m 5 "${UPSTREAM_URL}/__health" >/dev/null 2>&1; then
    echo "upstream (${UPSTREAM_URL}/__health): ok"
  else
    echo "upstream (${UPSTREAM_URL}/__health): unreachable"
    ok=1
  fi

  exit "${ok}"
}

do_logs() {
  case "${LOG_SERVICE}" in
    kong) "${ENGINE}" logs "${KONG_NAME}" ;;
    dbless) "${ENGINE}" logs "${DBLESS_NAME}" ;;
    pg) "${ENGINE}" logs "${PG_NAME}" ;;
    upstream) "${ENGINE}" logs "${UPSTREAM_NAME}" ;;
    *)
      echo "Error: unknown log target '${LOG_SERVICE}'. Expected 'kong', 'dbless', 'pg', or 'upstream'." >&2
      exit 1
      ;;
  esac
}

case "${ACTION}" in
  up) do_up ;;
  down) do_down ;;
  status) do_status ;;
  env) do_env ;;
  logs) do_logs ;;
  *) usage ;;
esac
