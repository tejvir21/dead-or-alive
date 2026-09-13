/**
 * ClansPage.jsx — Async clan battles (replaces the old live-room match flow)
 *
 * Challenge/queue now leads to a BATTLE, not a shared room. Each member
 * plays their own private solo run whenever they're online within the
 * battle window; scores tally up per clan; winner declared when the
 * window closes (or early, if everyone's played).
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore';
import { apiJSON } from '../api/apiClient';
import { connectSocket } from '../socket/socketClient';

const BADGES = ['🛡️','⚔️','🔥','⭐','💀','👑','🐺','🦅','🐉','⚡','🌟','🎯'];
const REQUESTS_POLL_MS = 5000;

function formatTimeLeft(expiresAt) {
  const ms = new Date(expiresAt) - Date.now();
  if (ms <= 0) return 'Closing…';
  const hrs = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hrs >= 24) return `${Math.floor(hrs / 24)}d ${hrs % 24}h left`;
  if (hrs > 0) return `${hrs}h ${mins}m left`;
  return `${mins}m left`;
}

function CreateClanModal({ onClose, onCreated, player, settings }) {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [badge, setBadge] = useState('🛡️');
  const [joinPolicy, setJoinPolicy] = useState('open');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tier = player?.subscription?.plan === 'elite' ? 'elite' : player?.subscription?.plan === 'pro' ? 'pro' : player?.isVerified ? 'verified' : 'free';
  const canCreate = settings?.clanSettings?.creationTiers?.includes(tier);

  const handleCreate = async () => {
    if (!name.trim() || !tag.trim()) { setError('Name and tag are required'); return; }
    setLoading(true); setError('');
    try {
      const d = await apiJSON('/clans', { method: 'POST', body: JSON.stringify({ name: name.trim(), tag: tag.trim(), description, badge, joinPolicy }) });
      onCreated(d.clan);
      onClose();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative z-10 glass-card p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-white">Create a Clan</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-xl">×</button>
        </div>
        {!canCreate ? (
          <div className="bg-yellow-950/30 border border-yellow-800 rounded-lg p-4 space-y-2">
            <p className="font-mono text-xs text-yellow-400">🔒 Only Pro/Elite subscribers can create a clan.</p>
            <button onClick={() => window.location.href = '/pricing'} className="btn-primary w-full text-sm">UPGRADE TO CREATE</button>
          </div>
        ) : (
          <>
            {error && <p className="font-mono text-xs text-red-400 break-words">⚠ {error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Shadow Legion" maxLength={30} className="input-field text-sm w-full"/></div>
              <div><label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">Tag (2-5 chars)</label>
                <input value={tag} onChange={e => setTag(e.target.value.toUpperCase())} placeholder="SHDW" maxLength={5} className="input-field text-sm w-full"/></div>
            </div>
            <div><label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={300} className="input-field w-full text-sm resize-none"/></div>
            <div><label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">Badge</label>
              <div className="flex gap-2 flex-wrap">{BADGES.map(b => (<button key={b} onClick={() => setBadge(b)} className={`w-9 h-9 rounded-lg text-lg border-2 ${badge === b ? 'border-cyan-500 bg-cyan-950/30' : 'border-gray-800'}`}>{b}</button>))}</div></div>
            <div><label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">Join Policy</label>
              <select value={joinPolicy} onChange={e => setJoinPolicy(e.target.value)} className="input-field text-sm w-full">
                <option value="open">Open — anyone can join instantly</option>
                <option value="invite_only">Invite-only — requests need approval</option>
              </select></div>
            <button onClick={handleCreate} disabled={loading} className="btn-primary w-full disabled:opacity-50">{loading ? 'CREATING…' : 'CREATE CLAN'}</button>
          </>
        )}
      </div>
    </div>
  );
}

function ChallengeModal({ myClanId, onClose, showMsg }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const searchClans = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try { const d = await apiJSON(`/clans?search=${encodeURIComponent(search)}`); setResults((d.clans || []).filter(c => c._id !== myClanId)); }
    catch (_) {} finally { setSearching(false); }
  };

  const challenge = async (targetClan) => {
    try {
      await apiJSON(`/clans/${myClanId}/challenge/${targetClan._id}`, { method: 'POST' });
      showMsg(`✅ Challenge sent to ${targetClan.name}! They have up to 7 days to respond.`);
      onClose();
    } catch (err) { showMsg(`❌ ${err.message}`); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative z-10 glass-card p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-white">⚔ Challenge a Clan</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-xl">×</button>
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchClans()}
            placeholder="Search clan by name or tag…" className="input-field flex-1 text-sm"/>
          <button onClick={searchClans} disabled={searching} className="btn-secondary text-sm disabled:opacity-50">{searching ? '…' : 'SEARCH'}</button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {results.map(c => (
            <div key={c._id} className="flex items-center justify-between bg-gray-900/50 border border-gray-800 rounded px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{c.badge}</span>
                <span className="font-mono text-sm text-white">{c.name} <span className="text-cyan-400">[{c.tag}]</span></span>
              </div>
              <button onClick={() => challenge(c)} className="font-mono text-xs text-orange-400 border border-orange-800 hover:bg-orange-950/30 px-2 py-1 rounded">Challenge</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Active/recent battles panel — shown inside a clan's detail modal ────────────
function BattlesPanel({ myClanId, showMsg }) {
  const navigate = useNavigate();
  const [battles, setBattles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clanNames, setClanNames] = useState({}); // clanId -> {name, tag}
  const pollRef = useRef(null);

  useEffect(() => { load(); pollRef.current = setInterval(load, 15000); return () => clearInterval(pollRef.current); }, []);

  const load = async () => {
    try {
      const d = await apiJSON('/clans/battles/mine');
      setBattles(d.battles || []);
      // Resolve opponent names for display (best-effort, cached)
      const idsNeeded = new Set();
      (d.battles || []).forEach(b => { idsNeeded.add(b.clanAId); idsNeeded.add(b.clanBId); });
      const missing = [...idsNeeded].filter(id => !clanNames[id]);
      if (missing.length > 0) {
        const results = await Promise.all(missing.map(id => apiJSON(`/clans/${id}`).catch(() => null)));
        const updates = {};
        results.forEach((r, i) => { if (r?.clan) updates[missing[i]] = { name: r.clan.name, tag: r.clan.tag }; });
        setClanNames(prev => ({ ...prev, ...updates }));
      }
    } catch (_) {} finally { setLoading(false); }
  };

  const playRun = (battleId) => {
    connectSocket()?.emit('clanBattle:startRun', { battleId });
  };

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;
    // The server includes roomCode inside session.toPublicState() — extract
    // it from there rather than assuming a fixed route
    const onGameStarted = (data) => {
      const code = data?.session?.roomCode;
      if (code) navigate(`/game/${code}`);
    };
    socket.on('gameStarted', onGameStarted);
    const onErr = ({ message }) => showMsg(`❌ ${message}`);
    socket.on('error', onErr);
    return () => { socket.off('gameStarted', onGameStarted); socket.off('error', onErr); };
  }, []);

  if (loading) return <p className="font-mono text-xs text-gray-700 py-2">Loading battles…</p>;
  if (battles.length === 0) return <p className="font-mono text-[10px] text-gray-700">No battles yet.</p>;

  return (
    <div className="space-y-2">
      {battles.map(b => {
        const isA = b.clanAId === myClanId;
        const opponentId = isA ? b.clanBId : b.clanAId;
        const opponent = clanNames[opponentId];
        const myScore = isA ? b.clanAScore : b.clanBScore;
        const oppScore = isA ? b.clanBScore : b.clanAScore;
        const won = b.winnerClanId && b.winnerClanId === myClanId;
        const lost = b.winnerClanId && b.winnerClanId === opponentId;

        return (
          <div key={b._id} className={`border rounded-lg p-3 ${b.status === 'active' ? 'border-orange-800 bg-orange-950/10' : 'border-gray-800'}`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-mono text-xs text-white">vs {opponent?.tag || '…'}</span>
              {b.status === 'active' ? (
                <span className="font-mono text-[10px] text-orange-400">{formatTimeLeft(b.expiresAt)}</span>
              ) : (
                <span className={`font-mono text-[10px] px-1.5 rounded border ${won ? 'text-green-400 border-green-800' : lost ? 'text-red-400 border-red-800' : 'text-gray-500 border-gray-700'}`}>
                  {won ? 'WON' : lost ? 'LOST' : 'DRAW'}
                </span>
              )}
            </div>
            <p className="font-mono text-[10px] text-gray-600 mt-1">
              Score: {myScore ?? '—'} — {oppScore ?? '—'} · {b.runs.length} run(s) played
            </p>
            {b.status === 'active' && !b.hasIPlayed && (
              <button onClick={() => playRun(b._id)} className="mt-2 w-full font-mono text-xs text-white bg-orange-700 hover:bg-orange-600 px-3 py-2 rounded">
                ▶ PLAY YOUR RUN
              </button>
            )}
            {b.status === 'active' && b.hasIPlayed && (
              <p className="font-mono text-[10px] text-green-500 mt-2">✓ You've played your run — waiting on other members / window close.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ClanDetailModal({ clan, myRole, onClose, onUpdate, currentPlayerId, onOpenChallenge }) {
  const [detail, setDetail] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [queueStatus, setQueueStatus] = useState(null);
  const isOwnerOrAdmin = ['owner', 'admin'].includes(myRole);
  const pollRef = useRef(null);

  useEffect(() => { load(); }, [clan._id]);
  useEffect(() => {
    if (!isOwnerOrAdmin) return;
    pollRef.current = setInterval(() => { loadRequestsOnly(); }, REQUESTS_POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [isOwnerOrAdmin, clan._id]);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;
    const onQueueJoined = () => setQueueStatus('queued');
    const onQueueLeft = () => setQueueStatus(null);
    const onQueueMatched = ({ opponent }) => { setQueueStatus(null); showMsg(`⚔ Matched vs ${opponent.tag}! Battle started — check the Battles panel below.`); };
    socket.on('clanQueueJoined', onQueueJoined);
    socket.on('clanQueueLeft', onQueueLeft);
    socket.on('clanQueueMatched', onQueueMatched);
    return () => { socket.off('clanQueueJoined', onQueueJoined); socket.off('clanQueueLeft', onQueueLeft); socket.off('clanQueueMatched', onQueueMatched); };
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const d = await apiJSON(`/clans/${clan._id}`);
      setDetail(d.clan);
      if (['owner', 'admin'].includes(d.myRole)) await loadRequestsOnly();
    } catch (_) {} finally { setLoading(false); }
  };
  const loadRequestsOnly = async () => { try { const r = await apiJSON(`/clans/${clan._id}/requests`); setRequests(r.requests || []); } catch (_) {} };
  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const leave = async () => { if (!window.confirm('Leave this clan?')) return; try { await apiJSON(`/clans/${clan._id}/leave`, { method: 'POST' }); onUpdate(); onClose(); } catch (err) { showMsg(`❌ ${err.message}`); } };
  const kick = async (playerId) => { try { await apiJSON(`/clans/${clan._id}/kick/${playerId}`, { method: 'POST' }); load(); showMsg('✅ Removed'); } catch (err) { showMsg(`❌ ${err.message}`); } };
  const promote = async (playerId) => { try { await apiJSON(`/clans/${clan._id}/promote/${playerId}`, { method: 'POST' }); load(); showMsg('✅ Promoted'); } catch (err) { showMsg(`❌ ${err.message}`); } };
  const demote = async (playerId) => { try { await apiJSON(`/clans/${clan._id}/demote/${playerId}`, { method: 'POST' }); load(); showMsg('✅ Demoted'); } catch (err) { showMsg(`❌ ${err.message}`); } };
  const disband = async () => { if (!window.confirm(`Disband ${clan.name}? This cannot be undone.`)) return; try { await apiJSON(`/clans/${clan._id}`, { method: 'DELETE' }); onUpdate(); onClose(); } catch (err) { showMsg(`❌ ${err.message}`); } };
  const approveReq = async (reqId) => { try { await apiJSON(`/clans/${clan._id}/requests/${reqId}/approve`, { method: 'POST' }); load(); showMsg('✅ Approved'); } catch (err) { showMsg(`❌ ${err.message}`); } };
  const rejectReq = async (reqId) => { try { await apiJSON(`/clans/${clan._id}/requests/${reqId}/reject`, { method: 'POST' }); load(); showMsg('Rejected'); } catch (err) { showMsg(`❌ ${err.message}`); } };

  const joinQueue = () => connectSocket()?.emit('clanQueue:join');
  const leaveQueue = () => connectSocket()?.emit('clanQueue:leave');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative z-10 glass-card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{clan.badge}</span>
            <div><h2 className="font-display text-lg font-bold text-white">{clan.name}</h2><span className="font-mono text-xs text-cyan-400">[{clan.tag}]</span></div>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-xl">×</button>
        </div>

        {msg && <p className="font-mono text-xs text-green-400 break-words">{msg}</p>}
        {clan.description && <p className="font-mono text-xs text-gray-500 break-words">{clan.description}</p>}

        <div className="flex gap-4 font-mono text-[10px] text-gray-600">
          <span>Matches: {clan.stats?.totalMatches || 0}</span>
          <span>Wins: {clan.stats?.totalWins || 0}</span>
          <span>Rooms survived: {clan.stats?.totalRoomsSurvived || 0}</span>
        </div>

        {isOwnerOrAdmin && (
          <div className="border border-orange-900/50 rounded-lg p-3 space-y-2">
            <p className="font-mono text-xs text-orange-400 uppercase">⚔ Start a Clan Battle</p>
            <div className="flex gap-2">
              <button onClick={onOpenChallenge} className="flex-1 font-mono text-xs text-orange-400 border border-orange-800 hover:bg-orange-950/30 px-3 py-2 rounded">
                Challenge a Clan
              </button>
              {queueStatus === 'queued' ? (
                <button onClick={leaveQueue} className="flex-1 font-mono text-xs text-red-400 border border-red-800 hover:bg-red-950/30 px-3 py-2 rounded animate-pulse">Leave Queue…</button>
              ) : (
                <button onClick={joinQueue} className="flex-1 font-mono text-xs text-green-400 border border-green-800 hover:bg-green-950/30 px-3 py-2 rounded">🎲 Find Random Match</button>
              )}
            </div>
            <p className="font-mono text-[10px] text-gray-700">Once matched, every member plays their own run whenever they're online — no need to be online together.</p>
          </div>
        )}

        {/* Battles panel — shows all active/completed battles, Play Your Run button */}
        <div className="space-y-2">
          <p className="font-mono text-xs text-gray-500 uppercase">Battles</p>
          <BattlesPanel myClanId={clan._id} showMsg={showMsg} />
        </div>

        {loading ? <p className="font-mono text-xs text-gray-700 py-4">Loading…</p> : (
          <>
            {isOwnerOrAdmin && (
              <div className="border border-yellow-900/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-xs text-yellow-400 uppercase">Pending Requests ({requests.length})</p>
                  <button onClick={loadRequestsOnly} className="font-mono text-[10px] text-gray-600 hover:text-yellow-400">↻ refresh</button>
                </div>
                {requests.length === 0 ? (
                  <p className="font-mono text-[10px] text-gray-700">No pending requests right now.</p>
                ) : requests.map(r => (
                  <div key={r._id} className="flex items-center justify-between">
                    <span className="font-mono text-xs text-white">{r.username}</span>
                    <div className="flex gap-1">
                      <button onClick={() => approveReq(r._id)} className="font-mono text-[10px] text-green-400 border border-green-800 px-2 py-0.5 rounded">✓</button>
                      <button onClick={() => rejectReq(r._id)} className="font-mono text-[10px] text-red-400 border border-red-800 px-2 py-0.5 rounded">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <p className="font-mono text-xs text-gray-500 uppercase">Members ({detail?.memberCount || detail?.members?.length || 0}/{clan.maxMembers})</p>
              {(detail?.members || []).map(m => (
                <div key={m.playerId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${m.isOnline ? 'bg-green-500' : 'bg-gray-700'}`}/>
                    <span className="font-mono text-xs text-white">{m.username}{m.playerId === currentPlayerId && ' (you)'}</span>
                    <span className={`font-mono text-[9px] px-1 rounded border ${m.role === 'owner' ? 'text-yellow-400 border-yellow-800' : m.role === 'admin' ? 'text-blue-400 border-blue-800' : 'text-gray-600 border-gray-700'}`}>{m.role}</span>
                  </div>
                  {myRole === 'owner' && m.playerId !== currentPlayerId && (
                    <div className="flex gap-1">
                      {m.role === 'member' && <button onClick={() => promote(m.playerId)} className="font-mono text-[9px] text-blue-400 border border-blue-800 px-1.5 py-0.5 rounded">↑ admin</button>}
                      {m.role === 'admin' && <button onClick={() => demote(m.playerId)} className="font-mono text-[9px] text-gray-500 border border-gray-700 px-1.5 py-0.5 rounded">↓ member</button>}
                      <button onClick={() => kick(m.playerId)} className="font-mono text-[9px] text-red-500 border border-red-900 px-1.5 py-0.5 rounded">kick</button>
                    </div>
                  )}
                  {myRole === 'admin' && m.role === 'member' && m.playerId !== currentPlayerId && (
                    <button onClick={() => kick(m.playerId)} className="font-mono text-[9px] text-red-500 border border-red-900 px-1.5 py-0.5 rounded">kick</button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-2 pt-2 border-t border-gray-800">
          {myRole === 'owner' ? (
            <button onClick={disband} className="flex-1 font-mono text-xs text-red-500 border border-red-900 hover:bg-red-950/30 py-2 rounded">Disband Clan</button>
          ) : (
            <button onClick={leave} className="flex-1 font-mono text-xs text-gray-400 border border-gray-700 hover:bg-gray-900 py-2 rounded">Leave Clan</button>
          )}
        </div>
      </div>
    </div>
  );
}

function LeaderboardTab() {
  const [metric, setMetric] = useState('wins');
  const [period, setPeriod] = useState('alltime');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [metric, period]);
  const load = async () => {
    setLoading(true);
    try { const d = await apiJSON(`/clans/leaderboard?metric=${metric}&period=${period}`); setData(d); }
    catch (_) {} finally { setLoading(false); }
  };
  const metricLabel = { wins: 'Wins', winRate: 'Win Rate', roomsSurvived: 'Rooms Survived' };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {['wins', 'winRate', 'roomsSurvived'].map(m => (
          <button key={m} onClick={() => setMetric(m)} className={`font-mono text-xs px-3 py-1.5 rounded border transition-colors ${metric===m?'bg-cyan-900/30 border-cyan-700 text-cyan-400':'border-gray-800 text-gray-600 hover:text-gray-400'}`}>{metricLabel[m]}</button>
        ))}
        <span className="flex-1"/>
        {['alltime', 'weekly', 'monthly'].map(p => (
          <button key={p} onClick={() => setPeriod(p)} className={`font-mono text-xs px-3 py-1.5 rounded border transition-colors ${period===p?'bg-purple-900/30 border-purple-700 text-purple-400':'border-gray-800 text-gray-600 hover:text-gray-400'}`}>{p}</button>
        ))}
      </div>
      {loading ? <p className="font-mono text-xs text-gray-700 text-center py-8">Loading…</p> : (
        <>
          {data?.myRank && (
            <div className="glass-card p-3 border border-cyan-800 flex items-center justify-between">
              <span className="font-mono text-xs text-cyan-400">Your clan: #{data.myRank.rank}</span>
              <span className="font-mono text-xs text-white">{metric === 'winRate' ? `${data.myRank.winRate}%` : data.myRank.value}</span>
            </div>
          )}
          <div className="space-y-2">
            {(data?.top10 || []).length === 0 ? (
              <p className="font-mono text-xs text-gray-700 text-center py-8">No clan data yet for this period.</p>
            ) : data.top10.map((c, i) => (
              <div key={c._id} className={`glass-card p-3 flex items-center justify-between ${i === 0 ? 'border border-yellow-700' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className={`font-mono text-sm font-bold w-6 ${i===0?'text-yellow-400':i===1?'text-gray-300':i===2?'text-orange-400':'text-gray-600'}`}>#{i+1}</span>
                  <span className="text-lg">{c.badge}</span>
                  <span className="font-mono text-sm text-white">{c.name} <span className="text-cyan-400">[{c.tag}]</span></span>
                </div>
                <span className="font-mono text-sm text-gray-300">{metric === 'winRate' ? `${c.winRate}%` : c.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ClansPage() {
  const navigate = useNavigate();
  const { player } = useAuthStore();
  const [tab, setTab] = useState('browse');
  const [clans, setClans] = useState([]);
  const [myClans, setMyClans] = useState([]);
  const [settings, setSettings] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [selectedClan, setSelectedClan] = useState(null);
  const [msg, setMsg] = useState('');
  const [incomingChallenges, setIncomingChallenges] = useState([]);

  useEffect(() => { loadAll(); loadChallenges(); }, []);
  useEffect(() => { const t = setTimeout(() => loadClans(), 300); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;
    const onChallengeResolved = ({ accepted }) => { if (accepted) showMsg(`⚔ Challenge accepted! Battle has started — check your clan's Battles panel.`); loadChallenges(); };
    const onBattleStarted = ({ clanA, clanB }) => showMsg(`⚔ Clan battle started: ${clanA.tag} vs ${clanB.tag} — play your run anytime within the window!`);
    socket.on('clanChallengeResolved', onChallengeResolved);
    socket.on('clanBattleStarted', onBattleStarted);
    return () => { socket.off('clanChallengeResolved', onChallengeResolved); socket.off('clanBattleStarted', onBattleStarted); };
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [c, mine, s] = await Promise.all([apiJSON('/clans'), apiJSON('/clans/mine'), apiJSON('/settings')]);
      setClans(c.clans || []); setMyClans(mine.clans || []); setSettings(s.settings);
    } catch (_) {} finally { setLoading(false); }
  };
  const loadClans = async () => { try { const c = await apiJSON(`/clans?search=${encodeURIComponent(search)}`); setClans(c.clans || []); } catch (_) {} };
  const loadChallenges = async () => { try { const d = await apiJSON('/clans/challenges/mine'); setIncomingChallenges(d.incoming || []); } catch (_) {} };
  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 5000); };

  const inAnyClan = myClans.length > 0;
  const myClanId = myClans[0]?._id;

  const joinClan = async (clan) => { try { const d = await apiJSON(`/clans/${clan._id}/join`, { method: 'POST' }); showMsg(d.message || '✅ Joined!'); loadAll(); } catch (err) { showMsg(`❌ ${err.message}`); } };
  const respondChallenge = (challengeId, accept) => { connectSocket()?.emit('clanChallenge:respond', { challengeId, accept }); setIncomingChallenges(prev => prev.filter(c => c._id !== challengeId)); };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <button onClick={() => navigate('/lobby')} className="font-mono text-xs text-gray-700 hover:text-green-400 mb-2 block">← LOBBY</button>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="font-display text-3xl font-bold text-cyan-400 tracking-wider uppercase">Clans</h1>
            <button onClick={() => setShowCreate(true)} className="btn-primary text-sm px-5 py-2">+ CREATE CLAN</button>
          </div>
        </div>

        {msg && <p className="font-mono text-sm text-green-400 bg-green-950/30 border border-green-800 px-4 py-2 rounded break-words">{msg}</p>}

        {incomingChallenges.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-mono text-xs text-orange-400 uppercase tracking-widest">⚔ Incoming Challenges</h2>
            {incomingChallenges.map(ch => (
              <div key={ch._id} className="glass-card p-4 border border-orange-800 flex items-center justify-between flex-wrap gap-2">
                <span className="font-mono text-sm text-white">{ch.challengerClanId?.tag} has challenged your clan!</span>
                <div className="flex gap-2">
                  <button onClick={() => respondChallenge(ch._id, true)} className="font-mono text-xs text-green-400 border border-green-800 hover:bg-green-950/30 px-3 py-1.5 rounded">Accept</button>
                  <button onClick={() => respondChallenge(ch._id, false)} className="font-mono text-xs text-red-500 border border-red-900 hover:bg-red-950/30 px-3 py-1.5 rounded">Decline</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => setTab('browse')} className={`font-mono text-xs px-4 py-2 rounded border ${tab==='browse'?'bg-cyan-900/30 border-cyan-700 text-cyan-400':'border-gray-800 text-gray-600'}`}>Browse</button>
          <button onClick={() => setTab('leaderboard')} className={`font-mono text-xs px-4 py-2 rounded border ${tab==='leaderboard'?'bg-cyan-900/30 border-cyan-700 text-cyan-400':'border-gray-800 text-gray-600'}`}>🏆 Leaderboard</button>
        </div>

        {tab === 'leaderboard' && <LeaderboardTab/>}

        {tab === 'browse' && (
          <>
            {myClans.length > 0 && (
              <div className="space-y-2">
                <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">My Clans</h2>
                {myClans.map(clan => (
                  <button key={clan._id} onClick={() => setSelectedClan(clan)}
                    className="w-full glass-card p-4 flex items-center justify-between hover:border-cyan-700 border border-transparent transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{clan.badge}</span>
                      <div><p className="font-mono text-sm text-white font-bold">{clan.name} <span className="text-cyan-400">[{clan.tag}]</span></p>
                        <p className="font-mono text-[10px] text-gray-600">{clan.memberCount}/{clan.maxMembers} members · {clan.myRole}</p></div>
                    </div>
                    <span className="font-mono text-[10px] text-gray-600">Manage →</span>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">Browse Clans</h2>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or tag…" className="input-field text-sm w-56"/>
              </div>
              {loading ? <p className="font-mono text-xs text-gray-700 text-center py-8">Loading…</p>
              : clans.length === 0 ? <p className="font-mono text-xs text-gray-700 text-center py-8">No clans found.</p>
              : clans.map(clan => (
                <motion.div key={clan._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl flex-shrink-0">{clan.badge}</span>
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-white font-bold truncate">{clan.name} <span className="text-cyan-400">[{clan.tag}]</span></p>
                      <p className="font-mono text-[10px] text-gray-600">{clan.memberCount}/{clan.maxMembers} members · {clan.joinPolicy === 'open' ? 'Open' : 'Invite-only'} · 🏆 {clan.stats?.totalWins || 0} wins</p>
                    </div>
                  </div>
                  {inAnyClan ? (
                    myClans.some(m => m._id === clan._id) ? <span className="font-mono text-[10px] text-green-400 flex-shrink-0">✓ Member</span> : <span className="font-mono text-[10px] text-gray-700 flex-shrink-0">In another clan</span>
                  ) : (
                    <button onClick={() => joinClan(clan)} disabled={clan.memberCount >= clan.maxMembers}
                      className="font-mono text-xs text-cyan-400 border border-cyan-800 hover:bg-cyan-950/30 px-3 py-1.5 rounded flex-shrink-0 disabled:opacity-50">
                      {clan.memberCount >= clan.maxMembers ? 'FULL' : clan.joinPolicy === 'open' ? 'JOIN' : 'REQUEST'}
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>

      {showCreate && <CreateClanModal onClose={() => setShowCreate(false)} onCreated={() => loadAll()} player={player} settings={settings}/>}
      {selectedClan && <ClanDetailModal clan={selectedClan} myRole={myClans.find(c => c._id === selectedClan._id)?.myRole} onClose={() => setSelectedClan(null)} onUpdate={loadAll} currentPlayerId={player?._id || player?.id} onOpenChallenge={() => setShowChallenge(true)}/>}
      {showChallenge && <ChallengeModal myClanId={selectedClan?._id || myClanId} onClose={() => setShowChallenge(false)} showMsg={showMsg}/>}
    </div>
  );
}
