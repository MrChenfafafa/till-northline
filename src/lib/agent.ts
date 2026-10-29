import { createOpenAI } from "@ai-sdk/openai";
import { generateText, tool, type Tool } from "ai";
import { z } from "zod";
import { listCatalog, quoteCart } from "@/lib/catalog";
import {
  checkoutUrls,
  llmConfig,
  paypalCredentials,
  paypalToolPath,
  resolveOrigin,
} from "@/lib/env";
import { applyToolTrace, emptyLedger, toolOk } from "@/lib/ledger";
import { loadMcpPaypalTools } from "@/lib/mcp";
import {
  createPaypalToolkit,
  guardCreateOrder,
  guardPayOrder,
  guardRefund,
} from "@/lib/paypal";
import type { ChatMessage, Ledger, ToolTrace } from "@/lib/types";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(40),
  ledger: z
    .object({
      cart: z.unknown().optional(),
      orders: z
        .array(
          z.object({
            id: z.string(),
            status: z.string().optional(),
            approvalUrl: z.string().optional(),
            captureId: z.string().optional(),
            refundId: z.string().optional(),
            refundStatus: z.string().optional(),
            amount: z.string().optional(),
            currency: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

function systemPrompt(input: {
  origin: string;
  ledger: Ledger;
  paypalReady: boolean;
  toolPath: "toolkit" | "mcp";
}) {
  const urls = checkoutUrls(input.origin);
  return `You are Till, the counter clerk at Northline Outfitters. Buyers describe what they need. You price a cart from the shelf and, after they confirm, you pay in the PayPal sandbox. You are an agent with tools, not a checkout form.

Rules:
- Call list_catalog to read the shelf and prepare_paypal_order to price a cart. Never invent SKUs or prices.
- Currency is USD. Counter pickup. No shipping and no tax.
- Before create_order, say each item, quantity, unit price, and the total in a sentence, then wait.
- Call create_order only after the buyer explicitly confirms that cart (yes, check out, pay with PayPal, place the order).
- Pass the items from the latest prepare_paypal_order result. The server replaces prices with shelf prices.
- returnUrl is ${urls.returnUrl} and cancelUrl is ${urls.cancelUrl}. The server sets these if you forget.
- After create_order, give the buyer the order id and the approval URL, then stop. Do not capture yet.
- Call pay_order only after the buyer says they approved the order in PayPal. Then call get_order and report the status, amount, and capture id.
- Call create_refund only when the buyer asks for a refund. Use the capture id, not the order id. Omit amount for a full refund. For a partial refund pass amount as {"currency_code":"USD","value":"12.00"} with value as a string of dollars.
- If a tool returns an error, explain it and the next step. Never claim a payment or refund succeeded unless the tool result says so.

PayPal tool path: ${input.toolPath}.
PayPal sandbox credentials configured: ${input.paypalReady ? "yes" : "no"}.
${
  input.paypalReady
    ? "Use the PayPal tools for real sandbox orders."
    : "Payments are unavailable. Help with the shelf, and tell the buyer to set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and PAYPAL_ENV=sandbox."
}

Known ledger (previous carts and PayPal ids):
${JSON.stringify(input.ledger)}`;
}

function catalogTools(origin: string): Record<string, Tool> {
  const urls = checkoutUrls(origin);
  return {
    list_catalog: tool({
      description: "List Northline Outfitters shelf items and prices. Optional maxPrice filters by USD price.",
      parameters: z.object({
        maxPrice: z.number().positive().optional().describe("Only items at or under this USD price."),
      }),
      execute: async ({ maxPrice }) => listCatalog(maxPrice),
    }),
    prepare_paypal_order: tool({
      description:
        "Price a cart from catalog SKUs or exact product names. Returns the total and the create_order arguments to use after the buyer confirms. Does not charge anyone.",
      parameters: z.object({
        lines: z
          .array(
            z.object({
              sku: z.string().optional().describe("Catalog SKU such as NL-MUG-01."),
              name: z.string().optional().describe("Exact product name such as Trail Tin Mug."),
              quantity: z.number().int().min(1).max(10),
            }),
          )
          .min(1)
          .max(5),
      }),
      execute: async ({ lines }) => {
        const quote = quoteCart(lines, urls);
        if ("error" in quote) return quote;
        return quote;
      },
    }),
  };
}

async function paypalTools(messages: ChatMessage[], origin: string): Promise<Record<string, Tool>> {
  const path = paypalToolPath();
  if (path === "mcp") {
    const mcpTools = await loadMcpPaypalTools();
    const toolkit = createPaypalToolkit();
    const createOrder = mcpTools.create_order?.execute;
    const getOrder = mcpTools.get_order?.execute;
    const payOrder = mcpTools.pay_order?.execute;
    if (!createOrder || !getOrder || !payOrder) {
      throw new Error("PayPal MCP tools were incomplete.");
    }
    return {
      ...mcpTools,
      create_order: {
        ...mcpTools.create_order,
        execute: guardCreateOrder(createOrder, messages, origin),
      },
      pay_order: {
        ...mcpTools.pay_order,
        execute: guardPayOrder(getOrder, payOrder),
      },
      create_refund: {
        ...mcpTools.create_refund,
        description:
          "Refund a captured PayPal sandbox payment. Uses the PayPal Agent Toolkit client so the capture id stays in the URL, which is what the Payments v2 refund API expects.",
        execute: guardRefund(toolkit),
      },
    };
  }

  const toolkit = createPaypalToolkit();
  const tools = toolkit.getTools();
  const createOrder = tools.create_order?.execute;
  const getOrder = tools.get_order?.execute;
  const payOrder = tools.pay_order?.execute;
  if (!createOrder || !getOrder || !payOrder || !tools.create_refund || !tools.get_refund) {
    throw new Error("PayPal Agent Toolkit did not register the order and refund tools.");
  }
  return {
    create_order: {
      ...tools.create_order,
      description: `${tools.create_order.description ?? "Create a PayPal order."}\nNorthline shelf prices are enforced. Call this only after the buyer confirms the cart.`,
      execute: guardCreateOrder(createOrder, messages, origin),
    },
    get_order: tools.get_order,
    pay_order: {
      ...tools.pay_order,
      description: `${tools.pay_order.description ?? "Capture a PayPal order."}\nOnly call this after the buyer approves the order. The server checks the order status first.`,
      execute: guardPayOrder(getOrder, payOrder),
    },
    create_refund: {
      ...tools.create_refund,
      description:
        "Refund a captured PayPal sandbox payment by capture id. Omit amount for a full refund. amount.value is a decimal string.",
      execute: guardRefund(toolkit),
    },
    get_refund: tools.get_refund,
  };
}

function previewResult(result: unknown): unknown {
  const text = typeof result === "string" ? result : JSON.stringify(result);
  if (!text || text.length <= 4000) {
    if (typeof result === "string") {
      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    }
    return result;
  }
  return `${text.slice(0, 4000)}…`;
}

export async function runAgent(input: {
  messages: ChatMessage[];
  ledger?: Ledger;
  origin: string;
}) {
  const llm = llmConfig();
  if (!llm) {
    throw new Error(
      "OPENAI_API_KEY is missing. Till needs an OpenAI-compatible model that can call tools. Set OPENAI_API_KEY, and optionally OPENAI_MODEL and OPENAI_BASE_URL.",
    );
  }
  const last = input.messages[input.messages.length - 1];
  if (last?.role !== "user") {
    throw new Error("The latest message has to come from the buyer.");
  }

  const ledger = input.ledger?.orders ? { ...input.ledger, orders: input.ledger.orders } : emptyLedger();
  const paypalReady = Boolean(paypalCredentials());
  const toolPath = paypalToolPath();
  const provider = createOpenAI({
    apiKey: llm.apiKey,
    baseURL: llm.baseURL,
    compatibility: llm.baseURL ? "compatible" : "strict",
  });

  const tools: Record<string, Tool> = {
    ...catalogTools(input.origin),
    ...(paypalReady ? await paypalTools(input.messages, input.origin) : {}),
  };

  const result = await generateText({
    model: provider(llm.model),
    system: systemPrompt({ origin: input.origin, ledger, paypalReady, toolPath }),
    messages: input.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    tools,
    maxSteps: 8,
    temperature: 0.2,
  });

  const toolTrace: ToolTrace[] = [];
  for (const step of result.steps) {
    const calls = step.toolCalls as Array<{ toolCallId: string; toolName: string; args: unknown }>;
    const results = step.toolResults as Array<{ toolCallId: string; result: unknown }>;
    for (const call of calls) {
      const match = results.find((item) => item.toolCallId === call.toolCallId);
      toolTrace.push({
        name: call.toolName,
        args: call.args,
        result: match?.result,
        ok: match ? toolOk(match.result) : false,
      });
    }
  }

  const nextLedger = applyToolTrace(ledger, toolTrace);
  const message =
    result.text.trim() ||
    (toolTrace.length
      ? `I used ${toolTrace.map((call) => call.name).join(", ")}. Ask me to keep going if you want the next step.`
      : "I could not finish that. Ask about the shelf, or confirm a cart.");

  return {
    message,
    toolTrace: toolTrace.map((call) => ({ ...call, result: previewResult(call.result) })),
    ledger: nextLedger,
    toolPath,
    model: llm.model,
  };
}

export { resolveOrigin };
