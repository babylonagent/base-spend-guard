/**
 * Core types for the Base Spend Guard policy engine.
 * Amounts denominated in USD are passed as decimal strings to avoid float drift.
 */

export type DecisionAction = "allow" | "warn" | "require_approval" | "block";

export interface DecisionReason {
  code: string;
  message: string;
  severity: "info" | "warn" | "danger";
}

export interface Decision {
  action: DecisionAction;
  reasons: DecisionReason[];
  /** USD value attributed to this request, decimal string. */
  valueUsd: string;
  /** sha256 of the canonical policy used for this evaluation. */
  policyHash: string;
}

/** A single spend the agent wants to perform, before signing/broadcasting. */
export interface SpendRequest {
  /** Target contract or EOA. */
  to: string;
  /** Calldata (0x...) when interacting with a contract; empty/0x for plain transfer. */
  data?: string;
  /** Native value in wei as decimal string (usually "0" for ERC20). */
  value?: string;
  /** Logical tool/route name spending the budget (e.g. "swap", "tip"). */
  tool?: string;
  /** Optional pre-computed USD value; if absent, derived from decoded ERC20 transfer. */
  valueUsd?: string;
  /** Optional simulation result injected by the SDK. */
  simulation?: SimulationResult;
}

export interface SimulationResult {
  /** true if the transaction would succeed on-chain. */
  success: boolean;
  gasUsed?: string;
  error?: string;
}

export interface PolicyLimits {
  maxPerTxUsd?: string;
  maxPerDayUsd?: string;
  /** Per-tool caps; "default" applies to any tool without a specific entry. */
  maxPerTool?: Record<string, string>;
}

export interface PolicyRecipients {
  /** If non-empty, only these recipients are allowed (allow-list mode). */
  allow?: string[];
  /** Always-blocked recipients (takes precedence over allow). */
  block?: string[];
}

export interface PolicyApproval {
  /** Spends at or above this USD value require approval. */
  thresholdUsd?: string;
}

export interface PolicyRules {
  blockUnknownSpender?: boolean;
  blockUnlimitedApproval?: boolean;
  simulateBeforeSend?: boolean;
}

export interface Policy {
  version: number;
  chainId: number;
  token: string;
  limits?: PolicyLimits;
  recipients?: PolicyRecipients;
  approval?: PolicyApproval;
  rules?: PolicyRules;
}

/** Context passed to the engine beyond the request itself. */
export interface EvalContext {
  /** USD already spent today (UTC) overall. */
  spentTodayUsd: string;
  /** USD already spent today per tool. */
  spentTodayByTool?: Record<string, string>;
}

/** Pluggable persistence for the daily spend ledger. */
export interface SpendStore {
  record(entry: { tool?: string; valueUsd: string; at?: number }): void | Promise<void>;
  totalForDay(at?: number): string | Promise<string>;
  totalForTool(tool: string, at?: number): string | Promise<string>;
}
