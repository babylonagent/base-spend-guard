// Smoke test: spawn the MCP stdio server, list tools, call check_spend_policy.
import { spawn } from "node:child_process";

const server = spawn("node", ["packages/mcp/dist/server.js"], {
  env: { ...process.env, SPENDGUARD_POLICY: "./policy.json" },
  stdio: ["pipe", "pipe", "inherit"],
});

let buf = "";
const pending = new Map();

server.stdout.on("data", (chunk) => {
  buf += chunk.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function rpc(id, method, params) {
  return new Promise((resolve) => {
    pending.set(id, resolve);
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

const fail = (m) => {
  console.error("FAIL:", m);
  server.kill();
  process.exit(1);
};

try {
  const init = await rpc(1, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0.0.0" },
  });
  if (!init.result) fail("initialize returned no result");

  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  const tools = await rpc(2, "tools/list", {});
  const names = (tools.result?.tools ?? []).map((t) => t.name);
  console.log("tools:", names.join(", "));
  if (!names.includes("check_spend_policy") || !names.includes("get_spend_summary")) {
    fail("expected tools missing");
  }

  const allow = await rpc(3, "tools/call", {
    name: "check_spend_policy",
    arguments: { to: "0x1111111111111111111111111111111111111111", valueUsd: "10", tool: "tip" },
  });
  const allowText = allow.result?.content?.[0]?.text ?? "";
  const allowJson = JSON.parse(allowText);
  console.log("allow case action:", allowJson.action);
  if (allowJson.action !== "allow") fail("expected allow");

  const block = await rpc(4, "tools/call", {
    name: "check_spend_policy",
    arguments: { to: "0x9999999999999999999999999999999999999999", valueUsd: "10", tool: "tip" },
  });
  const blockJson = JSON.parse(block.result?.content?.[0]?.text ?? "{}");
  console.log("unknown-spender action:", blockJson.action);
  if (blockJson.action !== "block") fail("expected block");

  console.log("PASS: MCP stdio server responds correctly");
  server.kill();
  process.exit(0);
} catch (e) {
  fail(String(e));
}
