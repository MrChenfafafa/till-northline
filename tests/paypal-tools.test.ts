import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quoteCart } from "../src/lib/catalog";
import { SandboxOnlyError, assertSandbox } from "../src/lib/env";
import { createPaypalToolkit, guardCreateOrder } from "../src/lib/paypal";

describe("PayPal sandbox guard", () => {
  it("refuses live and accepts sandbox", () => {
    assert.throws(() => assertSandbox("live"), SandboxOnlyError);
    assert.throws(() => assertSandbox("production"), SandboxOnlyError);
    assert.equal(assertSandbox(undefined), "sandbox");
    assert.equal(assertSandbox("sandbox"), "sandbox");
  });

  it("registers toolkit order tools against the sandbox host", () => {
    const previous = process.env.PAYPAL_ENV;
    process.env.PAYPAL_ENV = "sandbox";
    try {
      const toolkit = createPaypalToolkit({
        clientId: "dummy-client-id",
        clientSecret: "dummy-client-secret",
      });
      assert.equal(toolkit.client.getBaseUrl(), "https://api.sandbox.paypal.com");
      const tools = toolkit.getTools();
      for (const name of ["create_order", "get_order", "pay_order", "create_refund", "get_refund"]) {
        assert.ok(tools[name]?.execute, `missing ${name}`);
      }
    } finally {
      if (previous == null) delete process.env.PAYPAL_ENV;
      else process.env.PAYPAL_ENV = previous;
    }
  });

  it("does not call PayPal before the buyer confirms, and rejects unknown items", async () => {
    const previous = process.env.PAYPAL_ENV;
    process.env.PAYPAL_ENV = "sandbox";
    try {
      const toolkit = createPaypalToolkit({
        clientId: "dummy-client-id",
        clientSecret: "dummy-client-secret",
      });
      const original = toolkit.getTools().create_order.execute!;
      let called = false;
      const wrapped = guardCreateOrder(
        async (args) => {
          called = true;
          return original(args, { toolCallId: "should-not-run", messages: [] });
        },
        [{ role: "user", content: "I want a mug" }],
        "http://127.0.0.1:41731",
      );
      const blocked = await wrapped(
        {
          items: [{ name: "Trail Tin Mug", quantity: 1 }],
        },
        { toolCallId: "test", messages: [] },
      );
      assert.equal(called, false);
      assert.match(String(blocked), /has not confirmed/i);

      const confirmed = guardCreateOrder(
        async () => {
          called = true;
          return JSON.stringify({ id: "SHOULD_NOT_HAPPEN" });
        },
        [{ role: "user", content: "Yes, check out with PayPal" }],
        "http://127.0.0.1:41731",
      );
      const unknown = await confirmed(
        { items: [{ name: "Gold Bar", quantity: 1, itemCost: 1 }] },
        { toolCallId: "test", messages: [] },
      );
      assert.equal(called, false);
      assert.match(String(unknown), /unknown shelf item/i);
    } finally {
      if (previous == null) delete process.env.PAYPAL_ENV;
      else process.env.PAYPAL_ENV = previous;
    }
  });

  it("quotes create_order from the catalog and omits shipping", async () => {
    const origin = "http://127.0.0.1:41731";
    const quote = quoteCart([{ name: "Trail Tin Mug", quantity: 2 }], {
      returnUrl: `${origin}/checkout/return`,
      cancelUrl: `${origin}/checkout/cancel`,
    });
    assert.ok(!("error" in quote));
    if ("error" in quote) return;

    let received: Record<string, unknown> | undefined;
    const wrapped = guardCreateOrder(
      async (args) => {
        received = args as Record<string, unknown>;
        return JSON.stringify({ id: "ORDER123" });
      },
      [{ role: "user", content: "Yes, check out with PayPal" }],
      origin,
    );
    const result = await wrapped(
      {
        items: [{ name: "Trail Tin Mug", quantity: 2, itemCost: 1, description: "tampered price" }],
        shippingAddress: { address_line_1: "1 Main" },
      },
      { toolCallId: "test", messages: [] },
    );
    assert.match(String(result), /ORDER123/);
    assert.ok(received);
    assert.equal("shippingAddress" in received, false);
    assert.deepEqual(received.items, quote.create_order_arguments.items);
    assert.equal(received.currencyCode, "USD");
    assert.equal(received.discount, 0);
    assert.equal(received.shippingCost, 0);
    assert.equal(received.returnUrl, quote.create_order_arguments.returnUrl);
    assert.equal(received.cancelUrl, quote.create_order_arguments.cancelUrl);
    assert.equal((received.items as Array<{ itemCost: number }>)[0]?.itemCost, 24);
  });
});
