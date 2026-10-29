import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyToolTrace, emptyLedger, findApprovalUrl, safeApprovalUrl, summarizeTool } from "../src/lib/ledger";
import type { ToolTrace } from "../src/lib/types";

const created = {
  id: "5O190127TN364715T",
  status: "CREATED",
  links: [
    {
      href: "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T",
      rel: "payer-action",
      method: "GET",
    },
  ],
};

describe("ledger", () => {
  it("keeps only sandbox PayPal approval links", () => {
    assert.equal(
      safeApprovalUrl("https://www.sandbox.paypal.com/checkoutnow?token=ABC"),
      "https://www.sandbox.paypal.com/checkoutnow?token=ABC",
    );
    assert.equal(
      safeApprovalUrl("https://sandbox.paypal.com/checkoutnow?token=ABC"),
      "https://sandbox.paypal.com/checkoutnow?token=ABC",
    );
    assert.equal(safeApprovalUrl("https://www.paypal.com/checkoutnow?token=ABC"), undefined);
    assert.equal(safeApprovalUrl("https://paypal.com/checkoutnow?token=LIVE"), undefined);
    assert.equal(safeApprovalUrl("https://evil.example/checkoutnow"), undefined);
    assert.equal(safeApprovalUrl("javascript:alert(1)"), undefined);
  });

  it("records an order, capture, and refund from tool results", () => {
    const createCall: ToolTrace = {
      name: "create_order",
      args: {},
      result: JSON.stringify(created),
      ok: true,
    };
    const captureCall: ToolTrace = {
      name: "pay_order",
      args: { id: created.id },
      result: JSON.stringify({
        status: "success",
        response: {
          id: created.id,
          status: "COMPLETED",
          purchase_units: [
            {
              amount: { currency_code: "USD", value: "24.00" },
              payments: {
                captures: [
                  {
                    id: "3C679366HH908993F",
                    status: "COMPLETED",
                    amount: { currency_code: "USD", value: "24.00" },
                  },
                ],
              },
            },
          ],
        },
      }),
      ok: true,
    };
    const refundCall: ToolTrace = {
      name: "create_refund",
      args: { capture_id: "3C679366HH908993F" },
      result: JSON.stringify({ id: "1JU08902781691411", status: "COMPLETED" }),
      ok: true,
    };
    const ledger = applyToolTrace(emptyLedger(), [createCall, captureCall, refundCall]);
    assert.equal(ledger.orders.length, 1);
    assert.equal(ledger.orders[0]?.status, "COMPLETED");
    assert.equal(ledger.orders[0]?.captureId, "3C679366HH908993F");
    assert.equal(ledger.orders[0]?.refundId, "1JU08902781691411");
    assert.match(ledger.orders[0]?.approvalUrl ?? "", /sandbox\.paypal\.com/);
    assert.match(summarizeTool(captureCall), /3C679366HH908993F/);
    assert.equal(findApprovalUrl(created), created.links[0]?.href);
  });
});
