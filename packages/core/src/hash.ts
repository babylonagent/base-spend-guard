import { createHash } from "node:crypto";
import type { Policy } from "./types.js";

/** Deterministically serialize an object with sorted keys for stable hashing. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}

/** sha256 hash of a policy's canonical form, prefixed with the algo. */
export function policyHash(policy: Policy): string {
  const h = createHash("sha256").update(canonical(policy)).digest("hex");
  return `sha256:${h}`;
}
