#!/usr/bin/env bash
set -euo pipefail

toolchains="$HOME/.local/share/curebid/toolchains"
export PATH="$toolchains/node-v24.20.0-linux-x64/bin:$toolchains/foundry-v1.8.1:$PATH"
cd /mnt/c/Users/sourc/Documents/Dev/HERMES/LAB/coding_lab/projects/curebid
exec "$@"
