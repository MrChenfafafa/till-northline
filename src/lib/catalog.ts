import type { CartQuote } from "@/lib/types";

export type Product = {
  sku: string;
  name: string;
  priceCents: number;
  blurb: string;
  detail: string;
  image: string;
};

export const CATALOG: Product[] = [
  {
    sku: "NL-MUG-01",
    name: "Trail Tin Mug",
    priceCents: 2400,
    blurb: "Speckled enamel, 12 oz",
    detail: "Speckled enamel mug that nests in a day bag. Hand wash.",
    image: "/catalog/trail-tin-mug.jpg",
  },
  {
    sku: "NL-NB-02",
    name: "Field Notebook",
    priceCents: 1200,
    blurb: "48 waterproof pages",
    detail: "Pocket notebook with waterproof pages and a pencil loop.",
    image: "/catalog/field-notebook.jpg",
  },
  {
    sku: "NL-CAP-03",
    name: "Wool Watch Cap",
    priceCents: 2800,
    blurb: "Charcoal merino",
    detail: "Light merino watch cap. Charcoal, one size.",
    image: "/catalog/wool-watch-cap.jpg",
  },
  {
    sku: "NL-LAN-04",
    name: "Compact Lantern",
    priceCents: 3600,
    blurb: "180 lumens, USB-C",
    detail: "Compact lantern, 180 lumens, recharges on USB-C.",
    image: "/catalog/compact-lantern.jpg",
  },
  {
    sku: "NL-KIT-05",
    name: "Tenacious Repair Kit",
    priceCents: 1800,
    blurb: "Thread, patches, tape",
    detail: "Needle, thread, fabric patches, and a short roll of repair tape.",
    image: "/catalog/repair-kit.jpg",
  },
];

export function formatUsd(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function imageForSku(sku: string): string | undefined {
  return CATALOG.find((product) => product.sku === sku)?.image;
}

export function findProduct(query: string | undefined): Product | undefined {
  if (!query) return undefined;
  const needle = query.trim().toLowerCase();
  if (!needle) return undefined;
  return CATALOG.find(
    (product) =>
      product.sku.toLowerCase() === needle ||
      product.name.toLowerCase() === needle,
  );
}

export type QuoteLineInput = {
  sku?: string;
  name?: string;
  quantity: number;
};

export function quoteCart(
  requested: QuoteLineInput[],
  urls?: { returnUrl: string; cancelUrl: string },
): CartQuote | { error: string } {
  if (!requested.length) {
    return { error: "Add at least one shelf item before quoting a cart." };
  }
  if (requested.length > 5) {
    return { error: "Till can check out at most 5 different items at once." };
  }

  const merged = new Map<string, { product: Product; quantity: number }>();
  for (const line of requested) {
    const product = findProduct(line.sku) ?? findProduct(line.name);
    if (!product) {
      const known = CATALOG.map((item) => `${item.sku} (${item.name})`).join(", ");
      return {
        error: `Unknown shelf item "${line.sku || line.name || ""}". Use one of: ${known}.`,
      };
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10) {
      return {
        error: `Quantity for ${product.name} must be a whole number from 1 to 10.`,
      };
    }
    const existing = merged.get(product.sku);
    const quantity = (existing?.quantity ?? 0) + line.quantity;
    if (quantity > 10) {
      return { error: `Quantity for ${product.name} must be 10 or fewer.` };
    }
    merged.set(product.sku, { product, quantity });
  }

  const lines = [...merged.values()].map(({ product, quantity }) => {
    const lineCents = product.priceCents * quantity;
    return {
      sku: product.sku,
      name: product.name,
      quantity,
      unitPrice: formatUsd(product.priceCents),
      lineTotal: formatUsd(lineCents),
      blurb: product.blurb,
      image: product.image,
    };
  });

  const totalCents = [...merged.values()].reduce(
    (sum, line) => sum + line.product.priceCents * line.quantity,
    0,
  );

  return {
    lines,
    currency: "USD",
    total: formatUsd(totalCents),
    pickup: "counter",
    create_order_arguments: {
      currencyCode: "USD",
      discount: 0,
      shippingCost: 0,
      ...(urls ?? {}),
      items: [...merged.values()].map(({ product, quantity }) => ({
        name: product.name,
        quantity,
        description: `${product.sku}. ${product.detail}`.slice(0, 127),
        itemCost: product.priceCents / 100,
        taxPercent: 0,
        itemTotal: (product.priceCents * quantity) / 100,
      })),
    },
  };
}

export function listCatalog(maxPrice?: number) {
  const items = CATALOG.filter((product) =>
    maxPrice == null ? true : product.priceCents <= Math.round(maxPrice * 100),
  ).map((product) => ({
    sku: product.sku,
    name: product.name,
    price: formatUsd(product.priceCents),
    currency: "USD" as const,
    blurb: product.blurb,
    detail: product.detail,
    image: product.image,
  }));
  return {
    shop: "Northline Outfitters",
    pickup: "Counter pickup. No shipping and no tax in this demo.",
    items,
  };
}
