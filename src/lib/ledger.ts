import type { CartQuote, Ledger, LedgerOrder, ToolTrace } from "@/lib/types";

export function emptyLedger(): Ledger {
  return { orders: [] };
}

export function parseResult(result: unknown): Record<string, unknown> | null {
  if (result == null) return null;
  if (typeof result === "string") {
    const trimmed = result.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : { raw: parsed };
      } catch {
        return { raw: result };
      }
    }
    return { raw: result };
  }
  if (typeof result === "object" && "content" in result) {
    const record = result as {
      content?: Array<{ text?: string }>;
      isError?: boolean;
    };
    const text = Array.isArray(record.content)
      ? record.content.map((part) => part.text ?? "").join("\n")
      : "";
    const parsed = parseResult(text) ?? { raw: text };
    if (record.isError && !("error" in parsed)) {
      const fallback = parsed.raw ?? text;
      return { ...parsed, error: fallback || "PayPal MCP tool failed" };
    }
    return parsed;
  }
  if (typeof result === "object") return result as Record<string, unknown>;
  return { raw: result };
}

export function safeApprovalUrl(url: unknown): string | undefined {
  if (typeof url !== "string" || !url) return undefined;
  try {
    const parsed = new URL(url);
    const allowed =
      parsed.protocol === "https:" &&
      (parsed.hostname === "www.sandbox.paypal.com" ||
        parsed.hostname === "sandbox.paypal.com" ||
        parsed.hostname === "www.paypal.com");
    return allowed ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function unwrapOrder(data: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!data) return null;
  const nested = asRecord(data.response) ?? asRecord(data.paypal);
  if (nested && typeof nested.id === "string") return nested;
  if (typeof data.id === "string" && (data.status || data.purchase_units || data.links)) {
    return data;
  }
  return null;
}

export function findApprovalUrl(data: Record<string, unknown> | null): string | undefined {
  const order = unwrapOrder(data) ?? data;
  const links = order?.links;
  if (!Array.isArray(links)) return undefined;
  for (const link of links) {
    const record = asRecord(link);
    if (!record) continue;
    if (record.rel === "payer-action" || record.rel === "approve") {
      return safeApprovalUrl(record.href);
    }
  }
  return undefined;
}

export function findCapture(order: Record<string, unknown> | null): { id?: string; amount?: string; currency?: string } {
  const units = order?.purchase_units;
  if (!Array.isArray(units)) return {};
  for (const unit of units) {
    const record = asRecord(unit);
    const payments = asRecord(record?.payments);
    const captures = payments?.captures;
    const amount = asRecord(record?.amount);
    if (Array.isArray(captures)) {
      for (const capture of captures) {
        const cap = asRecord(capture);
        if (typeof cap?.id === "string") {
          const capAmount = asRecord(cap.amount);
          return {
            id: cap.id,
            amount: typeof capAmount?.value === "string" ? capAmount.value : typeof amount?.value === "string" ? amount.value : undefined,
            currency:
              typeof capAmount?.currency_code === "string"
                ? capAmount.currency_code
                : typeof amount?.currency_code === "string"
                  ? amount.currency_code
                  : undefined,
          };
        }
      }
    }
    if (typeof amount?.value === "string") {
      return {
        amount: amount.value,
        currency: typeof amount.currency_code === "string" ? amount.currency_code : undefined,
      };
    }
  }
  return {};
}

function upsertOrder(orders: LedgerOrder[], patch: LedgerOrder): LedgerOrder[] {
  const index = orders.findIndex((order) => order.id === patch.id);
  if (index === -1) return [...orders, patch];
  const current = orders[index];
  const next = [...orders];
  next[index] = {
    ...current,
    ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
  };
  return next;
}

export function applyToolTrace(ledger: Ledger, trace: ToolTrace[]): Ledger {
  let next: Ledger = {
    cart: ledger.cart,
    orders: ledger.orders.map((order) => ({ ...order })),
  };

  for (const call of trace) {
    const data = parseResult(call.result);
    if (!data) continue;

    if (call.name === "prepare_paypal_order" && !data.error && Array.isArray(data.lines)) {
      next = { ...next, cart: data as unknown as CartQuote };
    }

    if (call.name === "create_order" || call.name === "get_order" || call.name === "pay_order") {
      const order = unwrapOrder(data);
      if (!order || typeof order.id !== "string") continue;
      const capture = findCapture(order);
      const amountRecord = asRecord(asRecord(order.purchase_units && Array.isArray(order.purchase_units) ? order.purchase_units[0] : null)?.amount);
      next = {
        ...next,
        orders: upsertOrder(next.orders, {
          id: order.id,
          status: typeof order.status === "string" ? order.status : undefined,
          approvalUrl: findApprovalUrl(order) ?? findApprovalUrl(data),
          captureId: capture.id,
          amount: capture.amount ?? (typeof amountRecord?.value === "string" ? amountRecord.value : undefined),
          currency: capture.currency ?? (typeof amountRecord?.currency_code === "string" ? amountRecord.currency_code : "USD"),
        }),
      };
    }

    if (call.name === "create_refund" || call.name === "get_refund") {
      if (typeof data.id !== "string" || data.error) continue;
      const args = asRecord(call.args);
      const captureId = typeof args?.capture_id === "string" ? args.capture_id : undefined;
      const targetIndex = captureId
        ? next.orders.findIndex((order) => order.captureId === captureId)
        : next.orders.length - 1;
      if (targetIndex < 0) continue;
      const target = next.orders[targetIndex];
      const orders = [...next.orders];
      orders[targetIndex] = {
        ...target,
        refundId: data.id,
        refundStatus: typeof data.status === "string" ? data.status : undefined,
      };
      next = { ...next, orders };
    }
  }

  return next;
}

export function latestOrder(ledger: Ledger): LedgerOrder | undefined {
  return ledger.orders[ledger.orders.length - 1];
}

export function summarizeTool(call: ToolTrace): string {
  const data = parseResult(call.result);
  if (!data) return "No result";
  if (data.error) {
    const error = data.error;
    if (typeof error === "string") return error;
    const record = asRecord(error);
    if (typeof record?.message === "string") return record.message;
    return "PayPal returned an error";
  }
  if (call.name === "list_catalog") return "Read the Northline shelf";
  if (call.name === "prepare_paypal_order" && typeof data.total === "string") {
    return `Quoted $${data.total} USD`;
  }
  const order = unwrapOrder(data);
  if (order && typeof order.id === "string") {
    const capture = findCapture(order);
    return [`Order ${order.id}`, order.status, capture.id ? `capture ${capture.id}` : ""]
      .filter(Boolean)
      .join(" · ");
  }
  if ((call.name === "create_refund" || call.name === "get_refund") && typeof data.id === "string") {
    return `Refund ${data.id}${typeof data.status === "string" ? ` · ${data.status}` : ""}`;
  }
  return call.ok ? "Done" : "Failed";
}

export function toolOk(result: unknown): boolean {
  const data = parseResult(result);
  if (!data) return false;
  if (data.error) return false;
  if (data.status === "error") return false;
  return true;
}
