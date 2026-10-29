"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Backpack,
  Compass,
  ExternalLink,
  MessageSquare,
  Receipt,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { PaymentStatusIcon, RefundStatusIcon } from "@/components/order-status";
import { ProductThumb } from "@/components/product-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CATALOG, formatUsd, imageForSku } from "@/lib/catalog";
import { summarizeTool } from "@/lib/ledger";
import type { HealthStatus, Ledger, ToolTrace } from "@/lib/types";

type Turn = {
  role: "user" | "assistant";
  content: string;
  tools?: ToolTrace[];
};

const starterLedger: Ledger = { orders: [] };

function suggestions(ledger: Ledger): string[] {
  const order = ledger.orders[ledger.orders.length - 1];
  if (order?.refundId) return ["What's the status of that refund?"];
  if (order?.captureId || order?.status === "COMPLETED") {
    return ["What's the status of that order?", "Refund the payment in full."];
  }
  if (order?.approvalUrl || order?.status === "CREATED" || order?.status === "APPROVED") {
    return ["I approved it in PayPal. Capture the payment."];
  }
  if (ledger.cart) return ["Yes, check out with PayPal."];
  return [
    "I'm out this weekend and need a mug and something to write in.",
    "What's on the shelf under $30?",
    "Add the compact lantern and the repair kit.",
  ];
}

function statusLabel(status?: string) {
  if (!status) return "No order yet";
  if (status === "CREATED" || status === "PAYER_ACTION_REQUIRED") return "Waiting for buyer approval";
  if (status === "APPROVED") return "Approved, ready to capture";
  if (status === "COMPLETED") return "Captured";
  return status;
}

const PANELS: Array<{ id: "chat" | "shelf" | "order"; label: string; icon: LucideIcon }> = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "shelf", label: "Shelf", icon: Backpack },
  { id: "order", label: "Order", icon: Receipt },
];

