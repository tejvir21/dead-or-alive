/**
 * BetaAccessSection.jsx
 * Drop this into ProfilePage.jsx (Profile tab) — shows beta URL if the
 * player has access, or a "Request Beta Access" button if they're Pro.
 */
import React, { useState, useEffect } from 'react';
import { apiJSON } from '../../api/apiClient';

export default function BetaAccessSection({ player }) {
  const [settings, setSettings] = useState(null);
  const [myRequests, setMyRequests] = useState([]);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        apiJSON('/settings'),
        apiJSON('/settings/beta-requests/mine'),
      ]);
      setSettings(s.settings);
      setMyRequests(r.requests || []);
    } catch (_) {}
    finally { setLoading(false); }
  };

  const submitRequest = async () => {
    setRequesting(true); setError('');
    try {
      await apiJSON('/settings/beta-requests', { method: 'POST', body: JSON.stringify({ message }) });
      setMessage('');
      await load();
    } catch (err) { setError(err.message); }
    finally { setRequesting(false); }
  };

  if (loading) return null;
  if (!settings?.betaAccess?.enabled) return null;

  const plan = player?.subscription?.plan || 'free';
  const hasBeta = player?.hasBetaAccess === true;
  const pendingRequest = myRequests.find(r => r.status === 'pending');
  const rejectedRequest = myRequests.find(r => r.status === 'rejected');
  const canRequest = plan === 'pro' && !hasBeta && !pendingRequest;

  return (
    <div className="glass-card p-5 space-y-4">
      <h2 className="font-mono text-xs text-gray-500 uppercase tracking-wider flex items-center gap-2">
        🧪 Beta Access
      </h2>

      {hasBeta ? (
        <div className="space-y-3">
          <p className="font-mono text-xs text-green-400">✅ You have beta access!</p>
          <div className="bg-black/30 border border-green-800 rounded-lg p-3 flex items-center justify-between gap-3">
            <code className="font-mono text-sm text-green-300 break-all">{settings.betaAccess.betaUrl}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(settings.betaAccess.betaUrl); }}
              className="font-mono text-[10px] text-gray-500 hover:text-white border border-gray-700 px-2 py-1 rounded flex-shrink-0">
              COPY
            </button>
          </div>
          <a href={settings.betaAccess.betaUrl} target="_blank" rel="noopener noreferrer"
            className="btn-secondary w-full text-center block py-2 text-sm">
            Open Beta Version →
          </a>
        </div>
      ) : plan === 'elite' ? (
        <p className="font-mono text-xs text-gray-500">Elite members get automatic beta access — check back shortly if this hasn't updated yet.</p>
      ) : plan === 'pro' ? (
        pendingRequest ? (
          <div className="bg-yellow-950/30 border border-yellow-800 rounded-lg p-3">
            <p className="font-mono text-xs text-yellow-400">⏳ Your beta access request is pending admin review.</p>
            <p className="font-mono text-[10px] text-gray-600 mt-1">Requested {new Date(pendingRequest.createdAt).toLocaleDateString()}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rejectedRequest && (
              <p className="font-mono text-[10px] text-red-500">
                Previous request was declined{rejectedRequest.adminNote ? `: ${rejectedRequest.adminNote}` : '.'} You can request again below.
              </p>
            )}
            <p className="font-mono text-xs text-gray-500">
              As a Pro subscriber, you can request access to the beta version.
            </p>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Optional message to admin (why you'd like beta access)…"
              rows={2} maxLength={500} className="input-field w-full text-sm resize-none"/>
            {error && <p className="font-mono text-xs text-red-400">⚠ {error}</p>}
            <button onClick={submitRequest} disabled={requesting}
              className="btn-primary w-full disabled:opacity-50">
              {requesting ? 'SUBMITTING…' : 'REQUEST BETA ACCESS'}
            </button>
          </div>
        )
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center space-y-2">
          <p className="font-mono text-xs text-gray-500">{settings.betaAccess.lockedMessage}</p>
          <p className="font-mono text-[10px] text-gray-700">Upgrade to Pro to request beta access, or Elite for automatic access.</p>
        </div>
      )}
    </div>
  );
}
