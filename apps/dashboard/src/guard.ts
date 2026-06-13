import { evaluate, loadPolicy, type Decision, type Policy, type SpendRequest } from "@spendguard/core";

export const defaultPolicy: Policy = loadPolicy({
  version: 1,
  chainId: 8453,
  token: "USDC",
  limits: { maxPerTxUsd: "100", maxPerDayUsd: "500", maxPerTool: { default: "50" } },
  recipients: { allow: ["0x1111111111111111111111111111111111111111"], block: [] },
  approval: { thresholdUsd: "100" },
  rules: { blockUnknownSpender: true, blockUnlimitedApproval: true, simulateBeforeSend: false },
});

export const defaultRequest: SpendRequest = {
  to: "0x1111111111111111111111111111111111111111",
  valueUsd: "25",
  tool: "tip",
};

export function parseJson<T>(raw: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" };
  }
}

export function previewDecision(policyRaw: string, requestRaw: string): { decision?: Decision; error?: string } {
  const policyJson = parseJson<unknown>(policyRaw);
  if (!policyJson.ok) return { error: `Policy JSON: ${policyJson.error}` };

  const requestJson = parseJson<SpendRequest>(requestRaw);
  if (!requestJson.ok) return { error: `Request JSON: ${requestJson.error}` };

  try {
    const policy = loadPolicy(policyJson.value);
    const decision = evaluate(policy, requestJson.value, {
      spentTodayUsd: "0",
      spentTodayByTool: {},
    });
    return { decision };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unable to evaluate policy" };
  }
}
