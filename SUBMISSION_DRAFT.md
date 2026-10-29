# Devpost draft — do not submit

Draft only, for a person to edit and approve. Nothing in this file has been sent to Devpost.

Suggested project name: **Till — Agentic Commerce Copilot**

Suggested tagline: **A shop clerk that prices a cart and pays in the PayPal sandbox.**

## Text description

Till is a conversational commerce agent for a tiny outfitter called Northline. You say what you need for a weekend. Till looks at a five-item shelf, quotes a cart in plain language, and waits for a yes. After that yes it creates a PayPal order, hands you the sandbox approval link, captures the payment once you approve, and can refund the capture. The point of the demo is the handoff: the model does not invent a receipt. PayPal sandbox does.

The shop is deliberately small so a judge can finish one payment and one refund in a few minutes. The shelf is Trail Tin Mug ($24), Field Notebook ($12), Wool Watch Cap ($28), Compact Lantern ($36), and Tenacious Repair Kit ($18). Prices are enforced in the server. If the model tries to charge a different amount, or to sell something that is not on the shelf, the order tool refuses. Capture is also refused while the order is still waiting for the buyer. That keeps the agent from “paying” before the sandbox checkout actually happens.

Under the chat, Till runs a tool-calling loop on the Vercel AI SDK. Catalog tools price the cart. PayPal tools come from the official PayPal Agent Toolkit (`@paypal/agent-toolkit`): create order, get order, capture, and refund. Those calls hit the sandbox Orders v2 and Payments v2 APIs. An optional second path (`PAYPAL_TOOL_PATH=mcp`) spawns PayPal’s MCP server from the same toolkit and lets the agent call the payment tools over the Model Context Protocol. Refunds send the capture id in the URL, which is what the refund API expects.

The buyer still approves in PayPal’s sandbox UI, signed in as a sandbox personal account. That is intentional. The interesting part is that an agent prepared the order, blocked capture until approval, then finished the money movement and can undo it, with the order id visible both in the app and in the sandbox business account’s activity.

We built Till for the PayPal AI Hackathon because agentic commerce is easy to fake with a chatbot skin on a form. This one is boring on purpose: a counter, a cart, a sandbox payment, a refund. The README has the env vars, a smoke script that creates a sandbox order or skips when credentials are missing, and sample prompts.

## Inspiration

PayPal’s hackathon brief asks for agents that do not only recommend — they transact. A shopping copilot that stops at “you might like this mug” does not answer that. We wanted the smallest loop that still includes a human approval, a real capture, and a real refund, so a judge can see the sandbox move.

## What it does

- Understands a shopping request against a fixed catalog
- Confirms the cart and the total before any PayPal call
- Creates a sandbox order with the PayPal Agent Toolkit and returns the approval link
- Captures only after the buyer approves
- Reports order status and issues a full or partial sandbox refund
- Optional MCP tool path using the PayPal Agent Toolkit MCP server

## How we built it

Next.js and TypeScript for the counter UI. Vercel AI SDK 4 for the multi-step tool loop. `@paypal/agent-toolkit` for PayPal function calling, pointed at the sandbox. The MCP path is the toolkit’s MCP server over stdio, which is the same payment surface as `@paypal/mcp`. Shelf prices, the confirmation gate, and the “must be APPROVED before capture” check sit in our code so a confused model cannot skip them.

## Challenges

PayPal checkout is a redirect, not a single server call. The agent has to create the order, stop, and capture only after the buyer returns. The toolkit’s refund helper also posts the capture id inside the JSON body; the Payments API wants that id only in the path, so the refund uses the toolkit’s sandbox client with a clean body. Keeping the demo on sandbox, and refusing a live `PAYPAL_ENV`, mattered more than adding more PayPal products.

## Accomplishments

One conversation can quote a cart, open a sandbox order, capture it, and refund it, and the same ids show up in the PayPal sandbox activity page.

## What's next

Richer catalogs, saved sandbox buyers, and shipping labels once the capture and refund loop is the boring part. The MCP path could grow from payments into disputes and tracking without changing the clerk’s conversation.

## Built with

Next.js, TypeScript, Vercel AI SDK, PayPal Agent Toolkit, PayPal Orders v2, PayPal Payments v2, Model Context Protocol, PayPal MCP server.

## Tools field (paste into the Devpost Tools box)

Vercel AI SDK 4 (tool calling / agent loop). Default model label: gpt-4o-mini via OPENAI_API_KEY, configurable with OPENAI_MODEL and OPENAI_BASE_URL for any OpenAI-compatible tool-calling endpoint (including a third-party relay). When OPENAI_BASE_URL is a relay: disclose that chat traffic goes through the relay and the actual model is whatever the relay returns. PayPal Agent Toolkit (@paypal/agent-toolkit) for sandbox create_order, get_order, pay_order, and refunds. Optional PayPal MCP server (@paypal/agent-toolkit/mcp, the same payment tools as @paypal/mcp). Developed with Cursor Cloud Agent / Grok Bot.

## Links to fill in when the human submits

- GitHub repository: (public repo with the MIT license visible in About)
- YouTube demo: (public, under 3 minutes, following DEMO.md)
- Do not attach `.env.local` or live keys
