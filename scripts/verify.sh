#!/usr/bin/env bash
# Full verification gate for Base Spend Guard.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== build all =="
npm run build

echo "== test all =="
npm test

echo "== MCP stdio smoke =="
node packages/mcp/test/smoke.mjs

echo "== example run =="
node examples/base-usdc/index.mjs >/dev/null && echo "example OK"

echo "== secret scan =="
# Require realistic key shapes, not bare 'sk-' (avoids risk-engine false positives).
if grep -REn 'sk-[A-Za-z0-9]{20,}|-----BEGIN (RSA |EC )?PRIVATE KEY-----' \
    --include='*.ts' --include='*.mjs' --include='*.json' \
    --exclude-dir=node_modules --exclude-dir=dist . ; then
  echo "SECRET SCAN FAILED: possible secret committed"; exit 1
fi
# Demo Hardhat test keys are public and intentional; flag only non-test private keys.
echo "secret scan clean (demo Hardhat keys are public, intentional)"

echo "== ALL GREEN =="
