import { describe, expect, it } from "vitest";
import type { Policy } from "@spendguard/core";
import { spendGuardActionProvider } from "../src/agentkit.js";
import type { Simulator } from "../src/simulator.js";

const ALICE = "0x1111111111111111111111111111111111111111";

const policy: Policy = {
  version: 1,
  chainId: 8453,
  token: "USDC",
  limits: { maxPerTxUsd: "25", maxPerDayUsd: "40" },
  recipients: { allow: [ALICE] },
  rules: { simulateBeforeSend: true },
};

class OkSim implements Simulator {
  async simulate() {
    return { success: true, gasUsed: "21000" };
  }
}

describe("spendGuardActionProvider", () => {
  it("exposes Base-only AgentKit-compatible actions", () => {
    const provider = spendGuardActionProvider({ policy, simulator: new OkSim() });

    expect(provider.name).toBe("spendguard");
    expect(provider.supportsNetwork({ chainId: "8453", protocolFamily: "evm", networkId: "base-mainnet" })).toBe(true);
    expect(provider.supportsNetwork({ chainId: "1", protocolFamily: "evm", networkId: "ethereum-mainnet" })).toBe(false);
    expect(provider.getActions().map((action) => action.name)).toEqual([
      "spendguard_check_spend_policy",
      "spendguard_get_spend_summary",
    ]);
  });

  it("checks spend policy through an action", async () => {
    const provider = spendGuardActionProvider({ policy, simulator: new OkSim() });
    const [check] = provider.getActions();

    const result = JSON.parse(await check.invoke({ to: ALICE, valueUsd: "10", tool: "tip" }));

    expect(result.action).toBe("allow");
    expect(result.valueUsd).toBe("10");
    expect(result.reasons.map((reason: { code: string }) => reason.code)).toEqual(["OK"]);
  });

  it("returns daily spend summary after allowed action", async () => {
    const provider = spendGuardActionProvider({ policy, simulator: new OkSim() });
    const [check, summary] = provider.getActions();

    await check.invoke({ to: ALICE, valueUsd: "10", tool: "tip" });
    const result = JSON.parse(await summary.invoke({}));

    expect(result.totalUsd).toBe("10");
    expect(result.byTool.tip).toBe("10");
  });
});
