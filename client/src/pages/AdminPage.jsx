/**
 * AdminPage.jsx — Full admin panel
 * Tabs: Dashboard | Players | Clues | Settings | Audit Log
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/authStore';
import { apiJSON, apiFetch } from '../api/apiClient';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const ALL_CATEGORIES = [
  'number','word','symbol','environment','logic','pattern','sound',
  'math','binary','cipher','spatial','time','color','riddle',
];
const EMPTY_CLUE = { category:'number', template:'', answerRule:'', flavorText:'', difficulty:1, hints:[], variables:[] };

function StatCard({ label, value, color = 'text-green-400', loading }) {
  return (
    <div className="glass-card p-4 text-center">
      <p className={`font-display text-2xl font-bold ${color}`}>{loading ? '—' : (value ?? 0)}</p>
      <p className="font-mono text-[10px] text-gray-600 uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIABLE EDITOR
// ─────────────────────────────────────────────────────────────────────────────
function VariableEditor({ variables, onChange }) {
  const add    = () => onChange([...variables, { name:'X', type:'number', min:1, max:10, options:[] }]);
  const remove = i => onChange(variables.filter((_,j) => j !== i));
  const update = (i, field, val) => { const n=[...variables]; n[i]={...n[i],[field]:val}; onChange(n); };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="font-mono text-xs text-gray-500 uppercase tracking-wider">Variables ({variables.length})</label>
        {variables.length < 6 && (
          <button type="button" onClick={add}
            className="text-xs font-mono text-green-500 border border-green-800/50 px-2 py-0.5 rounded hover:bg-green-950/30">+ ADD</button>
        )}
      </div>
      {variables.map((v,i) => (
        <div key={i} className="grid grid-cols-5 gap-2 items-end">
          <div><span className="font-mono text-[10px] text-gray-600 block mb-1">NAME</span>
            <input value={v.name} onChange={e=>update(i,'name',e.target.value.toUpperCase())} maxLength={4} className="input-field text-sm uppercase w-full"/></div>
          <div><span className="font-mono text-[10px] text-gray-600 block mb-1">TYPE</span>
            <select value={v.type} onChange={e=>update(i,'type',e.target.value)} className="input-field text-sm w-full">
              <option value="number">number</option><option value="letter">letter</option>
              <option value="choice">choice</option><option value="symbol">symbol</option>
            </select></div>
          {v.type==='number'&&<><div><span className="font-mono text-[10px] text-gray-600 block mb-1">MIN</span>
            <input type="number" value={v.min} onChange={e=>update(i,'min',parseInt(e.target.value)||0)} className="input-field text-sm w-full"/></div>
            <div><span className="font-mono text-[10px] text-gray-600 block mb-1">MAX</span>
            <input type="number" value={v.max} onChange={e=>update(i,'max',parseInt(e.target.value)||10)} className="input-field text-sm w-full"/></div></>}
          {v.type==='choice'&&<div className="col-span-2"><span className="font-mono text-[10px] text-gray-600 block mb-1">OPTIONS</span>
            <input value={(v.options||[]).join(',')} onChange={e=>update(i,'options',e.target.value.split(',').map(s=>s.trim()).filter(Boolean))}
              className="input-field text-sm w-full" placeholder="A,B,C"/></div>}
          <button type="button" onClick={()=>remove(i)} className="font-mono text-xs text-red-500/60 hover:text-red-400 px-2 py-1.5">✕</button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLUE FORM
// ─────────────────────────────────────────────────────────────────────────────
function ClueForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || EMPTY_CLUE);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">Category</label>
          <select value={form.category} onChange={e=>set('category',e.target.value)} className="input-field w-full">
            {ALL_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
        <div><label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">Difficulty (1-10)</label>
          <input type="range" min={1} max={10} value={form.difficulty} onChange={e=>set('difficulty',parseInt(e.target.value))} className="w-full accent-green-500 mt-2"/>
          <span className="font-mono text-xs text-gray-500">{form.difficulty}/10</span></div>
      </div>
      <div><label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">Template</label>
        <textarea value={form.template} onChange={e=>set('template',e.target.value)} rows={3} placeholder="Only even numbers survive. The code is {X}." className="input-field w-full font-mono text-sm"/></div>
      <div><label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">Answer Rule</label>
        <input value={form.answerRule} onChange={e=>set('answerRule',e.target.value)} placeholder="even:{X}" className="input-field w-full font-mono"/></div>
      <div><label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">Flavor Text</label>
        <input value={form.flavorText} onChange={e=>set('flavorText',e.target.value)} className="input-field w-full"/></div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-mono text-xs text-gray-500 uppercase tracking-wider">Hints</label>
          {(form.hints||[]).length<2&&form.difficulty<=6&&(
            <button type="button" onClick={()=>set('hints',[...(form.hints||[]),''])}
              className="text-xs font-mono text-green-500 border border-green-800/50 px-2 py-0.5 rounded">+ ADD HINT</button>)}
        </div>
        {(form.hints||[]).map((h,i)=>(
          <div key={i} className="flex gap-2">
            <input value={h} onChange={e=>{const n=[...(form.hints||[])];n[i]=e.target.value;set('hints',n);}}
              placeholder={i===0?'Hint 1 (vague)':'Hint 2 (stronger)'} className="input-field flex-1 text-sm"/>
            <button type="button" onClick={()=>set('hints',(form.hints||[]).filter((_,j)=>j!==i))}
              className="text-xs text-red-500/60 hover:text-red-400 px-2">✕</button>
          </div>
        ))}
      </div>
      <VariableEditor variables={form.variables||[]} onChange={v=>set('variables',v)}/>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={()=>onSave(form)} disabled={saving||!form.template||!form.answerRule} className="btn-primary flex-1 disabled:opacity-50">
          {saving?'SAVING…':initial?._id?'SAVE CHANGES':'CREATE CLUE'}</button>
        <button type="button" onClick={onCancel} className="btn-secondary px-6">CANCEL</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK IMPORT
// ─────────────────────────────────────────────────────────────────────────────
function BulkImport({ onDone }) {
  const [json, setJson]     = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const handle = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await apiJSON('/clues/bulk', { method:'POST', body: JSON.stringify(JSON.parse(json)) });
      setResult(data); onDone?.();
    } catch(err) { setError(err.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="space-y-4">
      <p className="font-mono text-xs text-gray-500">Paste JSON with a <code className="text-green-400">clues</code> array. Duplicates are skipped automatically.</p>
      <textarea value={json} onChange={e=>setJson(e.target.value)} rows={12} placeholder='{"clues":[...]}' className="input-field w-full font-mono text-xs"/>
      {error&&<p className="font-mono text-xs text-red-400">⚠ {error}</p>}
      {result&&<div className="font-mono text-xs space-y-1">
        <p className="text-green-400">✅ {result.inserted} clues added</p>
        {result.skipped>0&&<p className="text-yellow-500">⏭ {result.skipped} duplicates skipped</p>}</div>}
      <button onClick={handle} disabled={!json.trim()||loading} className="btn-primary w-full disabled:opacity-50">
        {loading?'IMPORTING…':'⬆ IMPORT CLUES'}</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GIFT SUBSCRIPTION MODAL
// ─────────────────────────────────────────────────────────────────────────────
function GiftModal({ player, onClose, onDone }) {
  const [plan, setPlan]         = useState('pro');
  const [days, setDays]         = useState(30);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const handle = async () => {
    setLoading(true); setError('');
    try {
      await apiJSON(`/admin/players/${player._id}/subscription`, {
        method:'POST', body: JSON.stringify({ plan, durationDays: parseInt(days) }),
      });
      onDone?.();
      onClose();
    } catch(err) { setError(err.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative z-10 glass-card p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-white">Gift Subscription</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400">×</button>
        </div>
        <p className="font-mono text-xs text-gray-500">To: <span className="text-green-400">{player.username}</span></p>
        {error&&<p className="font-mono text-xs text-red-400">⚠ {error}</p>}
        <div><label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">Plan</label>
          <select value={plan} onChange={e=>setPlan(e.target.value)} className="input-field w-full">
            <option value="pro">Pro</option><option value="elite">Elite</option></select></div>
        <div><label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">Duration (days)</label>
          <select value={days} onChange={e=>setDays(e.target.value)} className="input-field w-full">
            {[7,14,30,60,90,180,365].map(d=><option key={d} value={d}>{d} days</option>)}</select></div>
        <button onClick={handle} disabled={loading} className="btn-primary w-full disabled:opacity-50">
          {loading?'GIFTING…':'🎁 GIFT SUBSCRIPTION'}</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BAN MODAL
// ─────────────────────────────────────────────────────────────────────────────
function BanModal({ player, onClose, onDone }) {
  const [reason, setReason]   = useState('');
  const [days, setDays]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const handle = async () => {
    if (!reason.trim()) { setError('Ban reason is required'); return; }
    setLoading(true); setError('');
    try {
      await apiJSON(`/admin/players/${player._id}/ban`, {
        method:'POST', body: JSON.stringify({ reason, durationDays: days ? parseInt(days) : undefined }),
      });
      onDone?.(); onClose();
    } catch(err) { setError(err.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative z-10 glass-card p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-red-400">Ban Player</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400">×</button>
        </div>
        <p className="font-mono text-xs text-gray-500">Banning: <span className="text-red-400">{player.username}</span></p>
        {error&&<p className="font-mono text-xs text-red-400">⚠ {error}</p>}
        <div><label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">Reason *</label>
          <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason for ban" className="input-field w-full"/></div>
        <div><label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">Duration (days, empty = permanent)</label>
          <input type="number" value={days} onChange={e=>setDays(e.target.value)} placeholder="Leave empty for permanent" min={1} className="input-field w-full"/></div>
        <button onClick={handle} disabled={loading} className="bg-red-900/50 hover:bg-red-800/50 border border-red-700 text-red-300 font-mono text-sm px-4 py-2 rounded w-full disabled:opacity-50">
          {loading?'BANNING…':'🚫 BAN PLAYER'}</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ADMIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const navigate = useNavigate();
  const { player } = useAuthStore();

  const [tab, setTab]           = useState('dashboard');
  const [actionMsg, setActionMsg] = useState('');

  // Dashboard
  const [dash, setDash]         = useState(null);
  const [dashLoading, setDashLoading] = useState(true);

  // Clue stats
  const [clueStats, setClueStats] = useState(null);
  const [clueStatsLoading, setClueStatsLoading] = useState(true);

  // Clues list
  const [clues, setClues]       = useState([]);
  const [clueTotal, setClueTotal] = useState(0);
  const [cluePage, setCluePage] = useState(1);
  const [hasMore, setHasMore]   = useState(false);
  const [clueLoading, setClueLoading] = useState(false);
  const [clueTab, setClueTab]   = useState('list');
  const [editTarget, setEditTarget] = useState(null);
  const [filterCat, setFilterCat]   = useState('');
  const [filterDiff, setFilterDiff] = useState('');
  const [search, setSearch]     = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [savingClue, setSavingClue] = useState(false);

  // Players list
  const [players, setPlayers]   = useState([]);
  const [playerTotal, setPlayerTotal] = useState(0);
  const [playerPage, setPlayerPage]   = useState(1);
  const [playerSearch, setPlayerSearch] = useState('');
  const [playerFilter, setPlayerFilter] = useState('');
  const [playerLoading, setPlayerLoading] = useState(false);
  const [banTarget, setBanTarget]   = useState(null);
  const [giftTarget, setGiftTarget] = useState(null);

  // Audit log
  const [logs, setLogs]         = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logPage, setLogPage]   = useState(1);
  const [logTotal, setLogTotal] = useState(0);

  const PAGE = 50;

  useEffect(() => { if (player && !player.isAdmin) navigate('/lobby'); }, [player]);

  // ── Dashboard ──────────────────────────────────────────────────────────────
  const fetchDash = async () => {
    setDashLoading(true);
    try { const d = await apiJSON('/admin/dashboard'); setDash(d); }
    catch (_) {}
    finally { setDashLoading(false); }
  };

  // ── Clue stats ─────────────────────────────────────────────────────────────
  const fetchClueStats = async () => {
    setClueStatsLoading(true);
    try {
      const data = await apiJSON('/clues/stats');
      const s = { total:0, active:0, inactive:0, byCategory:{} };
      (data.stats||[]).forEach(x => {
        s.total += x.count;
        if (x._id.isActive) s.active += x.count; else s.inactive += x.count;
        s.byCategory[x._id.category] = (s.byCategory[x._id.category]||0)+x.count;
      });
      setClueStats(s);
    } catch (_) {}
    finally { setClueStatsLoading(false); }
  };

  // ── Clue list ──────────────────────────────────────────────────────────────
  const fetchClues = useCallback(async (reset=false) => {
    const p = reset ? 1 : cluePage;
    if (reset) setCluePage(1);
    setClueLoading(true);
    try {
      const params = new URLSearchParams({ page:p, limit:PAGE,
        ...(filterCat&&{category:filterCat}), ...(filterDiff&&{difficulty:filterDiff}),
        ...(search&&{search}), ...(showInactive&&{includeInactive:'1'}) });
      const data = await apiJSON(`/clues?${params}`);
      if (reset) setClues(data.clues||[]);
      else setClues(prev => p===1?(data.clues||[]):[...prev,...(data.clues||[])]);
      setClueTotal(data.total||0);
      setHasMore((data.page||1)<(data.pages||1));
    } catch(_) {}
    finally { setClueLoading(false); }
  }, [filterCat,filterDiff,search,showInactive,cluePage]);

  // ── Players list ───────────────────────────────────────────────────────────
  const fetchPlayers = useCallback(async (reset=false) => {
    const p = reset ? 1 : playerPage;
    if (reset) setPlayerPage(1);
    setPlayerLoading(true);
    try {
      const params = new URLSearchParams({ page:p, limit:PAGE,
        ...(playerSearch&&{search:playerSearch}), ...(playerFilter&&{filter:playerFilter}) });
      const data = await apiJSON(`/admin/players?${params}`);
      if (reset) setPlayers(data.players||[]);
      else setPlayers(prev => p===1?(data.players||[]):[...prev,...(data.players||[])]);
      setPlayerTotal(data.total||0);
    } catch(_) {}
    finally { setPlayerLoading(false); }
  }, [playerSearch,playerFilter,playerPage]);

  // ── Audit logs ─────────────────────────────────────────────────────────────
  const fetchLogs = async (reset=false) => {
    const p = reset ? 1 : logPage;
    if (reset) setLogPage(1);
    setLogLoading(true);
    try {
      const data = await apiJSON(`/admin/audit-logs?page=${p}&limit=50`);
      if (reset) setLogs(data.logs||[]);
      else setLogs(prev=>[...prev,...(data.logs||[])]);
      setLogTotal(data.total||0);
    } catch(_) {}
    finally { setLogLoading(false); }
  };

  // Load on tab switch
  useEffect(() => {
    if (tab==='dashboard') { fetchDash(); fetchClueStats(); }
    if (tab==='clues')    { fetchClueStats(); fetchClues(true); }
    if (tab==='players')  fetchPlayers(true);
    if (tab==='audit')    fetchLogs(true);
  }, [tab]);

  useEffect(() => { if (tab==='clues') fetchClues(true); }, [filterCat,filterDiff,search,showInactive]);
  useEffect(() => { if (tab==='players') fetchPlayers(true); }, [playerSearch,playerFilter]);

  const showMsg = (m) => { setActionMsg(m); setTimeout(()=>setActionMsg(''),4000); };

  // ── Clue actions ───────────────────────────────────────────────────────────
  const saveClue = async (form) => {
    setSavingClue(true);
    try {
      if (editTarget?._id) await apiJSON(`/clues/${editTarget._id}`, { method:'PUT', body:JSON.stringify(form) });
      else await apiJSON('/clues', { method:'POST', body:JSON.stringify(form) });
      setClueTab('list'); setEditTarget(null);
      fetchClueStats(); fetchClues(true);
      showMsg(editTarget?._id ? '✅ Clue updated' : '✅ Clue created');
    } catch(err) { showMsg(`❌ ${err.message}`); }
    finally { setSavingClue(false); }
  };

  const toggleClue = async (clue) => {
    try {
      const data = await apiJSON(`/clues/${clue._id}/toggle`, { method:'PATCH' });
      setClues(prev=>prev.map(c=>c._id===clue._id?data.clue:c));
      fetchClueStats();
    } catch(err) { showMsg(`❌ ${err.message}`); }
  };

  const deleteClue = async (clue) => {
    if (!window.confirm(`Delete "${clue.template.slice(0,60)}…"?`)) return;
    try {
      await apiJSON(`/clues/${clue._id}`, { method:'DELETE' });
      setClues(prev=>prev.filter(c=>c._id!==clue._id));
      setClueTotal(t=>t-1);
      fetchClueStats();
      showMsg('✅ Clue deleted');
    } catch(err) { showMsg(`❌ ${err.message}`); }
  };

  // ── Player actions ─────────────────────────────────────────────────────────
  const unbanPlayer = async (p) => {
    try {
      await apiJSON(`/admin/players/${p._id}/unban`, { method:'POST' });
      fetchPlayers(true);
      showMsg(`✅ ${p.username} unbanned`);
    } catch(err) { showMsg(`❌ ${err.message}`); }
  };

  const toggleVerified = async (p) => {
    try {
      await apiJSON(`/admin/players/${p._id}`, { method:'PATCH', body:JSON.stringify({ isVerified: !p.isVerified }) });
      fetchPlayers(true);
      showMsg(`✅ ${p.username} ${!p.isVerified?'verified':'unverified'}`);
    } catch(err) { showMsg(`❌ ${err.message}`); }
  };

  const tabs = [
    { id:'dashboard', label:'Dashboard' },
    { id:'clues',     label:'Clues' },
    { id:'players',   label:'Players' },
    { id:'audit',     label:'Audit Log' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-gray-700 font-mono text-xs mb-2">
            <button onClick={()=>navigate('/lobby')} className="hover:text-green-400">← LOBBY</button>
            <span>/</span><span className="text-gray-500">ADMIN</span>
          </div>
          <h1 className="font-display text-4xl font-bold text-green-400 tracking-wider uppercase">Admin Panel</h1>
          <p className="font-mono text-sm text-gray-500 mt-1">
            Signed in as <span className="text-green-400">{player?.username}</span>
            <span className="ml-2 text-xs text-yellow-400 border border-yellow-700 px-1 rounded">ADMIN</span>
          </p>
        </div>

        {actionMsg && (
          <p className={`font-mono text-sm ${actionMsg.startsWith('✅')?'text-green-400':'text-red-400'} bg-gray-900 border border-gray-800 px-4 py-2 rounded`}>
            {actionMsg}
          </p>
        )}

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`font-mono text-sm px-4 py-2 rounded border transition-colors ${tab===t.id?'bg-green-900/30 border-green-700 text-green-400':'border-gray-800 text-gray-600 hover:text-gray-400'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── DASHBOARD ────────────────────────────────────────────────────── */}
        {tab==='dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Players" value={dash?.totalPlayers}  color="text-green-400"  loading={dashLoading}/>
              <StatCard label="Online Now"    value={dash?.activePlayers} color="text-blue-400"   loading={dashLoading}/>
              <StatCard label="DAU (24h)"     value={dash?.dau}           color="text-purple-400" loading={dashLoading}/>
              <StatCard label="Active Games"  value={dash?.activeMatches} color="text-yellow-400" loading={dashLoading}/>
              <StatCard label="Total Clues"   value={dash?.totalClues}    color="text-green-400"  loading={dashLoading}/>
              <StatCard label="Active Clues"  value={dash?.activeClues}   color="text-green-400"  loading={dashLoading}/>
              <StatCard label="Banned"        value={dash?.bannedPlayers} color="text-red-400"    loading={dashLoading}/>
              <StatCard label="Verified"      value={dash?.verifiedPlayers} color="text-yellow-400" loading={dashLoading}/>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-7 gap-3">
              {ALL_CATEGORIES.map(cat=>(
                <div key={cat} className="glass-card p-3 text-center">
                  <p className={`font-display text-xl font-bold ${clueStats?.byCategory?.[cat]>0?'text-blue-400':'text-gray-700'}`}>
                    {clueStatsLoading?'—':(clueStats?.byCategory?.[cat]||0)}
                  </p>
                  <p className="font-mono text-[9px] text-gray-600 uppercase mt-1">{cat}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CLUES ────────────────────────────────────────────────────────── */}
        {tab==='clues' && (
          <div className="space-y-4">
            {/* Clue stats row */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Total"    value={clueStats?.total}    loading={clueStatsLoading}/>
              <StatCard label="Active"   value={clueStats?.active}   loading={clueStatsLoading}/>
              <StatCard label="Inactive" value={clueStats?.inactive} color="text-red-400" loading={clueStatsLoading}/>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-3">
              {['list','create','bulk'].map(t=>(
                <button key={t} onClick={()=>{setClueTab(t);setEditTarget(null);}}
                  className={`font-mono text-sm px-4 py-2 rounded border transition-colors ${clueTab===t?'bg-green-900/30 border-green-700 text-green-400':'border-gray-800 text-gray-600 hover:text-gray-400'}`}>
                  {t==='list'?`CLUES (${clueTotal})`:t==='create'?'+ CREATE':'⬆ BULK IMPORT'}
                </button>
              ))}
            </div>

            {clueTab==='bulk'&&<div className="glass-card p-6"><BulkImport onDone={()=>{fetchClueStats();fetchClues(true);}}/></div>}

            {(clueTab==='create'||editTarget)&&(
              <div className="glass-card p-6">
                <h2 className="font-display text-lg font-bold text-white mb-4">{editTarget?'EDIT CLUE':'CREATE NEW CLUE'}</h2>
                <ClueForm initial={editTarget||EMPTY_CLUE} onSave={saveClue} onCancel={()=>{setClueTab('list');setEditTarget(null);}} saving={savingClue}/>
              </div>
            )}

            {clueTab==='list'&&!editTarget&&(
              <div className="space-y-3">
                {/* Filters */}
                <div className="glass-card p-4 grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                  <div><label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">Search</label>
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search templates…" className="input-field text-sm w-full"/></div>
                  <div><label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">Category</label>
                    <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} className="input-field text-sm w-full">
                      <option value="">All</option>{ALL_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                  <div><label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">Difficulty</label>
                    <select value={filterDiff} onChange={e=>setFilterDiff(e.target.value)} className="input-field text-sm w-full">
                      <option value="">All</option>{[1,2,3,4,5,6,7,8,9,10].map(d=><option key={d} value={d}>D{d}</option>)}</select></div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="inactive" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)} className="accent-green-500"/>
                    <label htmlFor="inactive" className="font-mono text-xs text-gray-500">Show inactive</label>
                    <button onClick={()=>{setSearch('');setFilterCat('');setFilterDiff('');setShowInactive(true);}} className="font-mono text-xs text-gray-700 hover:text-gray-400 ml-auto">RESET</button>
                  </div>
                </div>

                {clueLoading&&clues.length===0?<p className="font-mono text-xs text-gray-700 text-center py-8">Loading…</p>
                :clues.length===0?<p className="font-mono text-xs text-gray-700 text-center py-8">No clues found.</p>
                :<>
                  {clues.map(clue=>(
                    <div key={clue._id} className="glass-card p-4 flex items-start gap-4">
                      <div className="flex-shrink-0 w-24">
                        <span className="font-mono text-[10px] text-gray-600 uppercase">{clue.category}</span>
                        <div className="flex gap-0.5 mt-1">{[1,2,3,4,5,6,7,8,9,10].map(d=>(
                          <div key={d} className={`h-1 w-2 rounded-sm ${d<=clue.difficulty?'bg-green-500/60':'bg-gray-800'}`}/>))}
                        </div>
                        <span className={`font-mono text-[9px] mt-1 block ${clue.isActive?'text-green-500':'text-gray-700'}`}>● {clue.isActive?'ACTIVE':'INACTIVE'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm text-white leading-snug">{clue.template.length>90?clue.template.slice(0,90)+'…':clue.template}</p>
                        <p className="font-mono text-[10px] text-gray-600 mt-1">Rule: <span className="text-gray-500">{clue.answerRule.slice(0,50)}</span></p>
                        {clue.hints?.length>0&&<p className="font-mono text-[10px] text-yellow-700 mt-0.5">💡 {clue.hints.length} hint{clue.hints.length>1?'s':''}</p>}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={()=>{setEditTarget(clue);setClueTab('create');}} className="font-mono text-xs border border-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded">EDIT</button>
                        <button onClick={()=>toggleClue(clue)} className={`font-mono text-xs border px-3 py-1.5 rounded ${clue.isActive?'border-red-900/60 text-red-500':'border-green-900/60 text-green-500'}`}>
                          {clue.isActive?'DISABLE':'ENABLE'}</button>
                        <button onClick={()=>deleteClue(clue)} className="font-mono text-xs text-red-800 hover:text-red-500 px-2 py-1.5">✕</button>
                      </div>
                    </div>
                  ))}
                  <div className="text-center pt-2">
                    <p className="font-mono text-xs text-gray-600 mb-3">Showing {clues.length} of {clueTotal} clues</p>
                    {hasMore&&<button onClick={()=>{setCluePage(p=>p+1);fetchClues(false);}} disabled={clueLoading} className="btn-secondary text-sm disabled:opacity-50">
                      {clueLoading?'Loading…':'Load More'}</button>}
                  </div>
                </>}
              </div>
            )}
          </div>
        )}

        {/* ── PLAYERS ──────────────────────────────────────────────────────── */}
        {tab==='players' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-48">
                <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">Search</label>
                <input value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)} placeholder="Username or email…" className="input-field text-sm w-full"/></div>
              <div>
                <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">Filter</label>
                <select value={playerFilter} onChange={e=>setPlayerFilter(e.target.value)} className="input-field text-sm">
                  <option value="">All players</option>
                  <option value="banned">Banned</option>
                  <option value="verified">Verified</option>
                  <option value="online">Online</option>
                </select>
              </div>
              <span className="font-mono text-xs text-gray-600">{playerTotal} players</span>
            </div>

            {/* Player list */}
            {playerLoading&&players.length===0?<p className="font-mono text-xs text-gray-700 text-center py-8">Loading…</p>
            :players.length===0?<p className="font-mono text-xs text-gray-700 text-center py-8">No players found.</p>
            :<div className="space-y-2">
              {players.map(p=>(
                <div key={p._id} className="glass-card p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-white">{p.username}</span>
                      {p.isVerified&&<span className="font-mono text-[10px] text-yellow-400 border border-yellow-700 px-1 rounded">✓ VERIFIED</span>}
                      {p.isBanned&&<span className="font-mono text-[10px] text-red-400 border border-red-700 px-1 rounded">BANNED</span>}
                      {p.isOnline&&<span className="font-mono text-[10px] text-green-400 border border-green-800 px-1 rounded">● ONLINE</span>}
                      {p.subscription?.plan!=='free'&&<span className="font-mono text-[10px] text-purple-400 border border-purple-700 px-1 rounded uppercase">{p.subscription.plan}</span>}
                    </div>
                    <p className="font-mono text-xs text-gray-500 mt-0.5">{p.email}</p>
                    <p className="font-mono text-[10px] text-gray-700 mt-0.5">
                      Games: {p.stats?.gamesPlayed||0} · Wins: {p.stats?.wins||0} · Joined: {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                    <button onClick={()=>toggleVerified(p)}
                      className={`font-mono text-xs border px-2 py-1.5 rounded transition-colors ${p.isVerified?'border-gray-700 text-gray-500 hover:border-red-800 hover:text-red-400':'border-yellow-800 text-yellow-500 hover:bg-yellow-950/30'}`}>
                      {p.isVerified?'Unverify':'Verify'}
                    </button>
                    <button onClick={()=>setGiftTarget(p)}
                      className="font-mono text-xs border border-purple-800 text-purple-400 hover:bg-purple-950/30 px-2 py-1.5 rounded">
                      🎁 Gift
                    </button>
                    {p.isBanned
                      ? <button onClick={()=>unbanPlayer(p)} className="font-mono text-xs border border-green-800 text-green-400 hover:bg-green-950/30 px-2 py-1.5 rounded">Unban</button>
                      : <button onClick={()=>setBanTarget(p)} className="font-mono text-xs border border-red-900 text-red-500 hover:bg-red-950/30 px-2 py-1.5 rounded">Ban</button>
                    }
                  </div>
                </div>
              ))}
              {playerTotal>players.length&&(
                <div className="text-center pt-2">
                  <button onClick={()=>{setPlayerPage(p=>p+1);fetchPlayers(false);}} disabled={playerLoading} className="btn-secondary text-sm disabled:opacity-50">
                    {playerLoading?'Loading…':'Load More'}</button>
                </div>
              )}
            </div>}
          </div>
        )}

        {/* ── AUDIT LOG ────────────────────────────────────────────────────── */}
        {tab==='audit' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs text-gray-600">{logTotal} log entries</p>
              <button onClick={()=>fetchLogs(true)} className="font-mono text-xs text-gray-600 hover:text-green-400">↻ REFRESH</button>
            </div>
            {logLoading&&logs.length===0?<p className="font-mono text-xs text-gray-700 text-center py-8">Loading…</p>
            :logs.length===0?<p className="font-mono text-xs text-gray-700 text-center py-8">No audit logs yet.</p>
            :<div className="space-y-2">
              {logs.map((log,i)=>(
                <div key={log._id||i} className="glass-card px-4 py-3 flex items-start gap-4">
                  <div className="flex-shrink-0 text-right w-32">
                    <p className="font-mono text-[10px] text-gray-600">{new Date(log.createdAt).toLocaleDateString()}</p>
                    <p className="font-mono text-[10px] text-gray-700">{new Date(log.createdAt).toLocaleTimeString()}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-green-400">{log.adminName||log.adminId}</span>
                      <span className="font-mono text-xs text-yellow-500 border border-yellow-800 px-1.5 rounded">{log.action}</span>
                    </div>
                    {log.target&&<p className="font-mono text-[10px] text-gray-600 mt-0.5">{log.target}</p>}
                    {log.details&&<p className="font-mono text-[10px] text-gray-700 mt-0.5 truncate">{JSON.stringify(log.details).slice(0,80)}</p>}
                  </div>
                </div>
              ))}
              {logTotal>logs.length&&(
                <div className="text-center pt-2">
                  <button onClick={()=>{setLogPage(p=>p+1);fetchLogs(false);}} disabled={logLoading} className="btn-secondary text-sm disabled:opacity-50">
                    {logLoading?'Loading…':'Load More'}</button>
                </div>
              )}
            </div>}
          </div>
        )}

      </div>

      {/* Modals */}
      {banTarget  && <BanModal  player={banTarget}  onClose={()=>setBanTarget(null)}  onDone={()=>fetchPlayers(true)}/>}
      {giftTarget && <GiftModal player={giftTarget} onClose={()=>setGiftTarget(null)} onDone={()=>fetchPlayers(true)}/>}
    </div>
  );
}
