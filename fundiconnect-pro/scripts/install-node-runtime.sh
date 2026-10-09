#!/bin/sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
VERSION="$(printenv NODE_RUNTIME_VERSION 2>/dev/null || true)"
if [ -z "$VERSION" ]; then VERSION="24.21.0"; fi
OS="$(uname -s)"
MACHINE="$(uname -m)"
if [ "$OS" != "Linux" ]; then
  echo "This installer currently supports Linux only." >&2
  exit 1
fi
case "$MACHINE" in
  x86_64|amd64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $MACHINE" >&2; exit 1 ;;
esac
DEST="$ROOT/runtime/node-v$VERSION-linux-$ARCH"
if [ -x "$DEST/bin/node" ]; then
  "$DEST/bin/node" --version
  echo "Node.js runtime already installed at $DEST"
  exit 0
fi
mkdir -p "$ROOT/runtime"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM
ARCHIVE="node-v$VERSION-linux-$ARCH.tar.xz"
BASE="https://nodejs.org/dist/v$VERSION"
curl -fsSL "$BASE/$ARCHIVE" -o "$TMP/$ARCHIVE"
curl -fsSL "$BASE/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
grep " $ARCHIVE\$" "$TMP/SHASUMS256.txt" | (cd "$TMP" && sha256sum -c -)
tar -xJf "$TMP/$ARCHIVE" -C "$ROOT/runtime"
"$DEST/bin/node" --version
echo "Verified Node.js runtime installed at $DEST"
