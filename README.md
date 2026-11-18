# Coco Villa Unawatuna — Invoice & Receipt Generator

A zero-backend static web application designed for GitHub Pages to generate A4 PDFs and WhatsApp guest messages for **Coco Villa Unawatuna**.

## Features
- **4 Document Types:**
  1. **Stay Invoice** (Room / Breakfast bill in LKR cash)
  2. **Payment Receipt** (Full settlement confirmation)
  3. **Advance Payment Request** (Direct reservation quote with automatic 30% deposit breakdown)
  4. **Advance Payment Receipt** (Deposit confirmation with exact remaining balance calculation)
- **3 Flexible Billing Scopes:**
  - **Room Only:** Displays the per-guest breakfast price note (`LKR 1,500` from `config.js`) on the invoice.
  - **Room + Breakfast:** Add one or more breakfast dates with guest counts, automatically summed into the room total.
  - **Breakfast Only:** Generates a dedicated **Breakfast Invoice** or **Breakfast Payment Receipt** with date(s), guest count, and per-guest rate.
- **Configurable Breakfast Rate (`config.js`):** Defaults to `breakfastPriceLkr: 1500` and can be overridden per invoice in the form.
