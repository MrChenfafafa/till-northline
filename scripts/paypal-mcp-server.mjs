/**
 * PayPal MCP server used by Till when PAYPAL_TOOL_PATH=mcp.
 * The parent process mints a sandbox access token from PAYPAL_CLIENT_ID and
 * PAYPAL_CLIENT_SECRET and passes it here. Do not print the token.
 */
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const accessToken = process.env.PAYPAL_ACCESS_TOKEN;
if (!accessToken) {
  console.error("PAYPAL_ACCESS_TOKEN is required to start the PayPal MCP server.");
  process.exit(1);
}

const server = new PayPalAgentToolkit({
  accessToken,
  configuration: {
    actions: {
      orders: { create: true, get: true, capture: true },
      payments: { createRefund: true, getRefunds: true },
    },
    context: { sandbox: true },
  },
});

const transport = new StdioServerTransport();
await server.connect(transport);
