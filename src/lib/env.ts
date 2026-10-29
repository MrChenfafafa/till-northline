export class SandboxOnlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxOnlyError";
  }
}

const PLACEHOLDER = /^(your[_-]|changeme|placeholder|xxx+|todo|<.*>|example)/i;

export function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return PLACEHOLDER.test(trimmed);
}

export function assertSandbox(envValue: string | undefined): "sandbox" {
  const normalized = (envValue ?? "sandbox").trim().toLowerCase();
  if (["live", "production", "prod"].includes(normalized)) {
    throw new SandboxOnlyError(
      "This demo refuses live PayPal. Set PAYPAL_ENV=sandbox and use a sandbox app's client id and secret.",
    );
  }
  if (!["sandbox", "sand", "test"].includes(normalized)) {
    throw new SandboxOnlyError(`Unsupported PAYPAL_ENV "${envValue}". Use PAYPAL_ENV=sandbox.`);
  }
  return "sandbox";
}

export function paypalToolPath(): "toolkit" | "mcp" {
  return (process.env.PAYPAL_TOOL_PATH ?? "toolkit").trim().toLowerCase() === "mcp"
    ? "mcp"
    : "toolkit";
}

export function paypalCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (isPlaceholder(clientId) || isPlaceholder(clientSecret)) return null;
  return { clientId: clientId as string, clientSecret: clientSecret as string };
}

export function llmConfig(): { apiKey: string; model: string; baseURL?: string } | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (isPlaceholder(apiKey)) return null;
  const baseURL = process.env.OPENAI_BASE_URL?.trim();
  return {
    apiKey: apiKey as string,
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    baseURL: baseURL || undefined,
  };
}

export function checkoutUrls(origin: string): { returnUrl: string; cancelUrl: string } {
  const base = origin.replace(/\/$/, "");
  return {
    returnUrl: `${base}/checkout/return`,
    cancelUrl: `${base}/checkout/cancel`,
  };
}

export function resolveOrigin(request: Request): string {
  const configured = process.env.APP_ORIGIN?.trim();
  if (configured && !isPlaceholder(configured)) return configured.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  if (!host) return "http://127.0.0.1:41731";
  return `${proto}://${host}`;
}
