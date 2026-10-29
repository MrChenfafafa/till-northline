import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { probePaypalMcpServer } from "../src/lib/mcp";

describe("PayPal MCP server", () => {
  it("lists payment tools without calling the PayPal API", async () => {
    const names = await probePaypalMcpServer("sandbox-probe-token");
    for (const name of ["create_order", "get_order", "pay_order", "create_refund", "get_refund"]) {
      assert.ok(names.includes(name), `missing ${name} in ${names.join(", ")}`);
    }
  });
});
