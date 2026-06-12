import type { SpendStore } from "./types.js";
import { addUsd } from "./decimal.js";

/** UTC day key (YYYY-MM-DD) for a given epoch-ms timestamp. */
export function dayKey(at: number = Date.now()): string {
  return new Date(at).toISOString().slice(0, 10);
}

interface LedgerEntry {
  day: string;
  tool?: string;
  valueUsd: string;
}

/**
 * In-memory spend ledger keyed by UTC day. Durable stores can implement the
 * SpendStore interface (e.g. SQLite, Redis) with the same semantics.
 */
export class InMemoryStore implements SpendStore {
  private entries: LedgerEntry[] = [];

  record(entry: { tool?: string; valueUsd: string; at?: number }): void {
    this.entries.push({
      day: dayKey(entry.at),
      tool: entry.tool,
      valueUsd: entry.valueUsd,
    });
  }

  totalForDay(at: number = Date.now()): string {
    const day = dayKey(at);
    return this.entries
      .filter((e) => e.day === day)
      .reduce((acc, e) => addUsd(acc, e.valueUsd), "0");
  }

  totalForTool(tool: string, at: number = Date.now()): string {
    const day = dayKey(at);
    return this.entries
      .filter((e) => e.day === day && e.tool === tool)
      .reduce((acc, e) => addUsd(acc, e.valueUsd), "0");
  }

  /** Map of tool -> USD spent today. */
  byToolForDay(at: number = Date.now()): Record<string, string> {
    const day = dayKey(at);
    const out: Record<string, string> = {};
    for (const e of this.entries) {
      if (e.day !== day || !e.tool) continue;
      out[e.tool] = addUsd(out[e.tool] ?? "0", e.valueUsd);
    }
    return out;
  }

  clear(): void {
    this.entries = [];
  }
}
