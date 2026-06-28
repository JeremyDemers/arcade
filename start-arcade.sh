#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ARCADE_ENV_FILE:-$ROOT_DIR/.env.local}"

declare -a SERVICE_PIDS=()
cleaning_up=false

fail() {
  printf 'Arcade startup error: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command '$1' was not found."
}

cleanup() {
  if [[ "$cleaning_up" == true ]]; then
    return
  fi
  cleaning_up=true
  trap - EXIT INT TERM

  if ((${#SERVICE_PIDS[@]} > 0)); then
    printf '\nStopping Arcade services...\n'
    for pid in "${SERVICE_PIDS[@]}"; do
      kill -TERM -- "-$pid" 2>/dev/null || true
    done
    for pid in "${SERVICE_PIDS[@]}"; do
      wait "$pid" 2>/dev/null || true
    done
  fi
}

trap cleanup EXIT
trap 'exit 130' INT TERM

for command_name in python3 npm setsid stdbuf sed; do
  require_command "$command_name"
done

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

[[ -n "${GOOGLE_CLIENT_ID:-}" ]] || fail "Set GOOGLE_CLIENT_ID in $ENV_FILE or export it before running this script."
[[ "$GOOGLE_CLIENT_ID" == *.apps.googleusercontent.com ]] || fail "GOOGLE_CLIENT_ID does not look like a Google Web Client ID."
[[ -n "${ARCADE_SECRET:-}" ]] || fail "Set a newly generated ARCADE_SECRET in $ENV_FILE or export it before running this script."
(( ${#ARCADE_SECRET} >= 32 )) || fail "ARCADE_SECRET must be at least 32 characters long."
[[ "$ARCADE_SECRET" != *replace-with* && "$ARCADE_SECRET" != *choose-a-* ]] || fail "Replace the example ARCADE_SECRET before starting the apps."

# Keep the private secret out of dependency installers and frontend processes.
export -n GOOGLE_CLIENT_ID ARCADE_SECRET 2>/dev/null || true

for port in 3000 3001 8000 8001; do
  if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    fail "Port $port is already in use. Stop the existing service and try again."
  fi
done

ensure_backend() {
  local backend_dir="$1"
  if [[ ! -x "$backend_dir/.venv/bin/python" ]]; then
    printf 'Creating Python environment in %s/.venv...\n' "${backend_dir#"$ROOT_DIR/"}"
    python3 -m venv "$backend_dir/.venv"
    "$backend_dir/.venv/bin/python" -m pip install -r "$backend_dir/requirements.txt"
  fi
}

ensure_frontend() {
  local frontend_dir="$1"
  if [[ ! -x "$frontend_dir/node_modules/.bin/next" ]]; then
    printf 'Installing frontend dependencies in %s...\n' "${frontend_dir#"$ROOT_DIR/"}"
    npm --prefix "$frontend_dir" install
  fi
}

start_service() {
  local label="$1"
  local directory="$2"
  local environment_scope="$3"
  shift 3

  (
    if [[ "$environment_scope" == backend ]]; then
      export GOOGLE_CLIENT_ID ARCADE_SECRET
      unset NEXT_PUBLIC_GOOGLE_CLIENT_ID
    else
      export NEXT_PUBLIC_GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID"
      unset GOOGLE_CLIENT_ID ARCADE_SECRET
    fi

    exec setsid bash -c '
      label="$1"
      directory="$2"
      shift 2
      cd "$directory"
      stdbuf -oL -eL "$@" 2>&1 | sed -u "s/^/[$label] /"
    ' arcade-service "$label" "$directory" "$@"
  ) &
  SERVICE_PIDS+=("$!")
}

ensure_backend "$ROOT_DIR/tetris/backend"
ensure_backend "$ROOT_DIR/neon-shatter/backend"
ensure_frontend "$ROOT_DIR/tetris/frontend"
ensure_frontend "$ROOT_DIR/neon-shatter/frontend"

printf 'Starting Arcade...\n'
start_service "tetris-api" "$ROOT_DIR/tetris/backend" backend .venv/bin/python -m uvicorn app.main:app --reload --port 8000
start_service "tetris-web" "$ROOT_DIR/tetris/frontend" frontend env NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev -- --port 3000
start_service "neon-api" "$ROOT_DIR/neon-shatter/backend" backend .venv/bin/python -m uvicorn app.main:app --reload --port 8001
start_service "neon-web" "$ROOT_DIR/neon-shatter/frontend" frontend env NEXT_PUBLIC_API_BASE_URL=http://localhost:8001 npm run dev -- --port 3001

printf '\nTetris:       http://localhost:3000\n'
printf 'Neon Shatter: http://localhost:3001\n'
printf 'Press Ctrl+C to stop all four services.\n\n'

set +e
wait -n "${SERVICE_PIDS[@]}"
exit_status=$?
set -e

printf '\nOne Arcade service exited; stopping the others.\n' >&2
exit "$exit_status"
