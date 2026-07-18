/**
 * BetaRequestsTab.jsx
 * Separate admin tab: review pending beta requests (approve/reject),
 * plus a "grant to any player" search box for direct grants.
 *
 * Usage in AdminPage.jsx: add 'beta' to your tabs array, then render
 * <BetaRequestsTab/> when tab === 'beta'
 */
import React, { useState, useEffect } from 'react';
import { apiJSON } from '../../api/apiClient';

export default function BetaRequestsTab() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter]     = useState('pending');
  const [loading, setLoading]   = useState(true);
  const [msg, setMsg]           = useState('');

  // Direct grant search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => { load(); }, [filter]);

  const load = async () => {
    setLoading(true);
    try {
      const params = filter === 'all' ? '' : `?status=${filter}`;
      const d = await apiJSON(`/settings/beta-requests${params}`);
      setRequests(d.requests || []);
    } catch (_) {}
    finally { setLoading(false); }
  };

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const approve = async (req) => {
    try { await apiJSON(`/settings/beta-requests/${req._id}/approve`, { method: 'POST' }); await load(); showMsg(`✅ Granted beta access to ${req.username}`); }
    catch (err) { showMsg(`❌ ${err.message}`); }
  };

  const reject = async (req) => {
    const note = window.prompt('Reason for rejection (optional):') || '';
    try { await apiJSON(`/settings/beta-requests/${req._id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }); await load(); showMsg(`Request from ${req.username} rejected`); }
    catch (err) { showMsg(`❌ ${err.message}`); }
  };

  const searchPlayers = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const d = await apiJSON(`/admin/players?search=${encodeURIComponent(searchQuery)}&limit=10`);
      setSearchResults(d.players || []);
    } catch (_) {}
    finally { setSearching(false); }
  };

  const grantDirect = async (player) => {
    try {
      await apiJSON(`/settings/beta-access/grant/${player._id}`, { method: 'POST' });
      showMsg(`✅ Beta access granted to ${player.username}`);
      setSearchResults(prev => prev.map(p => p._id === player._id ? { ...p, hasBetaAccess: true } : p));
    } catch (err) { showMsg(`❌ ${err.message}`); }
  };

  const revokeDirect = async (player) => {
    try {
      await apiJSON(`/settings/beta-access/revoke/${player._id}`, { method: 'POST' });
      showMsg(`Beta access revoked from ${player.username}`);
      setSearchResults(prev => prev.map(p => p._id === player._id ? { ...p, hasBetaAccess: false } : p));
    } catch (err) { showMsg(`❌ ${err.message}`); }
  };

  return (
    <div className="space-y-6">
      {msg && <p className="font-mono text-sm text-green-400 bg-green-950/30 border border-green-800 px-4 py-2 rounded">{msg}</p>}

      {/* Direct grant search */}
      <div className="glass-card p-5 space-y-3">
        <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">Grant Beta Access Directly</h2>
        <p className="font-mono text-[10px] text-gray-700">Admin can give beta access to any player, regardless of subscription plan.</p>
        <div className="flex gap-2">
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchPlayers()}
            placeholder="Search username or email…" className="input-field flex-1 text-sm"/>
          <button onClick={searchPlayers} disabled={searching} className="btn-secondary text-sm disabled:opacity-50">
            {searching ? '…' : 'SEARCH'}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="space-y-2 pt-2">
            {searchResults.map(p => (
              <div key={p._id} className="flex items-center justify-between bg-gray-900/50 border border-gray-800 rounded px-3 py-2">
                <div>
                  <span className="font-mono text-sm text-white">{p.username}</span>
                  <span className="font-mono text-xs text-gray-600 ml-2">{p.email}</span>
                  {p.hasBetaAccess && <span className="font-mono text-[10px] text-green-400 border border-green-800 px-1 rounded ml-2">HAS ACCESS</span>}
                </div>
                {p.hasBetaAccess
                  ? <button onClick={() => revokeDirect(p)} className="font-mono text-xs text-red-500 border border-red-900 hover:bg-red-950/30 px-2 py-1 rounded">Revoke</button>
                  : <button onClick={() => grantDirect(p)} className="font-mono text-xs text-green-500 border border-green-800 hover:bg-green-950/30 px-2 py-1 rounded">Grant</button>
                }
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Requests list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">Beta Access Requests</h2>
          <div className="flex gap-2">
            {['pending','approved','rejected','all'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`font-mono text-xs px-3 py-1 rounded border transition-colors ${filter===f?'bg-blue-900/30 border-blue-700 text-blue-400':'border-gray-800 text-gray-600 hover:text-gray-400'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? <p className="font-mono text-xs text-gray-700 text-center py-8">Loading…</p>
        : requests.length === 0 ? <p className="font-mono text-xs text-gray-700 text-center py-8">No {filter !== 'all' ? filter : ''} requests.</p>
        : requests.map(req => (
          <div key={req._id} className="glass-card p-4 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold text-white">{req.username}</span>
                <span className="font-mono text-[10px] text-purple-400 border border-purple-800 px-1 rounded uppercase">{req.plan}</span>
                <span className={`font-mono text-[10px] px-1.5 rounded border ${
                  req.status==='pending'  ? 'text-yellow-400 border-yellow-800' :
                  req.status==='approved' ? 'text-green-400 border-green-800' :
                                             'text-red-400 border-red-800'
                }`}>{req.status.toUpperCase()}</span>
              </div>
              <p className="font-mono text-xs text-gray-600 mt-0.5">{req.email}</p>
              {req.message && <p className="font-mono text-xs text-gray-400 mt-1 italic">"{req.message}"</p>}
              {req.adminNote && <p className="font-mono text-[10px] text-gray-600 mt-1">Admin note: {req.adminNote}</p>}
              <p className="font-mono text-[10px] text-gray-700 mt-1">Requested {new Date(req.createdAt).toLocaleString()}</p>
            </div>
            {req.status === 'pending' && (
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => approve(req)} className="font-mono text-xs text-green-400 border border-green-800 hover:bg-green-950/30 px-3 py-1.5 rounded">Approve</button>
                <button onClick={() => reject(req)}  className="font-mono text-xs text-red-500 border border-red-900 hover:bg-red-950/30 px-3 py-1.5 rounded">Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
