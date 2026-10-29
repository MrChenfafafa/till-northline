import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { jsonSchema, tool, type Tool } from "ai";
import path from "node:path";
import { createPaypalToolkit } from "@/lib/paypal";
import { parseResult } from "@/lib/ledger";

const PAYMENT_TOOLS = new Set([
  "create_order",
  "get_order",
  "pay_order",
  "create_refund",
  "get_refund",
]);

let mcpToolsPromise: Promise<Record<string, Tool>> | null = null;

function childEnv(accessToken: string): Record<string, string> {
  const env: Record<string, string> = {
    PAYPAL_ACCESS_TOKEN: accessToken,
    PAYPAL_ENVIRONMENT: "SANDBOX",
  };
  // Spawn replaces the environment; Node still consults PATH, HOME, and TMPDIR.
  for (const key of ["PATH", "HOME", "TMPDIR"] as const) {
    const value = process.env[key];
    if (typeof value === "string" && value) env[key] = value;
  }
  return env;
}

async function connectPaypalMcp(): Promise<Record<string, Tool>> {
  const toolkit = createPaypalToolkit();
  const accessToken = await toolkit.client.getAccessToken();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(process.cwd(), "scripts", "paypal-mcp-server.mjs")],
    env: childEnv(accessToken),
    stderr: "pipe",
  });
  const client = new Client(
    { name: "till-commerce-copilot", version: "0.1.0" },
    { capabilities: {} },
  );
  await client.connect(transport);
  const listed = await client.listTools();
  const tools: Record<string, Tool> = {};
  for (const entry of listed.tools) {
    if (!PAYMENT_TOOLS.has(entry.name)) continue;
    const schema = (entry.inputSchema ?? { type: "object", properties: {} }) as Parameters<
      typeof jsonSchema
    >[0];
    tools[entry.name] = tool({
      description: entry.description ?? entry.name,
      parameters: jsonSchema(schema),
      execute: async (args) => {
        const result = await client.callTool({
          name: entry.name,
          arguments: (args ?? {}) as Record<string, unknown>,
        });
        const parsed = parseResult(result);
        return JSON.stringify(parsed ?? result);
      },
    });
  }
  if (!tools.create_order || !tools.get_order || !tools.pay_order) {
    await client.close().catch(() => undefined);
    throw new Error(
      "PayPal MCP server did not expose create_order, get_order, and pay_order. Check scripts/paypal-mcp-server.mjs.",
    );
  }
  return tools;
}

export function loadMcpPaypalTools(): Promise<Record<string, Tool>> {
  if (!mcpToolsPromise) {
    mcpToolsPromise = connectPaypalMcp().catch((error) => {
      mcpToolsPromise = null;
      throw error;
    });
  }
  return mcpToolsPromise;
}

/** Test helper. Starts the MCP server, lists payment tools, then closes it. */
export async function probePaypalMcpServer(accessToken: string): Promise<string[]> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(process.cwd(), "scripts", "paypal-mcp-server.mjs")],
    env: childEnv(accessToken),
    stderr: "pipe",
  });
  const client = new Client({ name: "till-mcp-probe", version: "0.1.0" }, { capabilities: {} });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    return listed.tools.map((entry) => entry.name).sort();
  } finally {
    await client.close().catch(() => undefined);
  }
}
