#!/bin/sh
if command -v node >/dev/null 2>&1; then
  exec node "$@"
fi

bundled_node="/Users/nasinnizar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
if [ -x "$bundled_node" ]; then
  exec "$bundled_node" "$@"
fi

echo "Node.js is required. Install Node.js 22 or newer, then retry." >&2
exit 1
