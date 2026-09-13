/**
 * SubscriptionSection.jsx
 * Drop into ProfilePage.jsx — shows current plan, expiry, self-serve
 * cancellation, and payment history with receipt downloads.
 *
 * Usage in ProfilePage.jsx:
 *   import SubscriptionSection from '../components/ui/SubscriptionSection';
 *   ...
 *   <SubscriptionSection player={player} onUpdate={fetchProfile} />
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJSON, apiFetch } from '../../api/apiClient';

export default function SubscriptionSection({ player, onUpdate }) {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [msg, setMsg] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => { loadHistory(); }, []);
  const loadHistory = async () => {
    setLoading(true);
    try { const d = await apiJSON('/payments/history'); setHistory(d.payments || []); }
    catch (_) {} finally { setLoading(false); }
  };

  const plan = player?.subscription?.plan || 'free';
  const expiresAt = player?.subscription?.expiresAt;
  const daysLeft = expiresAt ? Math.ceil((new Date(expiresAt) - Date.now()) / 86400000) : null;

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await apiJSON('/payments/cancel', { method: 'POST', body: JSON.stringify({ reason: 'User requested cancellation' }) });
      setMsg('✅ Subscription cancelled — you are now on the free tier.');
      setShowCancelConfirm(false);
      onUpdate?.();
      loadHistory();
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  const downloadReceipt = async (payment) => {
    setDownloadingId(payment._id);
    try {
      const res = await apiFetch(`/payments/receipt/${payment._id}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `receipt-${payment.receiptNumber}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (_) {
      setMsg('❌ Failed to download receipt');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current plan card */}
      <div className="glass-card p-5 space-y-3">
        <h2 className="font-mono text-xs text-gray-500 uppercase tracking-wider">Subscription</h2>

        {msg && <p className={`font-mono text-xs px-3 py-2 rounded ${msg.startsWith('✅') ? 'text-green-400 bg-green-950/30 border border-green-800' : 'text-red-400 bg-red-950/30 border border-red-800'}`}>{msg}</p>}

        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-2xl font-bold text-white uppercase">
              {plan === 'free' ? 'Free' : plan}
            </p>
            {expiresAt && plan !== 'free' && (
              <p className={`font-mono text-xs mt-1 ${daysLeft <= 3 ? 'text-yellow-500' : 'text-gray-500'}`}>
                {daysLeft > 0 ? `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${new Date(expiresAt).toLocaleDateString('en-IN')})` : 'Expired'}
              </p>
            )}
          </div>
          {plan === 'free' ? (
            <button onClick={() => navigate('/pricing')} className="btn-primary text-sm px-5 py-2">
              UPGRADE
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => navigate('/pricing')} className="btn-secondary text-sm px-4 py-2">
                Change Plan
              </button>
              <button onClick={() => setShowCancelConfirm(true)}
                className="font-mono text-xs text-red-500 border border-red-900 hover:bg-red-950/30 px-3 py-2 rounded">
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Cancel confirmation */}
        {showCancelConfirm && (
          <div className="bg-red-950/30 border border-red-800 rounded-lg p-4 space-y-3">
            <p className="font-mono text-xs text-red-300">
              Cancel your {plan.toUpperCase()} subscription? You'll immediately lose access to plan perks and revert to free tier. This does not issue a refund.
            </p>
            <div className="flex gap-2">
              <button onClick={handleCancel} disabled={cancelling}
                className="flex-1 bg-red-900/50 hover:bg-red-800/50 border border-red-700 text-red-300 font-mono text-xs py-2 rounded disabled:opacity-50">
                {cancelling ? 'CANCELLING…' : 'YES, CANCEL'}
              </button>
              <button onClick={() => setShowCancelConfirm(false)} className="flex-1 font-mono text-xs text-gray-500 border border-gray-700 py-2 rounded">
                KEEP SUBSCRIPTION
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payment history */}
      <div className="glass-card p-5 space-y-3">
        <h2 className="font-mono text-xs text-gray-500 uppercase tracking-wider">Payment History</h2>
        {loading ? (
          <p className="font-mono text-xs text-gray-700">Loading…</p>
        ) : history.length === 0 ? (
          <p className="font-mono text-xs text-gray-700">No payments yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map(p => (
              <div key={p._id} className="flex items-center justify-between border-b border-gray-800 pb-2 last:border-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-white uppercase">{p.plan}</span>
                    <span className={`font-mono text-[10px] px-1.5 rounded border ${
                      p.status === 'paid' ? 'text-green-400 border-green-800' :
                      p.status === 'refunded' ? 'text-red-400 border-red-800' :
                      'text-gray-500 border-gray-700'
                    }`}>{p.status.toUpperCase()}</span>
                  </div>
                  <p className="font-mono text-[10px] text-gray-600 mt-0.5">
                    {p.receiptNumber} · {new Date(p.createdAt).toLocaleDateString('en-IN')} · ₹{(p.amount/100).toFixed(2)}
                  </p>
                </div>
                {p.status === 'paid' && (
                  <button onClick={() => downloadReceipt(p)} disabled={downloadingId === p._id}
                    className="font-mono text-[10px] text-gray-500 hover:text-green-400 border border-gray-700 hover:border-green-800 px-2 py-1 rounded disabled:opacity-50">
                    {downloadingId === p._id ? '…' : '⬇ RECEIPT'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
