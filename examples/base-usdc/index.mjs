// Base USDC Spend Guard — runnable example.
//
//   node index.mjs
//
// Demonstrates: an allowed in-policy USDC transfer (with signed receipt),
// a blocked over-limit transfer, and a blocked unlimited approval — all
// decided BEFORE anything is signed or broadcast. Deterministic, no network
// required (simulateBeforeSend is off here; flip it on + set BASE_RPC_URL to
// add live revert checks).

import { SpendGuardClient, verifyReceipt } from "@spendguard/sdk";

// USDC on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (6 decimals)
const ALICE = "0x1111111111111111111111111111111111111111"; // trusted payee
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Hardhat test key #0 — public, demo only. Never use for real funds.
const SIGNER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const policy = {
  version: 1,
  chainId: 8453,
  token: "USDC",
  limits: { maxPerTxUsd: "100", maxPerDayUsd: "250", maxPerTool: { default: "50" } },
  recipients: { allow: [ALICE], block: [] },
  approval: { thresholdUsd: "100" },
  rules: { blockUnknownSpender: true, blockUnlimitedApproval: true, simulateBeforeSend: false },
};

const guard = new SpendGuardClient({ policy, signerKey: SIGNER_KEY });

// Helper: build USDC transfer(address,uint256) calldata.
function usdcTransfer(to, amount6) {
  const sel = "0xa9059cbb";
  const addr = to.toLowerCase().replace("0x", "").padStart(64, "0");
  const amt = BigInt(amount6).toString(16).padStart(64, "0");
  return sel + addr + amt;
}

function show(label, res) {
  console.log(`\n=== ${label} ===`);
  console.log(`decision : ${res.decision.action}  (value $${res.decision.valueUsd})`);
  for (const r of res.decision.reasons) console.log(`  - [${r.code}] ${r.message}`);
  if (res.receipt) {
    console.log(`receipt  : signed by ${res.receipt.signer}`);
    console.log(`verified : ${verifyReceipt(res.receipt)}`);
  }
}

// 1. Allowed: $25 USDC to a trusted, allow-listed payee.
show(
  "Allowed $25 USDC transfer to trusted payee",
  await guard.checkSpend({ to: USDC, data: usdcTransfer(ALICE, 25_000000), tool: "tip", valueUsd: "25" }),
);

// 2. Blocked: $120 exceeds the $100 per-tx cap.
show(
  "Blocked $120 USDC transfer (over per-tx cap)",
  await guard.checkSpend({ to: USDC, data: usdcTransfer(ALICE, 120_000000), tool: "tip", valueUsd: "120" }),
);

// 3. Blocked: unlimited approval to an unknown spender.
const MAX = "f".repeat(64);
const approveUnlimited =
  "0x095ea7b3" + "9999999999999999999999999999999999999999".padStart(64, "0") + MAX;
show(
  "Blocked unlimited approval to unknown spender",
  await guard.checkSpend({ to: USDC, data: approveUnlimited, tool: "approve", valueUsd: "0" }),
);

const summary = await guard.summary();
console.log(`\nDaily spend so far: $${summary.totalUsd}`, summary.byTool);
