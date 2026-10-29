import { CATALOG } from "@/lib/catalog";
import { assertSandbox, llmConfig, paypalCredentials, paypalToolPath } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = process.env.PAYPAL_ENV?.trim() || "sandbox";
  let sandboxOk = true;
  try {
    assertSandbox(process.env.PAYPAL_ENV);
  } catch {
    sandboxOk = false;
  }
  const llm = llmConfig();
  return Response.json({
    paypal: {
      configured: Boolean(paypalCredentials()) && sandboxOk,
      env,
      toolPath: paypalToolPath(),
    },
    llm: {
      configured: Boolean(llm),
      model: llm?.model ?? (process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini"),
      baseUrlSet: Boolean(process.env.OPENAI_BASE_URL?.trim()),
    },
    catalogCount: CATALOG.length,
  });
}
