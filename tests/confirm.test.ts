import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCheckoutConfirmation } from "../src/lib/confirm";

describe("checkout confirmation", () => {
  it("accepts an explicit yes and a checkout phrase", () => {
    assert.equal(isCheckoutConfirmation("Yes"), true);
    assert.equal(isCheckoutConfirmation("yes, check out with PayPal"), true);
    assert.equal(isCheckoutConfirmation("Place the order"), true);
  });

  it("does not treat approval or a hedge as checkout", () => {
    assert.equal(isCheckoutConfirmation("I approved it in PayPal. Capture the payment."), false);
    assert.equal(isCheckoutConfirmation("not yet"), false);
    assert.equal(isCheckoutConfirmation("I want a mug"), false);
  });
});
