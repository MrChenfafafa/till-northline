# Demo recording script (about 2 minutes 30 seconds)

Record the browser and, when you switch to PayPal, the sandbox checkout and the business-account activity page. Speak the lines below, or stay close to them. Use `OPENAI_MODEL=gpt-4o` if you want the replies tighter on camera. Have the sandbox **personal** buyer email and password ready (Developer Dashboard → Sandbox accounts → personal account → View/Edit).

Before you hit record:

1. `.env.local` has sandbox `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=sandbox`, and `OPENAI_API_KEY` (plus `OPENAI_BASE_URL` / `OPENAI_MODEL` if you use a relay).
2. If the chat model is reached through a **relay / OpenAI-compatible proxy** (`OPENAI_BASE_URL` not OpenAI’s official host), say that on camera once: traffic goes through the relay, and the **actual model is whatever the relay returns**—not necessarily the `OPENAI_MODEL` label.
3. `npm run dev` is running at http://127.0.0.1:41731.
4. Log out of any live paypal.com session in that browser, or use a clean profile, so checkout opens the sandbox.

## 0:00 — The counter

Show the Northline page: shelf on the left, chat in the middle, order rail on the right. Say:

> This is Till, a commerce copilot for a five-item shop. It does not stop at a recommendation. It prices a cart and pays in the PayPal sandbox with the PayPal Agent Toolkit.

Click the prompt **“I'm out this weekend and need a mug and something to write in.”**

## 0:25 — Confirm the cart

Wait until Till names the Trail Tin Mug ($24) and the Field Notebook ($12) and asks to check out. The order rail should show **$36.00**. Say:

> Those prices come from the shelf, not from the model. Till will not open PayPal until I confirm.

Click **“Yes, check out with PayPal.”**

## 0:45 — Sandbox order

Till replies with an order id and the rail shows **Waiting for buyer approval**. Open the **Tools Till called** disclosure so `create_order` is visible. Say:

> That was a real Orders v2 create call. Status is CREATED. Capture is blocked until a buyer approves.

Click **Approve in PayPal sandbox**.

## 1:05 — PayPal sandbox UI

On the PayPal page, point at the host (`sandbox.paypal.com`) and the $36.00 total. Log in as the sandbox **personal** buyer. Approve the payment.

Say, while it returns to the app:

> The buyer approved in sandbox checkout. PayPal sent us back with the order token. Till still has to capture.

If the app does not send the capture line on its own, type: **“I approved it in PayPal. Capture the payment.”**

## 1:40 — Capture

When Till answers, show the order rail: status **Captured**, a capture id, amount 36.00 USD. Open the tool list so `pay_order` and `get_order` are on screen. Say:

> Capture id is what a refund needs. The order id is not enough.

## 2:00 — Refund

Click **“Refund the payment in full.”** Wait for the refund id and status COMPLETED. Say:

> Same agent, sandbox Payments refund. The money moves back to the buyer inside the sandbox.

## 2:15 — Show it in PayPal

In a second tab, open https://www.sandbox.paypal.com and sign in as the sandbox **business** account (the merchant on the app). Open **Activity**. Show the payment and the refund for the Trail Tin Mug and Field Notebook. Say:

> The agent’s order id matches the sandbox activity. Nothing here touched a live PayPal account.

Stop around 2:30. If you have ten extra seconds, flash the README env table or run `npm run smoke` and show the `OK:` line with a new order id — do not show `.env.local`.
