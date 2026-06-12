# Base Agent Spend Guard — Build Plan

## What it is
Open-source TypeScript SDK + MCP tool that lets any Base agent enforce spending
policies **before** signing or broadcasting a transaction. Deterministic core, no LLM.

## Prior art (researched 2026-06-12, GitHub + X)
Fragmented competitors exist; none own the Base-native, agent-first niche cleanly:
- `presidio-v/presidio-hardened-x402` (⭐10, Python) — x402 middleware, PII + spend policy. Server-side proxy, not an SDK + simulation engine.
- `EfeDurmaz16/sardis` (⭐6, TS) — authority layer + MCP server + framework adapters. Broad payments authority, multi-chain.
- `nmrtn/blacktea` (⭐3, TS) — x402 spending controls + audit log. Online payments focus, not on-chain tx simulation.
- `luacantu/guardx402` (⭐1), `DzikPasnik/x402Guard` (⭐1) — early x402 guardrails.
- `Hussain-Sharif/policy-vault`, `Spkap/Permit402` — Solana-focused.

**Gap / wedge:** Base-native, deterministic, embeddable SDK that combines
(1) declarative JSON policy, (2) **pre-tx simulation** of the actual Base tx, and
(3) **signed spend receipts** — plus a first-class **MCP tool** so any agent runtime
(Claude, Hermes, LangChain) can call `check_spend_policy` before sending. Most rivals
are x402-payment proxies; we guard the on-chain transaction itself.

## Architecture (monorepo, pnpm/npm workspaces)
```
base-spend-guard/
  packages/
    core/          # @spendguard/core — pure policy engine + types (no IO)
    sdk/           # @spendguard/sdk  — client: wraps core + RPC simulation + receipts
    mcp/           # @spendguard/mcp  — MCP server exposing check_spend_policy tool
  examples/
    base-usdc/     # runnable example: agent + USDC transfer + policy
  policy.schema.json
  .env.example
  README.md
```

### Stack
- TypeScript, Node 24, tsup (CJS+ESM), Vitest, zod, ethers v6
- viem optional in examples
- Base only first (chainId 8453). RPC `eth_call` + `estimateGas` for simulation.
- MCP via `@modelcontextprotocol/sdk` (stdio).

## Policy model (policy.json)
```json
{
  "version": 1,
  "chainId": 8453,
  "token": "USDC",
  "limits": {
    "maxPerTxUsd": "100",
    "maxPerDayUsd": "500",
    "maxPerTool": { "default": "50" }
  },
  "recipients": { "allow": ["0x..."], "block": ["0x..."] },
  "approval": { "thresholdUsd": "100" },
  "rules": {
    "blockUnknownSpender": true,
    "blockUnlimitedApproval": true,
    "simulateBeforeSend": true
  }
}
```

### Decisions
`allow` | `warn` | `require_approval` | `block`. Deterministic precedence:
block-list > reverting tx > over-limit > unlimited-approval > unknown-spender >
approval-threshold > allow.

## Spend receipts
On `allow`, emit a signed receipt:
`{ txHash?, to, valueUsd, tool, decision, policyHash, timestamp, signature }`.
Signed with a configurable signer key (EIP-191 personal_sign). Verifiable offline.

## Task breakdown (Kanban — pick up anywhere)
- T1  Scaffold monorepo + tooling (workspaces, tsconfig, vitest, tsup, lint)
- T2  core: types + zod policy schema + policy loader/validator
- T3  core: daily-spend ledger (in-memory + pluggable store interface)
- T4  core: ERC20 decoder (transfer, approve, increaseAllowance) + USD valuation hook
- T5  core: deterministic policy engine (decision precedence) + unit tests
- T6  sdk: SpendGuardClient — checkSpend(), simulate via Base RPC, wire core
- T7  sdk: signed spend receipts (sign + verify) + tests
- T8  mcp: MCP stdio server exposing check_spend_policy + get_spend_summary
- T9  examples/base-usdc: runnable USDC transfer guard demo
- T10 docs: README, policy.schema.json, quickstart, integration guide
- T11 CI: GitHub Actions (build + test on push) + publish prep
- T12 Verify end-to-end + create GitHub repo + initial release

## Verification gates (per the security-tools skill)
- `npm run build` + `npm test` green across packages
- core engine: over-limit→block, unlimited approval→warn/block, allow-list pass
- sdk: simulate a 0-value tx on Base RPC returns success; revert→block
- receipt sign/verify round-trips
- mcp: tool lists + returns structured decision
- secret scan clean; only `.env.example` committed
