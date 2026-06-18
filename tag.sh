#!/usr/bin/env bash
set -e

VERSION="$1"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TAURI_CONF="$SCRIPT_DIR/roller-desktop/src-tauri/tauri.conf.json"
ENV_DESKTOP="$SCRIPT_DIR/roller-admin/src/environments/environment.desktop.ts"
ENV_DEV="$SCRIPT_DIR/roller-admin/src/environments/environment.ts"
ENV_STAGING="$SCRIPT_DIR/roller-admin/src/environments/environment.staging.ts"
ENV_PROD="$SCRIPT_DIR/roller-admin/src/environments/environment.prod.ts"
PKG_ADMIN="$SCRIPT_DIR/roller-admin/package.json"
PKG_BACKEND="$SCRIPT_DIR/roller-backend/package.json"
PKG_DESKTOP="$SCRIPT_DIR/roller-desktop/package.json"

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
sed -i "s/version: '[^']*'/version: '$VERSION'/" "$ENV_DEV"
sed -i "s/version: '[^']*'/version: '$VERSION'/" "$ENV_STAGING"
sed -i "s/version: '[^']*'/version: '$VERSION'/" "$ENV_PROD"
sed -i "0,/\"version\": \"[^\"]*\"/{s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/}" "$PKG_ADMIN"
sed -i "0,/\"version\": \"[^\"]*\"/{s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/}" "$PKG_BACKEND"
sed -i "0,/\"version\": \"[^\"]*\"/{s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/}" "$PKG_DESKTOP"

echo "Actualizado en:"
echo "  $TAURI_CONF"
echo "  $ENV_DESKTOP"
echo "  $ENV_DEV"
echo "  $ENV_STAGING"
echo "  $ENV_PROD"
echo "  $PKG_ADMIN"
echo "  $PKG_BACKEND"
echo "  $PKG_DESKTOP"
