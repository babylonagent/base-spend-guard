import { describe, it, expect } from "vitest";
import { InMemoryStore, dayKey } from "../src/ledger.js";
import { tryLoadPolicy } from "../src/schema.js";

describe("ledger", () => {
  it("tracks per-day and per-tool totals", () => {
    const s = new InMemoryStore();
    const at = Date.parse("2026-06-12T10:00:00Z");
    s.record({ tool: "tip", valueUsd: "10", at });
    s.record({ tool: "swap", valueUsd: "25.5", at });
    s.record({ tool: "tip", valueUsd: "5", at });
    expect(s.totalForDay(at)).toBe("40.5");
    expect(s.totalForTool("tip", at)).toBe("15");
    expect(s.byToolForDay(at)).toEqual({ tip: "15", swap: "25.5" });
  });

  it("separates by UTC day", () => {
    const s = new InMemoryStore();
    s.record({ valueUsd: "10", at: Date.parse("2026-06-12T23:00:00Z") });
    s.record({ valueUsd: "99", at: Date.parse("2026-06-13T01:00:00Z") });
    expect(s.totalForDay(Date.parse("2026-06-12T23:30:00Z"))).toBe("10");
    expect(dayKey(Date.parse("2026-06-13T01:00:00Z"))).toBe("2026-06-13");
  });
});

describe("schema", () => {
  it("accepts a valid policy", () => {
    const res = tryLoadPolicy({ version: 1, chainId: 8453, token: "USDC" });
    expect(res.ok).toBe(true);
  });

  it("rejects unknown keys and bad types", () => {
    const res = tryLoadPolicy({ version: 1, chainId: 8453, token: "USDC", bogus: true });
    expect(res.ok).toBe(false);
  });

  it("rejects malformed addresses", () => {
    const res = tryLoadPolicy({
      version: 1,
      chainId: 8453,
      token: "USDC",
      recipients: { allow: ["not-an-address"] },
    });
    expect(res.ok).toBe(false);
  });
});
