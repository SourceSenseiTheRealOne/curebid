# CureBid stack

Canonical Windows checkout; execution through scripts/wsl-run.sh in Ubuntu-24.04. Node 24.20.0, pnpm 10.30.1, Foundry 1.8.1. Dependencies are pinned in package.json and pnpm-lock.yaml. Install dependencies with WSL pnpm, not alternating Windows and Linux node_modules. An interrupted cross-platform install was recovered with a WSL frozen-lockfile reinstall.

Implementation in progress. No funded deployment or settlement is claimed. Testnet wallets are isolated under the WSL user home; never commit or print secret material. The public interface must not conflate receipt business-rule validation with cryptographic precompile verification.
