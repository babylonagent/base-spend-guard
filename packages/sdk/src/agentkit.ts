import type { SpendRequest } from "@spendguard/core";
import { SpendGuardClient, type SpendGuardConfig } from "./client.js";

export interface AgentKitNetwork {
  chainId?: string | number;
  networkId?: string;
  protocolFamily?: string;
}

export interface AgentKitAction {
  name: string;
  description: string;
  schema: unknown;
  invoke: (args: unknown) => Promise<string>;
}

export interface AgentKitActionProvider {
  name: string;
  getActions: () => AgentKitAction[];
  supportsNetwork: (network: AgentKitNetwork) => boolean;
}

export interface SpendGuardActionProviderConfig extends SpendGuardConfig {
  chainId?: number;
}

const spendRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["to"],
  properties: {
    to: { type: "string", description: "Target contract or recipient address." },
    data: { type: "string", description: "Optional calldata, 0x-prefixed." },
    value: { type: "string", description: "Optional native value in wei." },
    valueUsd: { type: "string", description: "Optional USD value as a decimal string." },
    tool: { type: "string", description: "Calling agent tool name for per-tool budgets." },
  },
} as const;

const emptySchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} as const;

export function spendGuardActionProvider(config: SpendGuardActionProviderConfig): AgentKitActionProvider {
  const client = new SpendGuardClient(config);
  const chainId = config.chainId ?? client.policyRef().chainId;

  return {
    name: "spendguard",
    supportsNetwork(network: AgentKitNetwork) {
      if (network.protocolFamily && network.protocolFamily !== "evm") return false;
      return Number(network.chainId) === chainId;
    },
    getActions() {
      return [
        {
          name: "spendguard_check_spend_policy",
          description: "Check a Base spend request against the Spend Guard policy before signing or broadcasting.",
          schema: spendRequestSchema,
          async invoke(args: unknown) {
            const { decision, receipt } = await client.checkSpend(args as SpendRequest);
            return JSON.stringify({ ...decision, receipt }, null, 2);
          },
        },
        {
          name: "spendguard_get_spend_summary",
          description: "Return current Spend Guard daily spend totals by policy ledger and tool.",
          schema: emptySchema,
          async invoke() {
            return JSON.stringify(await client.summary(), null, 2);
          },
        },
      ];
    },
  };
}
