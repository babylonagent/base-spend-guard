# Base Spend Guard 🛡️

**Spending policies for Base agents — enforced before a transaction is signed.**

[![CI](https://github.com/babylonagent/base-spend-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/babylonagent/base-spend-guard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Agent wallets are easy to give money to and hard to give limits to. Base Spend
Guard is a small, open-source TypeScript SDK + MCP tool that lets any Base agent
define a JSON spending policy and get a deterministic **allow / warn /
require_approval / block** decision on every spend — *before* it signs or
broadcasts. No LLM in the decision path. Same input, same output, every time.

## Why

Most agent-payment guardrails are x402 HTTP proxies. Base Spend Guard guards the
**on-chain transaction itself**: it decodes the calldata, optionally simulates it
on Base, applies your budget rules, and emits a **signed spend receipt** you can
verify offline.

## What it enforces

- **Max USD per transaction** and **per UTC day**
- **Per-tool budgets** (`swap`, `tip`, …) with a `default` fallback
- **Allow-list / block-list** recipients
- **Unlimited-approval detection** (`approve`, `increaseAllowance` at `MaxUint256`)
- **Unknown-spender** warnings/blocks
- **Approval threshold** — require human sign-off above a USD value
- **Pre-tx simulation** — block transactions that would revert on Base
- **Signed spend receipts** — EIP-191, verifiable offline

## Packages

| Package | Description |
| --- | --- |
| `@spendguard/core` | Deterministic policy engine, ERC20 decoder, ledger, types. Zero IO. |
| `@spendguard/sdk` | `SpendGuardClient`: policy check + Base RPC simulation + signed receipts. |
| `@spendguard/mcp` | MCP stdio server exposing `check_spend_policy` and `get_spend_summary`. |

## Quickstart

```bash
npm install @spendguard/sdk
```

```ts
import { SpendGuardClient, verifyReceipt } from "@spendguard/sdk";

const guard = new SpendGuardClient({
  policy: {
    version: 1,
    chainId: 8453,
    token: "USDC",
    limits: { maxPerTxUsd: "100", maxPerDayUsd: "500" },
    recipients: { allow: ["0xTrustedPayee..."] },
    approval: { thresholdUsd: "100" },
    rules: { blockUnknownSpender: true, blockUnlimitedApproval: true, simulateBeforeSend: true },
  },
  rpcUrl: process.env.BASE_RPC_URL,      // optional: enables revert simulation
  signerKey: process.env.SPENDGUARD_SIGNER_KEY, // optional: signs receipts
});

const { decision, receipt } = await guard.checkSpend({
  to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  data: "0xa9059cbb...",  // transfer calldata
  tool: "tip",
  valueUsd: "25",
});

if (decision.action === "block") throw new Error(decision.reasons[0].message);
if (decision.action === "allow" && receipt) {
  console.log("verified:", verifyReceipt(receipt));
  // ...sign and broadcast the tx
}
```

Run the example:

```bash
git clone https://github.com/babylonagent/base-spend-guard
cd base-spend-guard && npm install && npm run build
node examples/base-usdc/index.mjs
```

## Decision model

Every check returns a `Decision`:

```ts
{ action: "allow" | "warn" | "require_approval" | "block",
  reasons: { code, message, severity }[],
  valueUsd: string,
  policyHash: string }
```

Rule precedence (strongest wins; all triggered reasons reported):

```
block-list > reverting tx > over-per-tx > over-per-day > over-per-tool
  > unlimited-approval > unknown-spender > approval-threshold > allow
```

## Policy file

See [`policy.schema.json`](./policy.schema.json) for the full JSON Schema, and
[`policy.json`](./policy.json) for a working example.

## MCP integration

Any MCP-capable agent runtime (Claude, Hermes, etc.) can call the guard as a tool:

```jsonc
// mcp config
{
  "spendguard": {
    "command": "npx",
    "args": ["-y", "@spendguard/mcp"],
    "env": { "SPENDGUARD_POLICY": "./policy.json", "BASE_RPC_URL": "https://mainnet.base.org" }
  }
}
```

Exposes two tools:
- `check_spend_policy({ to, data?, value?, tool?, valueUsd? })` → decision JSON
- `get_spend_summary()` → daily totals + per-tool breakdown

## Security

- The decision core is **deterministic** — no model, no randomness.
- Secrets (RPC keys, receipt signer key) stay on **your runtime only**. Never
  commit them; only `.env.example` ships in this repo.
- Simulation is **read-only** (`eth_call` + `eth_estimateGas`). The guard never
  holds your keys or broadcasts anything.

## Development

```bash
npm install
npm run build   # builds all packages
npm test        # runs all package test suites
```

## License

MIT © Babylon Agent — built for the Base agent ecosystem.
