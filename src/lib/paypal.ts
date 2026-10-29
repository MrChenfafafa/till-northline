import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import axios from "axios";
import type { ToolExecutionOptions } from "ai";
import { findProduct } from "@/lib/catalog";
import { isCheckoutConfirmation, lastUserText } from "@/lib/confirm";
import { assertSandbox, checkoutUrls, paypalCredentials } from "@/lib/env";
import { findApprovalUrl, parseResult, safeApprovalUrl } from "@/lib/ledger";
import type { ChatMessage } from "@/lib/types";

export const ORDER_ACTIONS = {
  orders: { create: true, get: true, capture: true },
  payments: { createRefund: true, getRefunds: true },
} as const;

const ORDER_ID = /^[A-Z0-9]{17,32}$/;
const CAPTURE_ID = /^[A-Za-z0-9_-]{15,32}$/;

export function createPaypalToolkit(overrides?: { clientId?: string; clientSecret?: string }) {
  assertSandbox(process.env.PAYPAL_ENV);
  const fromEnv = paypalCredentials();
  const clientId = overrides?.clientId ?? fromEnv?.clientId;
  const clientSecret = overrides?.clientSecret ?? fromEnv?.clientSecret;
  if (!clientId || !clientSecret) {
    throw new Error(
      "PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are missing. Create a sandbox app at https://developer.paypal.com/dashboard/applications/sandbox and put the credentials in .env.local.",
    );
  }
  return new PayPalAgentToolkit({
    clientId,
    clientSecret,
    configuration: {
      actions: ORDER_ACTIONS,
      context: { sandbox: true },
    },
  });
}

type PaypalTools = ReturnType<PayPalAgentToolkit["getTools"]>;

function toolOptions(options: ToolExecutionOptions | undefined): ToolExecutionOptions {
  return options ?? { toolCallId: "till", messages: [] };
}

export function paypalError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return JSON.stringify({
      error: error.response?.data ?? error.message,
      status: error.response?.status,
    });
  }
  if (error instanceof Error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ error: "Unknown PayPal error" });
}

type OrderItem = {
  name?: string;
  quantity?: number;
  description?: string;
  itemCost?: number;
  taxPercent?: number;
  itemTotal?: number;
};

/**
 * Keep PayPal order lines locked to the Northline shelf, and refuse to open
 * an order until the buyer has confirmed the cart in the latest message.
 */
export function guardCreateOrder(
  originalExecute: NonNullable<PaypalTools["create_order"]["execute"]>,
  messages: ChatMessage[],
  origin: string,
) {
  const urls = checkoutUrls(origin);
  return async (args: Record<string, unknown>, options?: ToolExecutionOptions) => {
    if (!isCheckoutConfirmation(lastUserText(messages))) {
      return JSON.stringify({
        error:
          "The buyer has not confirmed this cart. Show the line items and total, then wait for an explicit yes before create_order.",
      });
    }
    const items = Array.isArray(args.items) ? (args.items as OrderItem[]) : [];
    if (!items.length) {
      return JSON.stringify({ error: "create_order needs items from prepare_paypal_order." });
    }
    const fixedItems = [];
    for (const item of items) {
      const product = findProduct(item.name);
      if (!product) {
        return JSON.stringify({
          error: `Refusing create_order for unknown item "${item.name ?? ""}". Call prepare_paypal_order and pass its items through.`,
        });
      }
      const quantity = item.quantity ?? 1;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        return JSON.stringify({ error: `Quantity for ${product.name} must be a whole number from 1 to 10.` });
      }
      fixedItems.push({
        name: product.name,
        quantity,
        description: `${product.sku}. ${product.detail}`.slice(0, 127),
        itemCost: product.priceCents / 100,
        taxPercent: 0,
        itemTotal: (product.priceCents * quantity) / 100,
      });
    }
    const fixed = {
      currencyCode: "USD",
      items: fixedItems,
      discount: 0,
      shippingCost: 0,
      returnUrl: urls.returnUrl,
      cancelUrl: urls.cancelUrl,
      shippingAddress: args.shippingAddress ?? null,
      notes: typeof args.notes === "string" ? args.notes : "Northline Outfitters counter order",
    };
    try {
      const raw = await originalExecute(fixed, toolOptions(options));
      const parsed = parseResult(raw) ?? {};
      const approvalUrl = findApprovalUrl(parsed) ?? safeApprovalUrl(parsed.approvalUrl);
      return JSON.stringify({ ...parsed, approvalUrl });
    } catch (error) {
      return paypalError(error);
    }
  };
}

