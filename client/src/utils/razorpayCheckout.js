/**
 * razorpayCheckout.js — Loads the Razorpay Checkout SDK and opens the payment modal
 */
import { apiJSON } from '../api/apiClient';

let scriptLoaded = false;

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (scriptLoaded || window.Razorpay) { scriptLoaded = true; resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => { scriptLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout script'));
    document.body.appendChild(script);
  });
}

/**
 * Initiates the full purchase flow: create order → open checkout → verify.
 * @param {string} plan - 'pro' | 'elite'
 * @param {Object} player - current player object (for prefill)
 * @returns {Promise<{success: boolean, data?: object, error?: string, cancelled?: boolean}>}
 */
export async function purchaseSubscription(plan, player) {
  try {
    await loadRazorpayScript();

    // 1. Create order on our server
    const order = await apiJSON('/payments/orders', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });

    // 2. Open Razorpay checkout modal
    return await new Promise((resolve) => {
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Dead or Alive: Logic Escape',
        description: `${order.planLabel} Subscription`,
        order_id: order.orderId,
        prefill: {
          name: player?.displayName || player?.username || '',
          email: player?.email || '',
          contact: player?.phone || '',
        },
        theme: { color: '#16a34a' },
        handler: async (response) => {
          // 3. Verify payment with our server (signature check happens server-side)
          try {
            const result = await apiJSON('/payments/verify', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            resolve({ success: true, data: result });
          } catch (err) {
            resolve({ success: false, error: err.message });
          }
        },
        modal: {
          ondismiss: () => resolve({ success: false, cancelled: true }),
        },
      });

      rzp.on('payment.failed', (response) => {
        resolve({ success: false, error: response.error?.description || 'Payment failed' });
      });

      rzp.open();
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
}
