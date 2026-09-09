#!/usr/bin/env bash
set -euo pipefail

export NEXT_TELEMETRY_DISABLED=1
toolchains="$HOME/.local/share/curebid/toolchains"
export PATH="$toolchains/node-v24.20.0-linux-x64/bin:$toolchains/foundry-v1.8.1:$PATH"
cd "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$@"
