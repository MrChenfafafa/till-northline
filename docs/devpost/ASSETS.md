# Devpost gallery assets

These files are for a person to upload in the Devpost editor. Nothing here is submitted to Devpost by the app, CI, or an agent. Re-uploading the gallery stays human-gated.

## Before / after

Before this change the shelf and the cart were text only: name, blurb, SKU, and price. Order status was a plain phrase, and the narrow-screen Chat / Shelf / Order controls were unlabeled buttons.

After:

- Each catalog item has an `image` path. The shelf and the cart show that photo.
- Navigation uses Lucide icons (compass mark, Chat, Shelf, Order, sandbox badge).
- Payment status uses Lucide icons: no order, waiting for approval, approved, captured, refund, and the return / cancel screens.

PayPal sandbox create-order, capture, and refund are unchanged. The stills below were taken with no PayPal credentials and no model key. The setup banners on the counter are that state, not a broken checkout.

## Upload these

| Path | Size | What it shows |
| --- | --- | --- |
| `docs/devpost/cover.png` | 1920×1080 | Composed cover from the five local catalog crops. |
| `docs/devpost/gallery-counter.png` | 1440-wide | Live counter. Shelf photos. No cart. Dashed status icon. |
| `docs/devpost/gallery-cart.png` | 1440-wide | Same counter after a **local** cart quote (browser intercepted `/api/chat`). Cart photos for the mug and notebook. Clock icon, “Waiting for buyer approval”. |
| `docs/devpost/gallery-mobile-shelf.png` | 390-wide @2x | Chat, Shelf, and Order icons, then the five photos. |
| `docs/devpost/gallery-return.png` | 1280-wide | `/checkout/return` — check icon, existing copy, back link. |
| `docs/devpost/gallery-cancel.png` | 1280-wide | `/checkout/cancel` — cancel icon, existing copy, back link. |

`gallery-cart.png` and `gallery-return.png` use the placeholder id `VISUAL-ONLY`. That is not a PayPal order. No create, capture, or refund ran for these stills. Replace them with a real sandbox recording before upload if you want a live order id in the gallery.

## Catalog files the storefront serves

| Path | Item |
| --- | --- |
| `public/catalog/trail-tin-mug.jpg` | Trail Tin Mug |
| `public/catalog/field-notebook.jpg` | Field Notebook |
| `public/catalog/wool-watch-cap.jpg` | Wool Watch Cap |
| `public/catalog/compact-lantern.jpg` | Compact Lantern |
| `public/catalog/repair-kit.jpg` | Tenacious Repair Kit |

Photographers and the Unsplash License are in the README section “Catalog images”.
