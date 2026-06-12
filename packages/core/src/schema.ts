import { z } from "zod";
import type { Policy } from "./types.js";

const addressRe = /^0x[0-9a-fA-F]{40}$/;
const decimalStr = z.string().regex(/^\d+(\.\d+)?$/, "must be a non-negative decimal string");
const address = z.string().regex(addressRe, "must be a 0x-prefixed 20-byte address");

export const policySchema = z.object({
  version: z.number().int().positive(),
  chainId: z.number().int().positive(),
  token: z.string().min(1),
  limits: z
    .object({
      maxPerTxUsd: decimalStr.optional(),
      maxPerDayUsd: decimalStr.optional(),
      maxPerTool: z.record(decimalStr).optional(),
    })
    .strict()
    .optional(),
  recipients: z
    .object({
      allow: z.array(address).optional(),
      block: z.array(address).optional(),
    })
    .strict()
    .optional(),
  approval: z
    .object({
      thresholdUsd: decimalStr.optional(),
    })
    .strict()
    .optional(),
  rules: z
    .object({
      blockUnknownSpender: z.boolean().optional(),
      blockUnlimitedApproval: z.boolean().optional(),
      simulateBeforeSend: z.boolean().optional(),
    })
    .strict()
    .optional(),
}).strict();

export type PolicyInput = z.input<typeof policySchema>;

/** Validate and normalize a policy object. Throws ZodError on invalid input. */
export function loadPolicy(input: unknown): Policy {
  const parsed = policySchema.parse(input);
  // Normalize addresses to lowercase for consistent comparison.
  if (parsed.recipients?.allow) {
    parsed.recipients.allow = parsed.recipients.allow.map((a) => a.toLowerCase());
  }
  if (parsed.recipients?.block) {
    parsed.recipients.block = parsed.recipients.block.map((a) => a.toLowerCase());
  }
  return parsed as Policy;
}

/** Safe variant returning a result object instead of throwing. */
export function tryLoadPolicy(
  input: unknown,
): { ok: true; policy: Policy } | { ok: false; errors: string[] } {
  const res = policySchema.safeParse(input);
  if (res.success) {
    return { ok: true, policy: loadPolicy(input) };
  }
  return { ok: false, errors: res.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`) };
}
