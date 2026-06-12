import { describe, it, expect } from "vitest";
import { SpendGuardClient } from "../src/client.js";
import type { Simulator } from "../src/simulator.js";
import type { Policy, SimulationResult } from "@spendguard/core";

const ALICE = "0x1111111111111111111111111111111111111111";
const TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const policy: Policy = {
  version: 1,
  chainId: 8453,
  token: "USDC",
  limits: { maxPerTxUsd: "100", maxPerDayUsd: "150" },
  recipients: { allow: [ALICE] },
  approval: { thresholdUsd: "1000" },
  rules: { blockUnknownSpender: true, blockUnlimitedApproval: true, simulateBeforeSend: true },
};

class OkSim implements Simulator {
  async simulate(): Promise<SimulationResult> {
    return { success: true, gasUsed: "21000" };
  }
}
class RevertSim implements Simulator {
  async simulate(): Promise<SimulationResult> {
    return { success: false, error: "execution reverted" };
  }
}

describe("SpendGuardClient", () => {
  it("allows an in-policy spend and issues a signed receipt", async () => {
    const c = new SpendGuardClient({ policy, simulator: new OkSim(), signerKey: TEST_KEY });
    const { decision, receipt } = await c.checkSpend({ to: ALICE, valueUsd: "10", tool: "tip" });
    expect(decision.action).toBe("allow");
    expect(receipt).toBeDefined();
    expect(receipt!.valueUsd).toBe("10");
  });

  it("tracks daily spend and blocks when projected over the cap", async () => {
    const c = new SpendGuardClient({ policy, simulator: new OkSim() });
    await c.checkSpend({ to: ALICE, valueUsd: "100", tool: "tip" });
    const second = await c.checkSpend({ to: ALICE, valueUsd: "60", tool: "tip" });
    expect(second.decision.action).toBe("block");
    expect(second.decision.reasons.map((r) => r.code)).toContain("OVER_DAILY_LIMIT");
    const sum = await c.summary();
    expect(sum.totalUsd).toBe("100");
  });

  it("blocks a reverting transaction via simulation", async () => {
    const c = new SpendGuardClient({ policy, simulator: new RevertSim() });
    const { decision } = await c.checkSpend({ to: ALICE, valueUsd: "5", tool: "tip" });
    expect(decision.action).toBe("block");
    expect(decision.reasons.map((r) => r.code)).toContain("TX_REVERTS");
  });

  it("does not issue a receipt for a blocked spend", async () => {
    const c = new SpendGuardClient({ policy, simulator: new OkSim(), signerKey: TEST_KEY });
    const { decision, receipt } = await c.checkSpend({ to: ALICE, valueUsd: "200", tool: "tip" });
    expect(decision.action).toBe("block");
    expect(receipt).toBeUndefined();
  });
});
