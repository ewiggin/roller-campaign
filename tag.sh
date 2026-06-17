#!/usr/bin/env bash
set -e

VERSION="$1"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TAURI_CONF="$SCRIPT_DIR/roller-desktop/src-tauri/tauri.conf.json"
ENV_DESKTOP="$SCRIPT_DIR/roller-admin/src/environments/environment.desktop.ts"

CURRENT=$(grep -o '"version": "[^"]*"' "$TAURI_CONF" | grep -o '[0-9][^"]*')

if [ -z "$VERSION" ]; then
  echo "Version actual: $CURRENT"
  echo "Uso: $0 <version>  (ej: 0.2.5)"
  exit 0
fi

echo "Version actual: $CURRENT"
echo "Nueva version:  $VERSION"

sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$TAURI_CONF"
sed -i "s/version: '[^']*'/version: '$VERSION'/" "$ENV_DESKTOP"

echo "Actualizado en:"
echo "  $TAURI_CONF"
echo "  $ENV_DESKTOP"