export function guardPayOrder(
  getOrder: NonNullable<PaypalTools["get_order"]["execute"]>,
  payOrder: NonNullable<PaypalTools["pay_order"]["execute"]>,
) {
  return async (args: { id?: string }, options?: ToolExecutionOptions) => {
    const id = String(args.id ?? "").trim();
    if (!ORDER_ID.test(id)) {
      return JSON.stringify({
        error: "pay_order needs the PayPal order id returned by create_order.",
      });
    }
    try {
      const raw = await getOrder({ id }, toolOptions(options));
      const parsed = parseResult(raw);
      const order = parsed && typeof parsed.response === "object" && parsed.response
        ? (parsed.response as Record<string, unknown>)
        : parsed;
      if (parsed?.error) return typeof raw === "string" ? raw : JSON.stringify(parsed);
      const status = typeof order?.status === "string" ? order.status : undefined;
      if (status === "COMPLETED") {
        return JSON.stringify({ status: "success", alreadyCaptured: true, response: order });
      }
      if (status !== "APPROVED") {
        return JSON.stringify({
          error: `Order ${id} is ${status ?? "not approved"}. The buyer has to approve it in the PayPal sandbox before capture.`,
          status,
          id,
          approvalUrl: findApprovalUrl(order),
        });
      }
      const captured = await payOrder({ id }, toolOptions(options));
      return typeof captured === "string" ? captured : JSON.stringify(captured);
    } catch (error) {
      return paypalError(error);
    }
  };
}

/**
 * The toolkit posts the whole tool argument, including capture_id, as the
 * refund JSON body. PayPal wants capture_id only in the URL, so this uses
 * the toolkit client (sandbox OAuth + base URL) and a spec-shaped body.
 */
export function guardRefund(toolkit: PayPalAgentToolkit) {
  return async (args: {
    capture_id?: string;
    amount?: { currency_code?: string; value?: string };
    invoice_id?: string;
    note_to_payer?: string;
  }) => {
    const captureId = String(args.capture_id ?? "").trim();
    if (!CAPTURE_ID.test(captureId)) {
      return JSON.stringify({
        error: "create_refund needs the capture id from the completed order, not the order id.",
      });
    }
    const body: Record<string, unknown> = {};
    if (args.amount?.value) {
      body.amount = {
        currency_code: args.amount.currency_code || "USD",
        value: args.amount.value,
      };
    }
    if (args.invoice_id) body.invoice_id = args.invoice_id;
    if (args.note_to_payer) body.note_to_payer = args.note_to_payer;
    try {
      const headers = await toolkit.client.getHeaders();
      const url = `${toolkit.client.getBaseUrl()}/v2/payments/captures/${captureId}/refund`;
      const response = await axios.post(url, body, { headers });
      return JSON.stringify(response.data);
    } catch (error) {
      return paypalError(error);
    }
  };
}

export async function createSmokeOrder(returnOrigin = "http://127.0.0.1:41731") {
  const toolkit = createPaypalToolkit();
  const tools = toolkit.getTools();
  const execute = tools.create_order?.execute;
  if (!execute) throw new Error("PayPal Agent Toolkit did not register create_order.");
  const urls = checkoutUrls(returnOrigin);
  const raw = await execute(
    {
      currencyCode: "USD",
      discount: 0,
      shippingCost: 0,
      returnUrl: urls.returnUrl,
      cancelUrl: urls.cancelUrl,
      notes: "Northline smoke test. Safe to leave or refund in sandbox.",
      items: [
        {
          name: "Trail Tin Mug",
          quantity: 1,
          description: "NL-MUG-01. Sandbox smoke test for order create.",
          itemCost: 24,
          taxPercent: 0,
          itemTotal: 24,
        },
      ],
    },
    { toolCallId: "smoke", messages: [] },
  );
  const created = parseResult(raw);
  const orderId = typeof created?.id === "string" ? created.id : undefined;
  if (!orderId) {
    throw new Error(`PayPal did not return an order id. Response: ${typeof raw === "string" ? raw : JSON.stringify(raw)}`);
  }
  const fetched = parseResult(
    await tools.get_order.execute!({ id: orderId }, { toolCallId: "smoke-get", messages: [] }),
  );
  return {
    host: toolkit.client.getBaseUrl(),
    orderId,
    status: typeof fetched?.status === "string" ? fetched.status : typeof created?.status === "string" ? created.status : "unknown",
    approvalUrl: findApprovalUrl(created) ?? findApprovalUrl(fetched),
  };
}
