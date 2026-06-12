import {
  evaluate,
  InMemoryStore,
  loadPolicy,
  type Decision,
  type EvalContext,
  type EvaluateOptions,
  type Policy,
  type SpendRequest,
  type SpendStore,
} from "@spendguard/core";
import { randomUUID } from "node:crypto";
import { BaseRpcSimulator, NoopSimulator, type Simulator } from "./simulator.js";
import { signReceipt, type SignedReceipt } from "./receipts.js";

export interface SpendGuardConfig {
  /** Policy object (already parsed) or raw JSON to validate. */
  policy: Policy | unknown;
  /** Base RPC URL for pre-tx simulation. If omitted, simulation is skipped. */
  rpcUrl?: string;
  /** Custom simulator (overrides rpcUrl). */
  simulator?: Simulator;
  /** Spend ledger store. Defaults to in-memory. */
  store?: SpendStore;
  /** "from" address used when simulating. */
  from?: string;
  /** Private key used to sign receipts. If omitted, receipts are unsigned. */
  signerKey?: string;
  /** Valuation options (token decimals / price). */
  valuation?: EvaluateOptions;
}

export interface CheckResult {
  decision: Decision;
  /** Present only when decision.action === "allow" and a signerKey is set. */
  receipt?: SignedReceipt;
}

export class SpendGuardClient {
  private readonly policy: Policy;
  private readonly simulator: Simulator;
  private readonly store: SpendStore;
  private readonly from: string;
  private readonly signerKey?: string;
  private readonly valuation: EvaluateOptions;
  private readonly simulateEnabled: boolean;

  constructor(config: SpendGuardConfig) {
    this.policy = loadPolicy(config.policy);
    this.store = config.store ?? new InMemoryStore();
    this.from = config.from ?? "0x0000000000000000000000000000000000000001";
    this.signerKey = config.signerKey;
    this.valuation = config.valuation ?? {};
    this.simulateEnabled = this.policy.rules?.simulateBeforeSend ?? false;

    if (config.simulator) {
      this.simulator = config.simulator;
    } else if (config.rpcUrl) {
      this.simulator = new BaseRpcSimulator(config.rpcUrl);
    } else {
      this.simulator = new NoopSimulator();
    }
  }

  /** Evaluate a spend request. Optionally simulates first, then applies policy. */
  async checkSpend(request: SpendRequest): Promise<CheckResult> {
    let req = request;

    if (this.simulateEnabled && req.simulation === undefined) {
      const simulation = await this.simulator.simulate(req, this.from);
      req = { ...req, simulation };
    }

    const ctx: EvalContext = {
      spentTodayUsd: await Promise.resolve(this.store.totalForDay()),
      spentTodayByTool: this.byToolSnapshot(),
    };

    const decision = evaluate(this.policy, req, ctx, this.valuation);

    let receipt: SignedReceipt | undefined;
    if (decision.action === "allow") {
      // Record the spend against the daily ledger.
      await Promise.resolve(
        this.store.record({ tool: req.tool, valueUsd: decision.valueUsd }),
      );
      if (this.signerKey) {
        receipt = await signReceipt(
          {
            to: req.to,
            valueUsd: decision.valueUsd,
            tool: req.tool,
            decision: decision.action,
            policyHash: decision.policyHash,
            timestamp: Date.now(),
            nonce: randomUUID(),
          },
          this.signerKey,
        );
      }
    }

    return { decision, receipt };
  }

  /** Current daily spend summary. */
  async summary(): Promise<{ totalUsd: string; byTool: Record<string, string> }> {
    return {
      totalUsd: await Promise.resolve(this.store.totalForDay()),
      byTool: this.byToolSnapshot(),
    };
  }

  private byToolSnapshot(): Record<string, string> {
    const s = this.store as Partial<{ byToolForDay: () => Record<string, string> }>;
    return typeof s.byToolForDay === "function" ? s.byToolForDay() : {};
  }

  policyRef(): Policy {
    return this.policy;
  }
}
