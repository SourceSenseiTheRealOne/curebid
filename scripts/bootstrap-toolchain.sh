#!/usr/bin/env bash
# Install isolated official, checksum-verified Linux toolchains.
set -euo pipefail
base="$HOME/.local/share/curebid/toolchains"
mkdir -p "$base"
cd "$base"
if [[ ! -x node-v24.20.0-linux-x64/bin/node ]]; then
  curl -fsSLO https://nodejs.org/dist/v24.20.0/node-v24.20.0-linux-x64.tar.xz
  curl -fsSLo node-SHASUMS256.txt https://nodejs.org/dist/v24.20.0/SHASUMS256.txt
  sha256sum --check --ignore-missing node-SHASUMS256.txt
  tar -xf node-v24.20.0-linux-x64.tar.xz
  rm node-v24.20.0-linux-x64.tar.xz node-SHASUMS256.txt
fi
if [[ ! -x foundry-v1.8.1/forge ]]; then
  mkdir -p foundry-v1.8.1
  curl -fsSLo foundry.tar.gz https://github.com/foundry-rs/foundry/releases/download/v1.8.1/foundry_v1.8.1_linux_amd64.tar.gz
  actual=$(sha256sum foundry.tar.gz)
  test "${actual%% *}" = 37b45855232e57624d90113b049ca54f0c92055bb5c1997fcbdc3076c7b89c10
  tar -xzf foundry.tar.gz -C foundry-v1.8.1
  rm foundry.tar.gz
fi
export PATH="$base/node-v24.20.0-linux-x64/bin:$base/foundry-v1.8.1:$PATH"
node --version
if [[ ! -x "$base/node-v24.20.0-linux-x64/bin/pnpm" ]]; then
  npm install --global pnpm@10.30.1
fi
pnpm --version
forge --version
cast --version
