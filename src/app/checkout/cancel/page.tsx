import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-16">
      <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
        PayPal sandbox
      </p>
      <h1 className="font-heading mt-3 text-4xl tracking-tight">Checkout cancelled</h1>
      <p className="mt-4 text-base leading-7 text-muted-foreground">
        The buyer left PayPal before approving. Nothing was captured. The order may still be
        open in the sandbox until it expires. Tell Till if you want a new cart.
      </p>
      <Link
        href="/"
        className="bg-primary text-primary-foreground mt-8 inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-medium"
      >
        Back to Till
      </Link>
    </main>
  );
}
