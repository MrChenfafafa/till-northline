/**
 * Creates one PayPal sandbox order through @paypal/agent-toolkit.
 * Reads PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and PAYPAL_ENV from the
 * process environment first. A local .env file is only a fallback and never
 * overrides variables that are already set. Does not call an LLM and does
 * not read OPENAI_API_KEY. Skips with exit 0 when sandbox credentials are
 * missing. Does not capture or refund.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { paypalCredentials } from "../src/lib/env";
import { createSmokeOrder } from "../src/lib/paypal";

function loadEnvFile(filename: string) {
  const full = path.join(process.cwd(), filename);
  if (!existsSync(full)) return;
  const text = readFileSync(full, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

async function main() {
  if (!paypalCredentials()) {
    console.log(
      "SKIP: PayPal sandbox credentials are not set. Export PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and PAYPAL_ENV=sandbox, or put them in .env.local. This script does not need an LLM key.",
    );
    return;
  }

  const order = await createSmokeOrder();
  console.log(`OK: created PayPal sandbox order ${order.orderId}`);
  console.log(`status: ${order.status}`);
  console.log(`host: ${order.host}`);
  console.log(`approve: ${order.approvalUrl ?? "(no approval link in the response)"}`);
  console.log("Capture was not called. Approve the order in the sandbox, then ask Till to capture it.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL: ${message}`);
  process.exit(1);
});
