#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BUILD_ROOT="$ROOT_DIR/build"
BUILD_DIR="$BUILD_ROOT/package"
BUILD_VENV="$BUILD_ROOT/venv"
DIST_DIR="$ROOT_DIR/dist"

rm -rf "$BUILD_ROOT"
mkdir -p "$BUILD_DIR" "$DIST_DIR"
python3.14 -m venv "$BUILD_VENV"

"$BUILD_VENV/bin/python" -m pip install \
  --requirement "$ROOT_DIR/requirements.txt" \
  --target "$BUILD_DIR" \
  --no-compile \
  --upgrade \
  --quiet

cp -R "$ROOT_DIR/app" "$BUILD_DIR/app"
cp "$ROOT_DIR/lambda_handler.py" "$BUILD_DIR/lambda_handler.py"

rm -f "$DIST_DIR/arcade-api.zip"
(
  cd "$BUILD_DIR"
  python3.14 -m zipfile -c "$DIST_DIR/arcade-api.zip" .
)

printf 'Built %s\n' "$DIST_DIR/arcade-api.zip"
