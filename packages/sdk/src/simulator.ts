import type { SimulationResult, SpendRequest } from "@spendguard/core";

/** Abstract RPC simulator: returns whether the tx would succeed on Base. */
export interface Simulator {
  simulate(req: SpendRequest, from: string): Promise<SimulationResult>;
}

interface JsonRpcResponse {
  result?: string;
  error?: { code: number; message: string };
}

/**
 * Base RPC simulator using eth_call + eth_estimateGas.
 * Deterministic-ish: reflects current chain state. A revert in eth_call
 * marks the transaction as failing. No private keys, read-only.
 */
export class BaseRpcSimulator implements Simulator {
  constructor(private readonly rpcUrl: string) {}

  private async call(method: string, params: unknown[]): Promise<JsonRpcResponse> {
    const res = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (!res.ok) {
      return { error: { code: res.status, message: `HTTP ${res.status}` } };
    }
    return (await res.json()) as JsonRpcResponse;
  }

  async simulate(req: SpendRequest, from: string): Promise<SimulationResult> {
    const tx = {
      from,
      to: req.to,
      data: req.data ?? "0x",
      value: req.value && req.value !== "0" ? "0x" + BigInt(req.value).toString(16) : "0x0",
    };

    const callRes = await this.call("eth_call", [tx, "latest"]);
    if (callRes.error) {
      return { success: false, error: callRes.error.message };
    }

    const gasRes = await this.call("eth_estimateGas", [tx]);
    if (gasRes.error) {
      return { success: false, error: gasRes.error.message };
    }
    const gasUsed = gasRes.result ? BigInt(gasRes.result).toString() : undefined;
    return { success: true, gasUsed };
  }
}

/** Simulator that always succeeds — useful for tests and offline mode. */
export class NoopSimulator implements Simulator {
  async simulate(): Promise<SimulationResult> {
    return { success: true };
  }
}
