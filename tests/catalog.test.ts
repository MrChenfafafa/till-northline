import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findProduct, formatUsd, quoteCart } from "../src/lib/catalog";

describe("catalog", () => {
  it("prices a mixed cart in cents", () => {
    const quote = quoteCart([
      { sku: "NL-MUG-01", quantity: 2 },
      { name: "Field Notebook", quantity: 1 },
    ]);
    assert.ok(!("error" in quote));
    if ("error" in quote) return;
    assert.equal(quote.total, "60.00");
    assert.equal(quote.lines[0]?.lineTotal, "48.00");
    assert.equal(quote.create_order_arguments.items[0]?.itemCost, 24);
    assert.equal(quote.create_order_arguments.items[0]?.itemTotal, 48);
    assert.equal(quote.create_order_arguments.currencyCode, "USD");
  });

  it("rejects unknown items and bad quantities", () => {
    const unknown = quoteCart([{ sku: "NOPE", quantity: 1 }]);
    assert.ok("error" in unknown);
    const fraction = quoteCart([{ sku: "NL-LAN-04", quantity: 1.5 }]);
    assert.ok("error" in fraction);
  });

  it("formats dollars and finds products by name", () => {
    assert.equal(formatUsd(1800), "18.00");
    assert.equal(findProduct("wool watch cap")?.sku, "NL-CAP-03");
  });
});
