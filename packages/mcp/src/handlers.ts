import { readFileSync } from "node:fs";
import { SpendGuardClient, type SpendGuardConfig } from "@spendguard/sdk";
import type { SpendRequest } from "@spendguard/core";

/**
 * Build a SpendGuardClient from environment configuration.
 *   SPENDGUARD_POLICY    path to policy.json (required)
 *   BASE_RPC_URL         optional Base RPC for pre-tx simulation
 *   SPENDGUARD_SIGNER_KEY optional key to sign receipts
 *   SPENDGUARD_FROM      optional "from" address for simulation
 */
export function clientFromEnv(env: NodeJS.ProcessEnv = process.env): SpendGuardClient {
  const policyPath = env.SPENDGUARD_POLICY;
  if (!policyPath) {
    throw new Error("SPENDGUARD_POLICY env var (path to policy.json) is required");
  }
  const policy = JSON.parse(readFileSync(policyPath, "utf8"));
  const config: SpendGuardConfig = {
    policy,
    rpcUrl: env.BASE_RPC_URL,
    signerKey: env.SPENDGUARD_SIGNER_KEY || undefined,
    from: env.SPENDGUARD_FROM || undefined,
  };
  return new SpendGuardClient(config);
}

export interface CheckSpendArgs {
  to: string;
  data?: string;
  value?: string;
  tool?: string;
  valueUsd?: string;
}

/** Run a policy check and return a compact, agent-friendly result. */
export async function checkSpend(client: SpendGuardClient, args: CheckSpendArgs) {
  const request: SpendRequest = {
    to: args.to,
    data: args.data,
    value: args.value,
    tool: args.tool,
    valueUsd: args.valueUsd,
  };
  const { decision, receipt } = await client.checkSpend(request);
  return {
    action: decision.action,
    allowed: decision.action === "allow",
    valueUsd: decision.valueUsd,
    reasons: decision.reasons,
    policyHash: decision.policyHash,
    receipt: receipt ?? null,
  };
}

/** Return current daily spend totals. */
export async function spendSummary(client: SpendGuardClient) {
  return client.summary();
}
