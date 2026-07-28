# Razorpay Payments — Complete Integration Guide

Start with `RAZORPAY_SETUP_GUIDE.md` first to get your test API keys.

---

## 1. Install dependencies

```bash
cd server
npm install razorpay pdfkit node-cron
```

## 2. Add environment variables

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

## 3. New files — drop in directly

```
models/Payment.js
routes/payments.js
utils/receiptGenerator.js
utils/subscriptionExpiry.js
```

## 4. Wire into index.js — 3 additions

### a) The webhook route needs RAW body parsing (before your general JSON parser)

This is critical — Razorpay signs the raw request body, so if `express.json()`
has already parsed it, signature verification will fail. Add this **before**
your existing `app.use(express.json())` line:

```js
// Webhook needs raw body for signature verification — must come BEFORE express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Your existing line stays after:
app.use(express.json({ limit: '10mb' }));
```

### b) Register the payments route

```js
app.use('/api/payments', require('./routes/payments'));
```

### c) Start the expiry reminder cron job (after `io` is created)

```js
const { startExpiryCron } = require('./utils/subscriptionExpiry');
startExpiryCron(io);
```

## 5. Complete the webhook setup in Razorpay dashboard

Go back to `RAZORPAY_SETUP_GUIDE.md` step 3 — point the webhook URL at
`https://your-domain.com/api/payments/webhook` and use the same
`RAZORPAY_WEBHOOK_SECRET` value.

## 6. Add the receipt email function to mailer.js

Follow `MAILER_RECEIPT_ADDITION.md`.

---

## Client setup

### New files
```
src/utils/razorpayCheckout.js
src/pages/PricingPage.jsx
src/components/ui/SubscriptionSection.jsx
```

### Add the /pricing route (public — no ProtectedRoute wrapper)

In `App.jsx`:
```jsx
import PricingPage from './pages/PricingPage';
// ...
<Route path="/pricing" element={<PricingPage />} />
```

### Wire SubscriptionSection into ProfilePage.jsx

```jsx
import SubscriptionSection from '../components/ui/SubscriptionSection';

// Inside the Profile tab, add a new "Billing" tab or section:
<SubscriptionSection player={player} onUpdate={fetchProfile} />
```

### AdminPage — already updated

`AdminPage.jsx` in this delivery already includes a full **💳 Payments** tab
(all transactions, filters, cancel, refund) — no extra wiring needed if you
use the `AdminPage.jsx` from this delivery.

---

## Testing the full flow

1. Start your server with the env vars set
2. Go to `/pricing` while logged in
3. Click Subscribe on Pro or Elite
4. Use test card `4111 1111 1111 1111`, any future expiry, any CVV
5. On success: subscription activates immediately, receipt PDF is emailed
   (or logged to console if SMTP isn't configured), and appears in
   Profile → Billing → Payment History
6. Check Admin → Payments tab — the transaction should appear there too
7. Try Admin → Payments → Cancel or Refund on that transaction to test
   the reverse flow

---

## Security notes (already handled in the code, documented for your awareness)

- **Signature verification is server-side only** — the client never decides
  whether a payment succeeded. `POST /verify` recomputes the HMAC signature
  using your secret key and compares it. If a client tried to fake a
  "successful" payment, the signature check would fail.
- **Webhook is a reliability fallback**, not the primary path — if the user
  closes their browser right after paying (before the `/verify` call
  completes), the webhook still activates their subscription within seconds.
  Both paths check `payment.status !== 'paid'` first, so there's no
  double-activation.
- **Refunds go through Razorpay's actual refund API** — this isn't just a
  database flag flip, real money is returned to the customer's payment method.
