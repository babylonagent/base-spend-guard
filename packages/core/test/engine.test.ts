import { describe, it, expect } from "vitest";
import { evaluate } from "../src/engine.js";
import type { Policy, SpendRequest, EvalContext } from "../src/types.js";

const ALICE = "0x1111111111111111111111111111111111111111";
const MALLORY = "0x9999999999999999999999999999999999999999";

const basePolicy: Policy = {
  version: 1,
  chainId: 8453,
  token: "USDC",
  limits: { maxPerTxUsd: "100", maxPerDayUsd: "500", maxPerTool: { default: "50" } },
  recipients: { allow: [ALICE], block: [MALLORY] },
  approval: { thresholdUsd: "100" },
  rules: { blockUnknownSpender: true, blockUnlimitedApproval: true, simulateBeforeSend: true },
};

const emptyCtx: EvalContext = { spentTodayUsd: "0", spentTodayByTool: {} };

function req(p: Partial<SpendRequest>): SpendRequest {
  return { to: ALICE, value: "0", ...p };
}

describe("policy engine", () => {
  it("allows an in-policy spend to an allow-listed recipient", () => {
    const d = evaluate(basePolicy, req({ to: ALICE, valueUsd: "10", tool: "tip" }), emptyCtx);
    expect(d.action).toBe("allow");
    expect(d.reasons[0].code).toBe("OK");
  });

  it("blocks recipients on the block-list", () => {
    const d = evaluate(basePolicy, req({ to: MALLORY, valueUsd: "1" }), emptyCtx);
    expect(d.action).toBe("block");
    expect(d.reasons.map((r) => r.code)).toContain("RECIPIENT_BLOCKED");
  });

  it("blocks over per-tx limit", () => {
    const d = evaluate(basePolicy, req({ to: ALICE, valueUsd: "101" }), emptyCtx);
    expect(d.action).toBe("block");
    expect(d.reasons.map((r) => r.code)).toContain("OVER_PER_TX_LIMIT");
  });

  it("blocks over daily limit using projected total", () => {
    const ctx: EvalContext = { spentTodayUsd: "450", spentTodayByTool: {} };
    const d = evaluate(basePolicy, req({ to: ALICE, valueUsd: "60" }), ctx);
    expect(d.action).toBe("block");
    expect(d.reasons.map((r) => r.code)).toContain("OVER_DAILY_LIMIT");
  });

  it("blocks over per-tool limit", () => {
    const ctx: EvalContext = { spentTodayUsd: "0", spentTodayByTool: { swap: "40" } };
    const d = evaluate(basePolicy, req({ to: ALICE, valueUsd: "20", tool: "swap" }), ctx);
    expect(d.action).toBe("block");
    expect(d.reasons.map((r) => r.code)).toContain("OVER_TOOL_LIMIT");
  });

  it("blocks unlimited approval when rule is on", () => {
    const data =
      "0x095ea7b3" +
      "0000000000000000000000001111111111111111111111111111111111111111" +
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const d = evaluate(basePolicy, req({ to: ALICE, data, valueUsd: "0" }), emptyCtx);
    expect(d.action).toBe("block");
    expect(d.reasons.map((r) => r.code)).toContain("UNLIMITED_APPROVAL");
  });

  it("warns on unlimited approval when rule is off", () => {
    const policy: Policy = { ...basePolicy, rules: { ...basePolicy.rules, blockUnlimitedApproval: false } };
    const data =
      "0x095ea7b3" +
      "0000000000000000000000001111111111111111111111111111111111111111" +
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const d = evaluate(policy, req({ to: ALICE, data, valueUsd: "0" }), emptyCtx);
    expect(d.action).toBe("warn");
    expect(d.reasons.map((r) => r.code)).toContain("UNLIMITED_APPROVAL");
  });

  it("blocks unknown spender when not allow-listed", () => {
    const stranger = "0x4444444444444444444444444444444444444444";
    const d = evaluate(basePolicy, req({ to: stranger, valueUsd: "1" }), emptyCtx);
    expect(d.action).toBe("block");
    expect(d.reasons.map((r) => r.code)).toContain("UNKNOWN_SPENDER");
  });

  it("requires approval at/above threshold for allow-listed recipient", () => {
    const loose: Policy = {
      ...basePolicy,
      limits: { maxPerTxUsd: "1000", maxPerDayUsd: "5000" },
    };
    const d = evaluate(loose, req({ to: ALICE, valueUsd: "100", tool: "tip" }), emptyCtx);
    expect(d.action).toBe("require_approval");
    expect(d.reasons.map((r) => r.code)).toContain("APPROVAL_REQUIRED");
  });

  it("blocks a reverting tx when simulateBeforeSend is on", () => {
    const d = evaluate(
      basePolicy,
      req({ to: ALICE, valueUsd: "1", simulation: { success: false, error: "insufficient balance" } }),
      emptyCtx,
    );
    expect(d.action).toBe("block");
    expect(d.reasons.map((r) => r.code)).toContain("TX_REVERTS");
  });

  it("is deterministic — same input, same policyHash and action", () => {
    const r = req({ to: ALICE, valueUsd: "10", tool: "tip" });
    const a = evaluate(basePolicy, r, emptyCtx);
    const b = evaluate(basePolicy, r, emptyCtx);
    expect(a).toEqual(b);
    expect(a.policyHash).toMatch(/^sha256:/);
  });
});
