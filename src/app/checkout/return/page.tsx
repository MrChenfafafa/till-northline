import Link from "next/link";
import { ArrowLeft, CircleCheck } from "lucide-react";

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; PayerID?: string }>;
}) {
  const params = await searchParams;
  const token = params.token?.trim();
  const href = token ? `/?capture=${encodeURIComponent(token)}` : "/";

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-16">
      <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-[0.18em] uppercase">
        <CircleCheck className="size-4" aria-hidden />
        PayPal sandbox
      </p>
      <h1 className="font-heading mt-3 text-4xl tracking-tight">Buyer approved</h1>
      <p className="mt-4 text-base leading-7 text-muted-foreground">
        {token
          ? "PayPal sent the buyer back from sandbox checkout. Till still has to capture the payment. That does not happen on this page."
          : "PayPal did not include an order token on the return URL. Go back to Till and paste the order id."}
      </p>
      {token ? (
        <p className="mt-4 font-mono text-sm">
          Order <span className="text-foreground">{token}</span>
        </p>
      ) : null}
      <Link
        href={href}
        className="bg-primary text-primary-foreground mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {token ? "Back to Till to capture" : "Back to Till"}
      </Link>
    </main>
  );
}
