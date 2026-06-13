import { SpendGuardClient, type CheckResult } from "@spendguard/sdk";
import type { Policy, SpendRequest, SpendStore } from "@spendguard/core";
import { z } from "zod";

export interface AgentKitNetwork {
  chainId?: number;
  networkId?: string;
}

export interface SpendGuardActionProviderConfig {
  policy: Policy | unknown;
  rpcUrl?: string;
  from?: string;
  signerKey?: string;
  store?: SpendStore;
}

export const spendGuardCheckSchema = z.object({
  to: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  data: z.string().regex(/^0x[0-9a-fA-F]*$/).optional(),
  value: z.string().regex(/^\d+$/).optional(),
  tool: z.string().min(1).optional(),
  valueUsd: z.string().regex(/^\d+(\.\d+)?$/).optional(),
});

export const spendGuardSummarySchema = z.object({});

export type SpendGuardCheckInput = z.infer<typeof spendGuardCheckSchema>;

export class SpendGuardActionProvider {
  public readonly name = "spendguard";
  private readonly client: SpendGuardClient;

  constructor(config: SpendGuardActionProviderConfig) {
    this.client = new SpendGuardClient(config);
  }

  supportsNetwork(network: AgentKitNetwork): boolean {
    return network.chainId === 8453 || network.networkId === "base-mainnet";
  }

  async checkSpendPolicy(input: SpendGuardCheckInput): Promise<string> {
    const request: SpendRequest = spendGuardCheckSchema.parse(input);
    const result = await this.client.checkSpend(request);
    return formatCheckResult(result);
  }

  async getSpendSummary(): Promise<string> {
    const summary = await this.client.summary();
    return JSON.stringify({ summary }, null, 2);
  }

  getActions(): Array<{
    name: string;
    description: string;
    schema: z.ZodTypeAny;
    invoke: (args: unknown) => Promise<string>;
  }> {
    return [
      {
        name: "spendguard_check_spend_policy",
        description: "Check whether a Base transaction is allowed by the configured Spend Guard policy before signing.",
        schema: spendGuardCheckSchema,
        invoke: (args) => this.checkSpendPolicy(args as SpendGuardCheckInput),
      },
      {
        name: "spendguard_get_spend_summary",
        description: "Return today's Spend Guard totals for this agent runtime.",
        schema: spendGuardSummarySchema,
        invoke: () => this.getSpendSummary(),
      },
    ];
  }
}

export function spendGuardActionProvider(config: SpendGuardActionProviderConfig): SpendGuardActionProvider {
  return new SpendGuardActionProvider(config);
}

function formatCheckResult(result: CheckResult): string {
  return JSON.stringify(
    {
      action: result.decision.action,
      valueUsd: result.decision.valueUsd,
      policyHash: result.decision.policyHash,
      reasons: result.decision.reasons,
      receipt: result.receipt,
    },
    null,
    2,
  );
}
