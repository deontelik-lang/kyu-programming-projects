#!/bin/sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
VERSION="$(printenv NODE_RUNTIME_VERSION 2>/dev/null || true)"
if [ -z "$VERSION" ]; then VERSION="24.21.0"; fi
MACHINE="$(uname -m)"
case "$MACHINE" in
  x86_64|amd64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) ARCH="" ;;
esac
if [ -n "$ARCH" ]; then
  LOCAL_NODE="$ROOT/runtime/node-v$VERSION-linux-$ARCH/bin/node"
  if [ -x "$LOCAL_NODE" ]; then
    export PATH="$ROOT/runtime/node-v$VERSION-linux-$ARCH/bin:$PATH"
  fi
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || printf '0')"
if [ "$NODE_MAJOR" -lt 24 ]; then
  echo "FundiConnect Pro requires Node.js 24.x. Run sh scripts/install-node-runtime.sh first." >&2
  exit 1
fi
cd "$ROOT"
exec node server.js
