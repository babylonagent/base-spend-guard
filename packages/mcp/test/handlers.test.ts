import { describe, it, expect, beforeAll } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clientFromEnv, checkSpend, spendSummary } from "../src/handlers.js";
import type { SpendGuardClient } from "@spendguard/sdk";

const ALICE = "0x1111111111111111111111111111111111111111";

let client: SpendGuardClient;

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), "spendguard-"));
  const policyPath = join(dir, "policy.json");
  writeFileSync(
    policyPath,
    JSON.stringify({
      version: 1,
      chainId: 8453,
      token: "USDC",
      limits: { maxPerTxUsd: "100", maxPerDayUsd: "200" },
      recipients: { allow: [ALICE] },
      approval: { thresholdUsd: "1000" },
      rules: { blockUnknownSpender: true, blockUnlimitedApproval: true, simulateBeforeSend: false },
    }),
  );
  client = clientFromEnv({ SPENDGUARD_POLICY: policyPath } as NodeJS.ProcessEnv);
});

describe("mcp handlers", () => {
  it("check_spend_policy allows an in-policy spend", async () => {
    const res = await checkSpend(client, { to: ALICE, valueUsd: "10", tool: "tip" });
    expect(res.allowed).toBe(true);
    expect(res.action).toBe("allow");
  });

  it("check_spend_policy blocks an over-limit spend", async () => {
    const res = await checkSpend(client, { to: ALICE, valueUsd: "150", tool: "tip" });
    expect(res.action).toBe("block");
    expect(res.reasons.map((r) => r.code)).toContain("OVER_PER_TX_LIMIT");
  });

  it("get_spend_summary reflects recorded spend", async () => {
    const summary = await spendSummary(client);
    expect(typeof summary.totalUsd).toBe("string");
  });

  it("throws without SPENDGUARD_POLICY", () => {
    expect(() => clientFromEnv({} as NodeJS.ProcessEnv)).toThrow();
  });
});
