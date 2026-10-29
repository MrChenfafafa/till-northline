export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ToolTrace = {
  name: string;
  args: unknown;
  result: unknown;
  ok: boolean;
};

export type CartLine = {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  blurb: string;
  image?: string;
};

export type CartQuote = {
  lines: CartLine[];
  currency: "USD";
  total: string;
  pickup: "counter";
  create_order_arguments: {
    currencyCode: "USD";
    items: Array<{
      name: string;
      quantity: number;
      description: string;
      itemCost: number;
      taxPercent: number;
      itemTotal: number;
    }>;
    discount: number;
    shippingCost: number;
    returnUrl?: string;
    cancelUrl?: string;
  };
};

export type LedgerOrder = {
  id: string;
  status?: string;
  approvalUrl?: string;
  captureId?: string;
  refundId?: string;
  refundStatus?: string;
  amount?: string;
  currency?: string;
};

export type Ledger = {
  cart?: CartQuote;
  orders: LedgerOrder[];
};

export type HealthStatus = {
  paypal: {
    configured: boolean;
    env: string;
    toolPath: "toolkit" | "mcp";
  };
  llm: {
    configured: boolean;
    model: string;
    baseUrlSet: boolean;
  };
  catalogCount: number;
};
