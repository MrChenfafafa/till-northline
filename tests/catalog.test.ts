import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { CATALOG, findProduct, formatUsd, imageForSku, listCatalog, quoteCart } from "../src/lib/catalog";

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

  it("ships a local thumbnail with each shelf item", () => {
    for (const product of CATALOG) {
      assert.match(product.image, /^\/catalog\/[a-z0-9-]+\.jpg$/);
      assert.equal(imageForSku(product.sku), product.image);
      assert.ok(
        existsSync(path.join(process.cwd(), "public", product.image)),
        `missing ${product.image}`,
      );
    }
    const listed = listCatalog();
    assert.equal(listed.items.length, CATALOG.length);
    assert.equal(listed.items[0]?.image, CATALOG[0]?.image);
    const quote = quoteCart([{ sku: "NL-MUG-01", quantity: 1 }]);
    assert.ok(!("error" in quote));
    if ("error" in quote) return;
    assert.equal(quote.lines[0]?.image, "/catalog/trail-tin-mug.jpg");
    assert.equal("image" in quote.create_order_arguments.items[0], false);
  });
});
