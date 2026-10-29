import { chatRequestSchema, resolveOrigin, runAgent } from "@/lib/agent";
import { emptyLedger } from "@/lib/ledger";
import type { Ledger } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a JSON chat message." }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Tell Till what you want in a short message." },
      { status: 400 },
    );
  }

  const ledger: Ledger = {
    orders: parsed.data.ledger?.orders ?? [],
    cart: parsed.data.ledger?.cart as Ledger["cart"],
  };

  try {
    const result = await runAgent({
      messages: parsed.data.messages,
      ledger: ledger.orders.length || ledger.cart ? ledger : emptyLedger(),
      origin: resolveOrigin(request),
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Till could not complete that.";
    const status = /OPENAI_API_KEY|PAYPAL_CLIENT|PAYPAL_ENV|sandbox/i.test(message) ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
