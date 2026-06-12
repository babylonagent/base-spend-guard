#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkSpend, spendSummary, clientFromEnv } from "./handlers.js";

const client = clientFromEnv();

const server = new McpServer({
  name: "spendguard",
  version: "0.1.0",
});

server.tool(
  "check_spend_policy",
  "Evaluate a Base transaction against the configured spending policy BEFORE signing or broadcasting. Returns a decision (allow | warn | require_approval | block), the USD value, reasons, and a signed receipt when allowed.",
  {
    to: z.string().describe("Recipient or contract address (0x...)"),
    data: z.string().optional().describe("Calldata (0x...) for contract calls; omit for plain transfers"),
    value: z.string().optional().describe("Native value in wei (decimal string); usually '0' for ERC20"),
    tool: z.string().optional().describe("Logical tool/route name spending the budget"),
    valueUsd: z.string().optional().describe("Explicit USD value; if omitted it is derived from ERC20 transfer calldata"),
  },
  async (args) => {
    const result = await checkSpend(client, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "get_spend_summary",
  "Return the current UTC-day spend summary: total USD spent and a per-tool breakdown.",
  {},
  async () => {
    const summary = await spendSummary(client);
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
