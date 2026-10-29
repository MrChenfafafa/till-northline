import type { ChatMessage } from "@/lib/types";

export function lastUserText(messages: ChatMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") return messages[index].content;
  }
  return "";
}

/**
 * True when the latest buyer message is an explicit yes to open a PayPal order.
 * Post-approval messages ("I approved it") are not checkout confirmation.
 */
export function isCheckoutConfirmation(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  if (/\b(don't|do not|dont|not yet|wait|hold on|stop|cancel)\b/.test(normalized)) {
    return false;
  }
  if (/\b(approved|i paid|captured|payer\s?id|already paid)\b/.test(normalized)) {
    return false;
  }
  if (/^(yes|yeah|yep|yup|ok|okay|confirm|confirmed|do it|go ahead|sure|please)[.!\s]*$/.test(normalized)) {
    return true;
  }
  return /\b(check\s?out|place (the |my )?order|pay with paypal|confirm( the)? (cart|order)|yes,?\s+(please\s+)?(pay|buy|check))\b/.test(
    normalized,
  );
}
