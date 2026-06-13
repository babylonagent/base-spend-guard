import { describe, expect, it } from "vitest";
import { spendGuardActionProvider } from "../src/index.js";

const trusted = "0x1111111111111111111111111111111111111111";
const blocked = "0x2222222222222222222222222222222222222222";

const policy = {
  version: 1,
  chainId: 8453,
  token: "USDC",
  limits: { maxPerTxUsd: "100", maxPerDayUsd: "500" },
  recipients: { allow: [trusted], block: [blocked] },
  rules: { blockUnknownSpender: true, blockUnlimitedApproval: true, simulateBeforeSend: false },
};

describe("SpendGuardActionProvider", () => {
  it("supports Base mainnet only", () => {
    const provider = spendGuardActionProvider({ policy });
    expect(provider.supportsNetwork({ chainId: 8453 })).toBe(true);
    expect(provider.supportsNetwork({ networkId: "base-mainnet" })).toBe(true);
    expect(provider.supportsNetwork({ chainId: 1 })).toBe(false);
  });

  it("returns AgentKit-compatible actions", () => {
    const provider = spendGuardActionProvider({ policy });
    expect(provider.getActions().map((action) => action.name)).toEqual([
      "spendguard_check_spend_policy",
      "spendguard_get_spend_summary",
    ]);
  });

  it("checks spend policy and formats the decision", async () => {
    const provider = spendGuardActionProvider({ policy });
    const out = await provider.checkSpendPolicy({ to: blocked, valueUsd: "10", tool: "swap" });
    const parsed = JSON.parse(out) as { action: string; reasons: Array<{ code: string }> };
    expect(parsed.action).toBe("block");
    expect(parsed.reasons.some((reason) => reason.code === "RECIPIENT_BLOCKED")).toBe(true);
  });

  it("returns a spend summary", async () => {
    const provider = spendGuardActionProvider({ policy });
    await provider.checkSpendPolicy({ to: trusted, valueUsd: "10", tool: "swap" });
    const summary = JSON.parse(await provider.getSpendSummary()) as { summary: { totalUsd: string } };
    expect(summary.summary.totalUsd).toBe("10");
  });
});
