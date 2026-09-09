# CureBid stack

Canonical Windows checkout; execution through scripts/wsl-run.sh in WSL distro `Ubuntu` (official installed image: Ubuntu 26.04 LTS), default Linux user `sourcesensei`. Do not use the recovered quarantine distro. Node 24.20.0, pnpm 10.30.1, Foundry 1.8.1 are installed and verified in the new Ubuntu. Dependencies are pinned in package.json and pnpm-lock.yaml. Install dependencies with WSL pnpm, not alternating Windows and Linux node_modules. The launcher resolves its checkout relative to its own path.

Implementation in progress. No funded deployment or settlement is claimed. Testnet wallets are isolated under the WSL user home; never commit or print secret material. The public interface must not conflate receipt business-rule validation with cryptographic precompile verification.