export function Copilot() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ledger, setLedger] = useState<Ledger>(starterLedger);
  const [panel, setPanel] = useState<"chat" | "shelf" | "order">("chat");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((response) => response.json())
      .then((data: HealthStatus) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not read the local setup check.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  async function send(text?: string) {
    const content = (text ?? draft).trim();
    if (!content || busy) return;
    const history = [...turns, { role: "user" as const, content }];
    setTurns(history);
    setDraft("");
    setBusy(true);
    setError(null);
    setPanel("chat");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content: message }) => ({ role, content: message })),
          ledger,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Till could not answer.");
      setLedger(data.ledger ?? starterLedger);
      setTurns([
        ...history,
        { role: "assistant", content: data.message, tools: data.toolTrace ?? [] },
      ]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("capture");
    if (!token) return;
    const key = `till-capture-${token}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    window.history.replaceState({}, "", "/");
    void send(
      `I approved PayPal order ${token} in the sandbox. Capture the payment, then tell me the status and capture id.`,
    );
    // The return from PayPal should capture once, using the first render's send.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prompts = useMemo(() => suggestions(ledger), [ledger]);
  const order = ledger.orders[ledger.orders.length - 1];
  const cartSkus = new Set(ledger.cart?.lines.map((line) => line.sku) ?? []);

  return (
    <div className="min-h-dvh">
      <div className="h-1 bg-[oklch(0.64_0.13_48)]" />
      <header className="border-b border-border/80 bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-end justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg">
              <Compass className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-heading text-3xl tracking-tight">Northline</p>
              <p className="text-sm text-muted-foreground">Till · agentic commerce copilot</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant="outline">
              <ShieldCheck data-icon="inline-start" aria-hidden />
              PayPal sandbox
            </Badge>
            <Badge variant="secondary">
              {health?.paypal.toolPath === "mcp" ? "MCP tools" : "Agent Toolkit"}
            </Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        {health && !health.paypal.configured ? (
          <p className="mb-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            PayPal sandbox credentials are not set. Add <code>PAYPAL_CLIENT_ID</code>,{" "}
            <code>PAYPAL_CLIENT_SECRET</code>, and <code>PAYPAL_ENV=sandbox</code> to{" "}
            <code>.env.local</code>, then restart. Till can still talk through the shelf.
          </p>
        ) : null}
        {health && !health.llm.configured ? (
          <p className="mb-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            No model key yet. Set <code>OPENAI_API_KEY</code> (and optionally <code>OPENAI_MODEL</code>{" "}
            or <code>OPENAI_BASE_URL</code>) so Till can call tools.
          </p>
        ) : null}
        {error ? (
          <p className="border-destructive/30 bg-destructive/10 text-destructive mb-3 rounded-lg border px-3 py-2 text-sm">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mx-auto flex max-w-7xl gap-2 px-4 pb-3 sm:px-6 lg:hidden">
        {PANELS.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            variant={panel === id ? "default" : "outline"}
            onClick={() => setPanel(id)}
          >
            <Icon aria-hidden data-icon="inline-start" />
            {label}
          </Button>
        ))}
      </div>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 pb-8 sm:px-6 lg:grid-cols-[340px_minmax(0,1fr)_320px] lg:items-start">
        <section className={`${panel === "shelf" ? "block" : "hidden"} lg:block`}>
          <h2 className="font-heading mb-3 flex items-center gap-2 text-xl">
            <Backpack className="size-5" aria-hidden />
            The shelf
          </h2>
          <ul className="space-y-2">
            {CATALOG.map((product) => (
              <li key={product.sku}>
                <Card className={cartSkus.has(product.sku) ? "ring-primary/40" : undefined}>
                  <CardContent className="flex items-center gap-3">
                    <ProductThumb src={product.image} alt="" size="shelf" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-muted-foreground text-xs">{product.blurb}</p>
                      <p className="text-muted-foreground mt-1 font-mono text-[11px]">{product.sku}</p>
                    </div>
                    <p className="font-heading text-lg">${formatUsd(product.priceCents)}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${panel === "chat" ? "flex" : "hidden"} min-h-[70dvh] flex-col lg:flex lg:min-h-[calc(100dvh-9rem)]`}>
          <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto pr-1">
            {turns.length === 0 ? (
              <div className="border-border bg-card/80 rounded-xl border px-5 py-6">
                <h2 className="font-heading text-2xl tracking-tight">What do you need from the counter?</h2>
                <p className="text-muted-foreground mt-2 max-w-prose text-sm leading-6">
                  Till reads the five items on the shelf, confirms a cart in plain language, then opens a
                  real PayPal sandbox order. You approve it as the sandbox buyer. Till captures the
                  payment and can refund it.
                </p>
                <ol className="mt-4 space-y-1 text-sm">
                  <li>1. Describe the trip, or name items.</li>
                  <li>2. Confirm the total.</li>
                  <li>3. Approve the order in PayPal sandbox.</li>
                  <li>4. Ask Till to capture, then refund if you want.</li>
                </ol>
              </div>
            ) : null}
            {turns.map((turn, index) => (
              <article key={`${turn.role}-${index}`} className={turn.role === "user" ? "flex justify-end" : ""}>
                <div
                  className={
                    turn.role === "user"
                      ? "bg-primary text-primary-foreground max-w-[90%] rounded-2xl rounded-br-md px-4 py-3 text-sm leading-6"
                      : "bg-card max-w-[95%] rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-6 ring-1 ring-foreground/10"
                  }
                >
                  <p className="whitespace-pre-wrap">{turn.content}</p>
                  {turn.tools && turn.tools.length > 0 ? (
                    <details className="mt-3 text-xs">
                      <summary className="cursor-pointer text-muted-foreground">
                        Tools Till called ({turn.tools.length})
                      </summary>
                      <ul className="mt-2 space-y-2">
                        {turn.tools.map((call, toolIndex) => (
                          <li key={`${call.name}-${toolIndex}`} className="rounded-md bg-background/70 px-2 py-1.5">
                            <p className="font-mono">
                              {call.name} · {call.ok ? "ok" : "error"}
                            </p>
                            <p>{summarizeTool(call)}</p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              </article>
            ))}
            {busy ? <p className="text-muted-foreground text-sm">Till is working with the shelf and PayPal sandbox…</p> : null}
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {prompts.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="outline"
                  className="h-auto py-1.5 text-left whitespace-normal"
                  disabled={busy}
                  onClick={() => void send(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
            <form
              className="bg-card flex items-end gap-2 rounded-xl p-2 ring-1 ring-foreground/10"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder="Ask Till for something on the shelf"
                aria-label="Message Till"
                rows={2}
                className="min-h-16 border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              <Button type="submit" disabled={busy || !draft.trim()} aria-label="Send message">
                <ArrowUp />
                Send
              </Button>
            </form>
          </div>
        </section>

        <aside className={`${panel === "order" ? "block" : "hidden"} lg:block`}>
          <h2 className="font-heading mb-3 flex items-center gap-2 text-xl">
            <Receipt className="size-5" aria-hidden />
            This order
          </h2>
          <Card>
            <CardContent className="space-y-4">
              {ledger.cart ? (
                <div>
                  <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Cart</p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {ledger.cart.lines.map((line) => {
                      const image = line.image || imageForSku(line.sku);
                      return (
                        <li key={line.sku} className="flex items-center gap-2">
                          {image ? <ProductThumb src={image} alt="" size="cart" /> : null}
                          <span className="min-w-0 flex-1">
                            {line.quantity} × {line.name}
                          </span>
                          <span>${line.lineTotal}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2 flex justify-between font-medium">
                    <span>Total</span>
                    <span>${ledger.cart.total} USD</span>
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No cart yet. Tell Till what you need.</p>
              )}

              <div className="border-t border-border pt-3">
                <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">PayPal</p>
                {order ? (
                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Status</dt>
                      <dd className="flex items-center gap-1.5 text-right">
                        <PaymentStatusIcon status={order.status} />
                        {statusLabel(order.status)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Order</dt>
                      <dd className="font-mono text-xs break-all">{order.id}</dd>
                    </div>
                    {order.captureId ? (
                      <div>
                        <dt className="text-muted-foreground">Capture</dt>
                        <dd className="font-mono text-xs break-all">{order.captureId}</dd>
                      </div>
                    ) : null}
                    {order.refundId ? (
                      <div>
                        <dt className="text-muted-foreground flex items-center gap-1.5">
                          <RefundStatusIcon />
                          Refund
                        </dt>
                        <dd className="font-mono text-xs break-all">
                          {order.refundId}
                          {order.refundStatus ? ` · ${order.refundStatus}` : ""}
                        </dd>
                      </div>
                    ) : null}
                    {order.amount ? (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Amount</dt>
                        <dd>
                          {order.amount} {order.currency ?? "USD"}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                ) : (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <PaymentStatusIcon />
                    No sandbox order yet.
                  </p>
                )}
                {order?.approvalUrl ? (
                  <a
                    href={order.approvalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#003087] px-3 text-sm font-medium text-white"
                  >
                    Approve in PayPal sandbox
                    <ExternalLink className="size-4" />
                  </a>
                ) : null}
              </div>
            </CardContent>
          </Card>
          <p className="text-muted-foreground mt-3 text-xs leading-5">
            Sandbox only. Approving the link signs in as your sandbox personal buyer. Till captures
            only after you say the order is approved.
          </p>
        </aside>
      </main>
    </div>
  );
}
