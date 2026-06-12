import type {
  Decision,
  DecisionAction,
  DecisionReason,
  EvalContext,
  Policy,
  SpendRequest,
} from "./types.js";
import { addUsd, gtUsd, gteUsd } from "./decimal.js";
import { decodeErc20, tokenAmountToUsd } from "./decoder.js";
import { policyHash } from "./hash.js";

/** Severity ordering so we can escalate to the strongest action. */
const ACTION_RANK: Record<DecisionAction, number> = {
  allow: 0,
  warn: 1,
  require_approval: 2,
  block: 3,
};

function strongest(a: DecisionAction, b: DecisionAction): DecisionAction {
  return ACTION_RANK[a] >= ACTION_RANK[b] ? a : b;
}

export interface EvaluateOptions {
  /** Token decimals for USD valuation (default 6 / USDC). */
  decimals?: number;
  /** Token price in USD as decimal string (default "1" for stables). */
  priceUsd?: string;
}

/**
 * Deterministically evaluate a spend request against a policy.
 * No randomness, no network, no LLM. Same input -> same output.
 *
 * Precedence (strongest wins, but all triggered reasons are reported):
 *   block-list > reverting tx > over-per-tx > over-per-day > over-per-tool
 *   > unlimited-approval > unknown-spender > approval-threshold > allow
 */
export function evaluate(
  policy: Policy,
  request: SpendRequest,
  ctx: EvalContext,
  opts: EvaluateOptions = {},
): Decision {
  const reasons: DecisionReason[] = [];
  let action: DecisionAction = "allow";

  const decoded = decodeErc20(request.data);
  const recipient = (decoded.target ?? request.to ?? "").toLowerCase();

  // Resolve USD value: explicit > decoded ERC20 transfer/approve amount > 0.
  let valueUsd = request.valueUsd;
  if (valueUsd === undefined && decoded.amount !== undefined && !decoded.isApproval) {
    valueUsd = tokenAmountToUsd(decoded.amount, opts);
  }
  if (valueUsd === undefined) valueUsd = "0";

  const add = (a: DecisionAction, r: DecisionReason) => {
    action = strongest(action, a);
    reasons.push(r);
  };

  // 1. Block-list (hard stop).
  const blocked = policy.recipients?.block ?? [];
  if (recipient && blocked.includes(recipient)) {
    add("block", {
      code: "RECIPIENT_BLOCKED",
      message: `Recipient ${recipient} is on the block-list.`,
      severity: "danger",
    });
  }

  // 2. Reverting transaction (from injected simulation).
  if (policy.rules?.simulateBeforeSend && request.simulation && !request.simulation.success) {
    add("block", {
      code: "TX_REVERTS",
      message: `Transaction would revert: ${request.simulation.error ?? "unknown reason"}.`,
      severity: "danger",
    });
  }

  // 3. Per-transaction cap.
  const maxPerTx = policy.limits?.maxPerTxUsd;
  if (maxPerTx && gtUsd(valueUsd, maxPerTx)) {
    add("block", {
      code: "OVER_PER_TX_LIMIT",
      message: `Spend ${valueUsd} USD exceeds per-tx cap ${maxPerTx} USD.`,
      severity: "danger",
    });
  }

  // 4. Per-day cap (projected total).
  const maxPerDay = policy.limits?.maxPerDayUsd;
  if (maxPerDay) {
    const projected = addUsd(ctx.spentTodayUsd ?? "0", valueUsd);
    if (gtUsd(projected, maxPerDay)) {
      add("block", {
        code: "OVER_DAILY_LIMIT",
        message: `Projected daily spend ${projected} USD exceeds cap ${maxPerDay} USD.`,
        severity: "danger",
      });
    }
  }

  // 5. Per-tool cap.
  const tool = request.tool;
  const perTool = policy.limits?.maxPerTool;
  if (perTool && tool) {
    const cap = perTool[tool] ?? perTool["default"];
    if (cap) {
      const spentTool = ctx.spentTodayByTool?.[tool] ?? "0";
      const projected = addUsd(spentTool, valueUsd);
      if (gtUsd(projected, cap)) {
        add("block", {
          code: "OVER_TOOL_LIMIT",
          message: `Projected ${tool} spend ${projected} USD exceeds cap ${cap} USD.`,
          severity: "danger",
        });
      }
    }
  }

  // 6. Unlimited approval.
  if (decoded.isApproval && decoded.unlimited) {
    const act: DecisionAction = policy.rules?.blockUnlimitedApproval ? "block" : "warn";
    add(act, {
      code: "UNLIMITED_APPROVAL",
      message: `Unlimited token approval to ${recipient}.`,
      severity: policy.rules?.blockUnlimitedApproval ? "danger" : "warn",
    });
  }

  // 7. Unknown spender / recipient not on allow-list.
  const allow = policy.recipients?.allow ?? [];
  if (allow.length > 0 && recipient && !allow.includes(recipient)) {
    const act: DecisionAction = policy.rules?.blockUnknownSpender ? "block" : "warn";
    add(act, {
      code: "UNKNOWN_SPENDER",
      message: `Recipient ${recipient} is not on the allow-list.`,
      severity: policy.rules?.blockUnknownSpender ? "danger" : "warn",
    });
  }

  // 8. Approval threshold (human-in-the-loop gate).
  const threshold = policy.approval?.thresholdUsd;
  if (threshold && gteUsd(valueUsd, threshold)) {
    add("require_approval", {
      code: "APPROVAL_REQUIRED",
      message: `Spend ${valueUsd} USD is at/above approval threshold ${threshold} USD.`,
      severity: "warn",
    });
  }

  if (reasons.length === 0) {
    reasons.push({
      code: "OK",
      message: "Within policy. No risks detected.",
      severity: "info",
    });
  }

  return { action, reasons, valueUsd, policyHash: policyHash(policy) };
}
