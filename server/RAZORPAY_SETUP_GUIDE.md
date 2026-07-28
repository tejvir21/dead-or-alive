# Razorpay Setup Guide (Test Mode)

## 1. Create an account
1. Go to https://razorpay.com and click **Sign Up**
2. Enter your email, phone, and set a password
3. Verify your email (link sent to inbox)
4. You'll land on the Razorpay Dashboard — no business documents needed yet for **test mode**

## 2. Get your Test API keys
1. In the dashboard, make sure the toggle top-right says **Test Mode** (not Live Mode)
2. Go to **Settings → API Keys** (left sidebar)
3. Click **Generate Test Key**
4. Copy both:
   - **Key ID** (starts with `rzp_test_...`)
   - **Key Secret** (shown once — copy immediately, or regenerate if lost)

## 3. Set up the webhook (for reliable payment confirmation)
1. Go to **Settings → Webhooks**
2. Click **Add New Webhook**
3. Webhook URL: `https://your-server-domain.com/api/payments/webhook`
   - For local testing, use [ngrok](https://ngrok.com) to expose localhost: `ngrok http 3001`, then use the ngrok URL
4. Select these events:
   - `payment.captured`
   - `payment.failed`
   - `refund.processed`
5. Set a **Webhook Secret** (any random string — you'll need this in `.env`)
6. Save

## 4. Add credentials to your server `.env`

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

## 5. Test payment cards (test mode only — no real money moves)

| Card Number | CVV | Expiry | Result |
|---|---|---|---|
| 4111 1111 1111 1111 | Any 3 digits | Any future date | ✅ Success |
| 5104 0600 0000 0008 | Any 3 digits | Any future date | ✅ Success (Mastercard) |
| 4000 0000 0000 0002 | Any 3 digits | Any future date | ❌ Declined |

Test UPI ID: `success@razorpay` (always succeeds), `failure@razorpay` (always fails)

## 6. Going live later
When ready for real payments:
1. Complete KYC in the dashboard (business details, bank account, PAN)
2. Toggle to **Live Mode**, generate **Live API Keys**
3. Replace the `rzp_test_...` keys in `.env` with `rzp_live_...` keys
4. Update the webhook URL's mode-specific secret
5. No code changes needed — same integration works for both modes
