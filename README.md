# Till — Agentic Commerce Copilot

Till is the counter clerk for **Northline Outfitters**, a five-item demo shop. You describe what you want in plain language. Till prices a cart from the shelf, opens a **real PayPal sandbox order** with the [PayPal Agent Toolkit](https://github.com/paypal/agent-toolkit), and — after you approve it as a sandbox buyer — captures the payment and can refund it.

This is an open-source demo for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/). It is sandbox-only. It will not call live PayPal.

## What you need

- Node.js 20 or newer
- A PayPal **sandbox** REST app (client id and secret)
- An API key for an OpenAI-compatible model that supports tool calling

## Install and run

```bash
npm install
cp .env.example .env.local
# edit .env.local — see below
npm run dev
```

Open [http://127.0.0.1:41731](http://127.0.0.1:41731).

`npm test` runs the local checks (catalog math, confirmation gate, ledger parsing, toolkit tool registration, and a PayPal MCP server tool listing). `npm run smoke` (or `make smoke`) creates one sandbox order when credentials are present.

## PayPal sandbox credentials

1. Create a free account at [developer.paypal.com](https://developer.paypal.com/dashboard/).
2. Open **Apps & Credentials** and stay on the **Sandbox** tab. Do not create a Live app for this demo.
3. Click **Create App**. Name it something like `Northline Till`. PayPal ties it to the default sandbox **business** account. That account is the merchant who receives the payment.
4. Copy the **Client ID** and, after clicking **Show**, the **Secret**.
5. Open **Testing Tools → Sandbox Accounts** (or **Sandbox → Accounts**). You need:
   - the **Business** account linked to the app (merchant)
   - a **Personal** account (buyer)
6. Open the personal account and note the email and the sandbox password (View/Edit account). You will type that password on the PayPal approval page. It is not an app secret and it does not go in `.env.local`.

Sandbox notes for a first run:

- Use only the sandbox client id and secret. A live key with `PAYPAL_ENV=sandbox` will fail, and this app refuses `PAYPAL_ENV=live`.
- The buyer who approves the order must be the **personal** sandbox account. The business account is the merchant.
- Orders created by the smoke script stay in `CREATED` until a buyer approves them. They are not real charges. You can leave them, or approve and refund them from the app.
- Sandbox balances and logins live at [sandbox.paypal.com](https://www.sandbox.paypal.com/), not paypal.com.
- Do not commit `.env.local`. The placeholders in `.env.example` are not credentials.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PAYPAL_CLIENT_ID` | Yes, for payments | Sandbox REST app client id |
| `PAYPAL_CLIENT_SECRET` | Yes, for payments | Sandbox REST app secret |
| `PAYPAL_ENV` | Yes | Must be `sandbox` |
| `OPENAI_API_KEY` | Yes, for the chat | Key for an OpenAI-compatible tool-calling model |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini`. `gpt-4o` is steadier for a recording |
| `OPENAI_BASE_URL` | No | Set this for Groq, OpenRouter, xAI, or another compatible endpoint |
| `PAYPAL_TOOL_PATH` | No | `toolkit` (default) or `mcp` |
| `APP_ORIGIN` | No | Public origin for PayPal return URLs. Defaults to the request host |

Example `.env.local` (fake values):

```bash
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
PAYPAL_ENV=sandbox
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
PAYPAL_TOOL_PATH=toolkit
```

If `OPENAI_BASE_URL` is set, requests go there with `OPENAI_API_KEY`. Example for an OpenAI-compatible host:

```bash
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

## Run the demo

1. Start the app (`npm run dev`) and open [http://127.0.0.1:41731](http://127.0.0.1:41731).
2. Tell Till what you want. Example: “I'm out this weekend and need a mug and something to write in.”
3. Till calls `list_catalog` / `prepare_paypal_order` and reads the total back. Shelf prices are enforced in code. The model cannot charge a different amount for a catalog item.
4. Reply `Yes, check out with PayPal`.
5. Till calls PayPal `create_order` and shows an **Approve in PayPal sandbox** button.
6. Click it. Sign in as the sandbox **personal** buyer and approve the order. PayPal returns to `/checkout/return`, which sends you back to Till.
7. Till calls `pay_order` (capture) only after the order status is `APPROVED`, then `get_order`, and reports the capture id.
8. Say `Refund the payment in full`. Till calls the sandbox Payments v2 refund endpoint with that capture id.

Capture is refused while the order is still `CREATED`. A refund uses the capture id, not the order id.

### Sample prompts

- “What's on the shelf under $30?”
- “Add the compact lantern and the repair kit.”
- “Yes, check out with PayPal.”
- “I approved it in PayPal. Capture the payment.”
- “What's the status of that order?”
- “Refund the payment in full.”
- “Refund $12.00 of that capture.”

### Shelf

| SKU | Item | Price |
| --- | --- | --- |
| NL-MUG-01 | Trail Tin Mug | $24.00 |
| NL-NB-02 | Field Notebook | $12.00 |
| NL-CAP-03 | Wool Watch Cap | $28.00 |
| NL-LAN-04 | Compact Lantern | $36.00 |
| NL-KIT-05 | Tenacious Repair Kit | $18.00 |

Counter pickup. No shipping and no tax.

Shelf cards and the cart show a thumbnail from `image` on each catalog item (`public/catalog/`). Those files are local, so the counter still renders photos when PayPal credentials are absent. Sources and the Unsplash License are listed under [Catalog images](#catalog-images).

## Smoke test

`npm run smoke` creates one sandbox order through the PayPal Agent Toolkit. It does not call a model and does not read `OPENAI_API_KEY`. It uses `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_ENV` from the process environment. Values already exported in the shell win. `.env.local` is only a fallback for variables that are unset.

From a fresh tree, with those three variables already in the environment:

```bash
npm ci
npm run smoke
```

Leave `NODE_ENV` unset, or pass `npm ci --include=dev`, so the `tsx` dev dependency is installed. `make smoke` is the same script.

- If `PAYPAL_CLIENT_ID` or `PAYPAL_CLIENT_SECRET` is missing or still the placeholder, the script prints `SKIP:` and exits 0.
- If they are set and `PAYPAL_ENV=sandbox`, it calls `create_order` against `https://api.sandbox.paypal.com`, then `get_order`, and prints the order id, status, host, and approval URL. It does not print the client id or secret.
- It does not capture or refund. Approving still takes a buyer in the sandbox.
- A PayPal error (wrong secret, live key, and so on) prints `FAIL:` and exits 1.

```bash
npm test
```

## How the agent pays

Default path (`PAYPAL_TOOL_PATH=toolkit`):

1. The Vercel AI SDK runs a tool-calling loop (`generateText`, up to 8 steps).
2. Local tools `list_catalog` and `prepare_paypal_order` price the cart.
3. PayPal tools come from `PayPalAgentToolkit` in `@paypal/agent-toolkit/ai-sdk`, with sandbox context turned on:
   - `create_order` → `POST /v2/checkout/orders`
   - `get_order` → `GET /v2/checkout/orders/{id}`
   - `pay_order` → `POST /v2/checkout/orders/{id}/capture`
   - `get_refund` → `GET /v2/payments/refunds/{id}`
4. `create_refund` uses the same toolkit client (sandbox OAuth and base URL) and `POST /v2/payments/captures/{capture_id}/refund`. The stock toolkit tool puts `capture_id` in the JSON body as well as the URL. PayPal's refund API wants it only in the URL, so Till sends a body of `amount`, `invoice_id`, and `note_to_payer` only.

The buyer still approves in the PayPal sandbox. That is the normal Orders v2 flow. Till does not store a card number.

### MCP path

Set `PAYPAL_TOOL_PATH=mcp` and restart. Till mints a sandbox access token with the client id and secret, then spawns `scripts/paypal-mcp-server.mjs`. That process is the PayPal Agent Toolkit MCP server (`@paypal/agent-toolkit/mcp`), the same payment tools exposed by `@paypal/mcp`, speaking Model Context Protocol over stdio. The agent calls `create_order`, `get_order`, and `pay_order` through that server. Refunds still go through the toolkit client so the capture id stays in the URL.

You do not need to paste `PAYPAL_ACCESS_TOKEN`. Till creates one for the MCP server and does not print it.

## Tools

Built and developed with **Cursor Cloud Agent / Grok Bot**.

Runtime:

- **Vercel AI SDK 4** (`ai`, `@ai-sdk/openai`) for the agent loop and tool calling
- Default model label **`gpt-4o-mini`** via `OPENAI_API_KEY` / optional `OPENAI_MODEL`. Any OpenAI-compatible tool-calling API works through `OPENAI_BASE_URL` (OpenAI, Groq, OpenRouter, xAI, or a **third-party relay**). **If `OPENAI_BASE_URL` points at a relay, disclose that in the demo and submission: requests go through the relay, and the actual model is whatever the relay returns—not necessarily the configured label.**
- **PayPal Agent Toolkit** `@paypal/agent-toolkit` 1.11.0 (`PayPalAgentToolkit` from `@paypal/agent-toolkit/ai-sdk`)
- PayPal **Orders v2** and **Payments v2 refunds**, called by that toolkit against the sandbox
- Optional **PayPal MCP server** from `@paypal/agent-toolkit/mcp` (same tool surface as `@paypal/mcp`) when `PAYPAL_TOOL_PATH=mcp`

No other payment processor is used. There is no mock PayPal mode: without sandbox credentials the payment tools are not registered, and the smoke script skips.

## Project layout

- `src/app/page.tsx` — chat, shelf, and order rail
- `src/app/api/chat/route.ts` — agent loop
- `src/lib/agent.ts` — system prompt and tool wiring
- `src/lib/paypal.ts` — toolkit setup, shelf-price guard, capture guard, refund
- `src/lib/mcp.ts` and `scripts/paypal-mcp-server.mjs` — alternate MCP path
- `scripts/smoke-order.ts` — sandbox order-create smoke test
- `DEMO.md` — two to three minute recording script
- `SUBMISSION_DRAFT.md` — Devpost text, not submitted

## Catalog images

Each shelf item has an `image` path. The files under `public/catalog/` are 900×900 crops downloaded from Unsplash and committed so the storefront does not hotlink `images.unsplash.com`. Use is under the [Unsplash License](https://unsplash.com/license) (free, including commercial use; attribution is not required). Photographers are listed anyway. A mark visible in a stock photo is the photographer’s subject, not a Northline product.

| File | Shelf item | Photographer | Unsplash photo |
| --- | --- | --- | --- |
| `public/catalog/trail-tin-mug.jpg` | Trail Tin Mug | Vanesa Giaconi | [crpDt5YdodU](https://unsplash.com/photos/crpDt5YdodU) |
| `public/catalog/field-notebook.jpg` | Field Notebook | Scott Graham | [EPppwcVTZEo](https://unsplash.com/photos/EPppwcVTZEo) |
| `public/catalog/wool-watch-cap.jpg` | Wool Watch Cap | Nynne Schrøder | [Sied4fp3-Dc](https://unsplash.com/photos/Sied4fp3-Dc) |
| `public/catalog/compact-lantern.jpg` | Compact Lantern | Matthew Brodeur | [slAuv1NzyYM](https://unsplash.com/photos/slAuv1NzyYM) |
| `public/catalog/repair-kit.jpg` | Tenacious Repair Kit | Debby Hudson | [RjtcHgPbYUk](https://unsplash.com/photos/RjtcHgPbYUk) |

Devpost gallery stills (cover and screenshots) live in `docs/devpost/`. See [docs/devpost/ASSETS.md](docs/devpost/ASSETS.md). Uploading them to Devpost is a manual edit. This repo does not submit Devpost.

## License

MIT. See [LICENSE](LICENSE).
