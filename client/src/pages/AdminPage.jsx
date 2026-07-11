/**
 * AdminPage.jsx — Fixed
 *
 * Bugs fixed:
 *   1. Stats showed wrong category counts (all 0) because it counted categories
 *      from the paginated API response (50 clues) instead of all clues.
 *      Fix: now calls GET /api/clues/stats which does a server-side MongoDB
 *      aggregation across ALL clues and returns exact counts per category.
 *
 *   2. Used raw fetch with the old `token` field — now uses apiJSON/apiFetch
 *      which handles auth + auto-refresh transparently.
 *
 *   3. Clue list now properly paginates with Load More, instead of being
 *      silently capped at 50.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/authStore';
import { apiJSON, apiFetch } from '../api/apiClient';

// ── Constants ─────────────────────────────────────────────────────────────────
const ALL_CATEGORIES = [
  'number','word','symbol','environment','logic','pattern','sound',
  'math','binary','cipher','spatial','time','color','riddle',
];

const EMPTY_CLUE = {
  category:'number', template:'', answerRule:'', flavorText:'',
  difficulty:1, hints:[], variables:[],
};

// ── VariableEditor ────────────────────────────────────────────────────────────
function VariableEditor({ variables, onChange }) {
  const add = () => onChange([...variables, { name:'X', type:'number', min:1, max:10, options:[] }]);
  const remove = i => onChange(variables.filter((_,j) => j !== i));
  const update = (i, field, val) => {
    const next = [...variables];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="font-mono text-xs text-gray-500 uppercase tracking-wider">
          Variables ({variables.length})
        </label>
        {variables.length < 6 && (
          <button type="button" onClick={add}
            className="text-xs font-mono text-green-500 border border-green-800/50 px-2 py-0.5 rounded hover:bg-green-950/30">
            + ADD
          </button>
        )}
      </div>
      {variables.map((v, i) => (
        <div key={i} className="grid grid-cols-5 gap-2 items-end">
          <div>
            <span className="font-mono text-[10px] text-gray-600 block mb-1">NAME</span>
            <input value={v.name} onChange={e => update(i,'name',e.target.value.toUpperCase())}
              className="input-field text-sm uppercase w-full" maxLength={4}/>
          </div>
          <div>
            <span className="font-mono text-[10px] text-gray-600 block mb-1">TYPE</span>
            <select value={v.type} onChange={e => update(i,'type',e.target.value)} className="input-field text-sm w-full">
              <option value="number">number</option>
              <option value="letter">letter</option>
              <option value="choice">choice</option>
              <option value="symbol">symbol</option>
            </select>
          </div>
          {(v.type === 'number') && <>
            <div>
              <span className="font-mono text-[10px] text-gray-600 block mb-1">MIN</span>
              <input type="number" value={v.min} onChange={e => update(i,'min',parseInt(e.target.value)||0)}
                className="input-field text-sm w-full"/>
            </div>
            <div>
              <span className="font-mono text-[10px] text-gray-600 block mb-1">MAX</span>
              <input type="number" value={v.max} onChange={e => update(i,'max',parseInt(e.target.value)||10)}
                className="input-field text-sm w-full"/>
            </div>
          </>}
          {v.type === 'choice' && (
            <div className="col-span-2">
              <span className="font-mono text-[10px] text-gray-600 block mb-1">OPTIONS (comma-sep)</span>
              <input value={(v.options||[]).join(',')}
                onChange={e => update(i,'options',e.target.value.split(',').map(s=>s.trim()).filter(Boolean))}
                className="input-field text-sm w-full" placeholder="APPLE,BRIDGE,CLOCK"/>
            </div>
          )}
          <button type="button" onClick={() => remove(i)}
            className="font-mono text-xs text-red-500/60 hover:text-red-400 border border-transparent hover:border-red-900/50 px-2 py-1.5 rounded">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ── ClueForm ──────────────────────────────────────────────────────────────────
function ClueForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || EMPTY_CLUE);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)} className="input-field w-full">
            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
            Difficulty (1/10)
          </label>
          <input type="range" min={1} max={10} value={form.difficulty}
            onChange={e => set('difficulty', parseInt(e.target.value))}
            className="w-full accent-green-500 mt-2"/>
          <span className="font-mono text-xs text-gray-500">{form.difficulty}/10</span>
        </div>
      </div>

      <div>
        <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
          Template — use {'{X}'} for variables
        </label>
        <textarea value={form.template} onChange={e => set('template', e.target.value)}
          placeholder="Only even numbers survive. The code is {X}."
          rows={3} className="input-field w-full font-mono text-sm"/>
      </div>

      <div>
        <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
          Answer Rule — e.g. even:{'{X}'}
        </label>
        <input value={form.answerRule} onChange={e => set('answerRule', e.target.value)}
          placeholder="even:{X}" className="input-field w-full font-mono"/>
      </div>

      <div>
        <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
          Flavor Text (optional)
        </label>
        <input value={form.flavorText} onChange={e => set('flavorText', e.target.value)}
          placeholder="Mathematical equations cover the walls."
          className="input-field w-full"/>
      </div>

      {/* Hints */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-mono text-xs text-gray-500 uppercase tracking-wider">
            Hints <span className="text-gray-700 normal-case tracking-normal font-body text-xs">
              — D1-3 get 2, D4-6 get 1, D7-10 get 0
            </span>
          </label>
          {(form.hints||[]).length < 2 && form.difficulty <= 6 && (
            <button type="button" onClick={() => set('hints',[...(form.hints||[]),''])}
              className="text-xs font-mono text-green-500 border border-green-800/50 px-2 py-0.5 rounded">
              + ADD HINT
            </button>
          )}
        </div>
        {(form.hints||[]).map((hint,i) => (
          <div key={i} className="flex gap-2">
            <div className="flex-1 relative">
              <div className="absolute left-3 top-2.5 flex items-center gap-1.5 pointer-events-none">
                <span className={`w-2 h-2 rounded-full ${i===0?'bg-yellow-500':'bg-orange-500'}`}/>
                <span className="font-mono text-[10px] text-gray-600">
                  {i===0?'Hint 1 — at 67% time':'Hint 2 — at 33% time'}
                </span>
              </div>
              <input value={hint}
                onChange={e => { const n=[...(form.hints||[])]; n[i]=e.target.value; set('hints',n); }}
                placeholder={i===0?'Vague nudge…':'Stronger nudge (no answer)…'}
                className="input-field w-full pt-7 pb-2 text-sm"/>
            </div>
            <button type="button" onClick={() => set('hints',(form.hints||[]).filter((_,j)=>j!==i))}
              className="text-xs font-mono text-red-500/60 hover:text-red-400 border border-transparent hover:border-red-900 px-2 rounded">
              ✕
            </button>
          </div>
        ))}
      </div>

      <VariableEditor variables={form.variables||[]} onChange={v => set('variables',v)}/>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => onSave(form)} disabled={saving || !form.template || !form.answerRule}
          className="btn-primary flex-1 disabled:opacity-50">
          {saving ? 'SAVING…' : initial?._id ? 'SAVE CHANGES' : 'CREATE CLUE'}
        </button>
        <button type="button" onClick={onCancel}
          className="btn-secondary px-6">
          CANCEL
        </button>
      </div>
    </div>
  );
}

// ── BulkImport ────────────────────────────────────────────────────────────────
function BulkImport({ onDone }) {
  const [json, setJson] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const EXAMPLE = JSON.stringify({
    clues: [{
      category:'number', template:'Only even numbers survive. The code is {X}.', answerRule:'even:{X}',
      difficulty:1, flavorText:'Number sequences cover the walls.',
      hints:['Even = divisible by 2 with no remainder.','Check last digit: 0,2,4,6,8 = even.'],
      variables:[{name:'X',type:'number',min:100,max:999}],
    }],
  }, null, 2);

  const handleImport = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const parsed = JSON.parse(json);
      const data = await apiJSON('/clues/bulk', {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
      setResult(data);
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="font-mono text-xs text-gray-500">
        Paste a JSON object with a <code className="text-green-400">clues</code> array.
        Duplicate templates are automatically skipped.
      </p>
      <textarea value={json} onChange={e => setJson(e.target.value)} rows={14}
        placeholder={EXAMPLE} className="input-field w-full font-mono text-xs"/>
      {error && <p className="font-mono text-xs text-red-400">⚠ {error}</p>}
      {result && (
        <div className="font-mono text-xs space-y-1">
          <p className="text-green-400">✅ {result.inserted} clues added</p>
          {result.skipped > 0 && <p className="text-yellow-500">⏭ {result.skipped} duplicates skipped</p>}
        </div>
      )}
      <button onClick={handleImport} disabled={!json.trim() || loading}
        className="btn-primary w-full disabled:opacity-50">
        {loading ? 'IMPORTING…' : '⬆ IMPORT CLUES'}
      </button>
    </div>
  );
}

// ── Main AdminPage ─────────────────────────────────────────────────────────────
export default function AdminPage() {
  const navigate = useNavigate();
  const { player } = useAuthStore();

  const [stats, setStats]         = useState(null);   // from /api/clues/stats
  const [clues, setClues]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(false);
  const [loadingClues, setLoadingClues] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  const [tab, setTab]             = useState('clues'); // 'clues' | 'create' | 'bulk'
  const [editTarget, setEditTarget] = useState(null);

  const [filterCat,   setFilterCat]   = useState('');
  const [filterDiff,  setFilterDiff]  = useState('');
  const [search,      setSearch]      = useState('');
  const [showInactive, setShowInactive] = useState(true);

  const [saving, setSaving]       = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const PAGE_SIZE = 50;

  // ── Redirect non-admins ───────────────────────────────────────────────────
  useEffect(() => {
    if (player && !player.isAdmin) navigate('/lobby');
  }, [player]);

  // ── Load stats from server (accurate, all clues) ──────────────────────────
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await apiJSON('/clues/stats');
      // data.stats = [{ _id: { category, difficulty, isActive }, count }]
      // Build human-readable summary
      const summary = { total: 0, active: 0, inactive: 0, byCategory: {} };
      (data.stats || []).forEach(s => {
        summary.total += s.count;
        if (s._id.isActive) summary.active += s.count;
        else summary.inactive += s.count;
        const cat = s._id.category;
        summary.byCategory[cat] = (summary.byCategory[cat] || 0) + s.count;
      });
      setStats(summary);
    } catch (err) {
      console.error('Stats error:', err.message);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // ── Load paginated clue list ───────────────────────────────────────────────
  const fetchClues = useCallback(async (resetPage = false) => {
    const targetPage = resetPage ? 1 : page;
    if (resetPage) setPage(1);
    setLoadingClues(true);
    try {
      const params = new URLSearchParams({
        page: targetPage,
        limit: PAGE_SIZE,
        ...(filterCat   && { category: filterCat }),
        ...(filterDiff  && { difficulty: filterDiff }),
        ...(search      && { search }),
        ...(showInactive && { includeInactive: '1' }),
      });
      const data = await apiJSON(`/clues?${params}`);
      if (resetPage) {
        setClues(data.clues || []);
      } else {
        setClues(prev => targetPage === 1 ? (data.clues || []) : [...prev, ...(data.clues || [])]);
      }
      setTotal(data.total || 0);
      setHasMore((data.page || 1) < (data.pages || 1));
    } catch (err) {
      console.error('Clues error:', err.message);
    } finally {
      setLoadingClues(false);
    }
  }, [filterCat, filterDiff, search, showInactive, page]);

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { fetchClues(true); }, [filterCat, filterDiff, search, showInactive]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (editTarget?._id) {
        await apiJSON(`/clues/${editTarget._id}`, { method:'PUT', body: JSON.stringify(form) });
        setActionMsg('✅ Clue updated');
      } else {
        await apiJSON('/clues', { method:'POST', body: JSON.stringify(form) });
        setActionMsg('✅ Clue created');
      }
      setTab('clues');
      setEditTarget(null);
      fetchStats();
      fetchClues(true);
    } catch (err) {
      setActionMsg(`❌ ${err.message}`);
    } finally {
      setSaving(false);
      setTimeout(() => setActionMsg(''), 4000);
    }
  };

  const handleToggle = async (clue) => {
    try {
      const data = await apiJSON(`/clues/${clue._id}/toggle`, { method:'PATCH' });
      setClues(prev => prev.map(c => c._id === clue._id ? data.clue : c));
      fetchStats();
    } catch (err) {
      setActionMsg(`❌ ${err.message}`);
      setTimeout(() => setActionMsg(''), 3000);
    }
  };

  const handleDelete = async (clue) => {
    if (!window.confirm(`Delete "${clue.template.slice(0,60)}…"?`)) return;
    try {
      await apiJSON(`/clues/${clue._id}`, { method:'DELETE' });
      setClues(prev => prev.filter(c => c._id !== clue._id));
      setTotal(t => t - 1);
      fetchStats();
    } catch (err) {
      setActionMsg(`❌ ${err.message}`);
      setTimeout(() => setActionMsg(''), 3000);
    }
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchClues(false);
  };

  // ── Stat card ──────────────────────────────────────────────────────────────
  const StatCard = ({ label, value, color = 'text-green-400' }) => (
    <div className="glass-card p-4 text-center">
      <p className={`font-display text-2xl font-bold ${color}`}>
        {loadingStats ? '—' : (value ?? 0)}
      </p>
      <p className="font-mono text-[10px] text-gray-600 uppercase tracking-widest mt-1">{label}</p>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-gray-700 font-mono text-xs mb-2">
            <button onClick={() => navigate('/lobby')} className="hover:text-green-400">← LOBBY</button>
            <span>/</span>
            <span className="text-gray-500">ADMIN</span>
          </div>
          <h1 className="font-display text-4xl font-bold text-green-400 tracking-wider uppercase">
            Admin Panel
          </h1>
          <p className="font-mono text-sm text-gray-500 mt-1">
            Signed in as <span className="text-green-400">{player?.username}</span>
            <span className="ml-2 text-xs text-yellow-400 border border-yellow-700 px-1 rounded">ADMIN</span>
          </p>
        </div>

        {/* Stats — from server-side aggregation, accurate for ALL clues */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <StatCard label="Total"    value={stats?.total}    color="text-green-400"/>
          <StatCard label="Active"   value={stats?.active}   color="text-green-400"/>
          <StatCard label="Inactive" value={stats?.inactive} color="text-red-400"/>
          {ALL_CATEGORIES.slice(0,7).map(cat => (
            <StatCard key={cat} label={cat}
              value={stats?.byCategory?.[cat]}
              color={stats?.byCategory?.[cat] > 0 ? 'text-blue-400' : 'text-gray-700'}/>
          ))}
        </div>
        {/* New categories row */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
          {ALL_CATEGORIES.slice(7).map(cat => (
            <StatCard key={cat} label={cat}
              value={stats?.byCategory?.[cat]}
              color={stats?.byCategory?.[cat] > 0 ? 'text-purple-400' : 'text-gray-700'}/>
          ))}
        </div>

        {actionMsg && (
          <p className={`font-mono text-sm ${actionMsg.startsWith('✅')?'text-green-400':'text-red-400'}`}>
            {actionMsg}
          </p>
        )}

        {/* Tabs */}
        <div className="flex gap-3">
          <button onClick={() => { setTab('clues'); setEditTarget(null); }}
            className={`font-mono text-sm px-4 py-2 rounded border ${tab==='clues'?'bg-green-900/30 border-green-700 text-green-400':'border-gray-800 text-gray-600 hover:text-gray-400'}`}>
            CLUES ({total})
          </button>
          <button onClick={() => { setTab('create'); setEditTarget(null); }}
            className={`font-mono text-sm px-4 py-2 rounded border ${tab==='create'?'bg-green-900/30 border-green-700 text-green-400':'border-gray-800 text-gray-600 hover:text-gray-400'}`}>
            + CREATE
          </button>
          <button onClick={() => setTab('bulk')}
            className={`font-mono text-sm px-4 py-2 rounded border ${tab==='bulk'?'bg-green-900/30 border-green-700 text-green-400':'border-gray-800 text-gray-600 hover:text-gray-400'}`}>
            ⬆ BULK IMPORT
          </button>
        </div>

        {/* Tab panels */}
        {tab === 'bulk' && (
          <div className="glass-card p-6">
            <h2 className="font-display text-lg font-bold text-white mb-4">Bulk Import Clues</h2>
            <BulkImport onDone={() => { fetchStats(); fetchClues(true); setTab('clues'); }}/>
          </div>
        )}

        {(tab === 'create' || editTarget) && (
          <div className="glass-card p-6">
            <h2 className="font-display text-lg font-bold text-white mb-6">
              {editTarget ? 'EDIT CLUE' : 'CREATE NEW CLUE'}
            </h2>
            <ClueForm
              initial={editTarget || EMPTY_CLUE}
              onSave={handleSave}
              onCancel={() => { setTab('clues'); setEditTarget(null); }}
              saving={saving}
            />
          </div>
        )}

        {tab === 'clues' && !editTarget && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="glass-card p-4 grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">Search</label>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search templates…" className="input-field text-sm w-full"/>
              </div>
              <div>
                <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">Category</label>
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="input-field text-sm w-full">
                  <option value="">All</option>
                  {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">Difficulty</label>
                <select value={filterDiff} onChange={e => setFilterDiff(e.target.value)} className="input-field text-sm w-full">
                  <option value="">All</option>
                  {[1,2,3,4,5,6,7,8,9,10].map(d => <option key={d} value={d}>D{d}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="inactive" checked={showInactive}
                  onChange={e => setShowInactive(e.target.checked)} className="accent-green-500"/>
                <label htmlFor="inactive" className="font-mono text-xs text-gray-500">Show inactive</label>
                <button onClick={() => { setSearch(''); setFilterCat(''); setFilterDiff(''); setShowInactive(true); }}
                  className="font-mono text-xs text-gray-700 hover:text-gray-400 ml-2">RESET</button>
              </div>
            </div>

            {/* Clue list */}
            {loadingClues && clues.length === 0 ? (
              <p className="font-mono text-xs text-gray-700 text-center py-12">Loading clues…</p>
            ) : clues.length === 0 ? (
              <p className="font-mono text-xs text-gray-700 text-center py-12">No clues found.</p>
            ) : (
              <>
                {clues.map(clue => (
                  <motion.div key={clue._id} initial={{ opacity:0 }} animate={{ opacity:1 }}
                    className="glass-card p-4 flex items-start gap-4">
                    {/* Category badge */}
                    <div className="flex-shrink-0 w-24">
                      <span className="font-mono text-[10px] text-gray-600 uppercase tracking-wider block">
                        {clue.category}
                      </span>
                      <div className="flex gap-0.5 mt-1.5">
                        {[1,2,3,4,5,6,7,8,9,10].map(d => (
                          <div key={d} className={`h-1 w-2 rounded-sm ${d <= clue.difficulty ? 'bg-green-500/60' : 'bg-gray-800'}`}/>
                        ))}
                      </div>
                      <span className={`font-mono text-[9px] mt-1 block ${clue.isActive ? 'text-green-500' : 'text-gray-700'}`}>
                        ● {clue.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm text-white leading-snug">
                        {clue.template.length > 100 ? clue.template.slice(0,100)+'…' : clue.template}
                      </p>
                      <p className="font-mono text-[10px] text-gray-600 mt-1">
                        Rule: <span className="text-gray-500">{clue.answerRule.slice(0,60)}</span>
                      </p>
                      {clue.flavorText && (
                        <p className="font-mono text-[10px] text-gray-700 italic mt-0.5">
                          {clue.flavorText.slice(0,70)}
                        </p>
                      )}
                      {clue.hints?.length > 0 && (
                        <p className="font-mono text-[10px] text-yellow-700 mt-0.5">
                          💡 {clue.hints.length} hint{clue.hints.length>1?'s':''}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => { setEditTarget(clue); setTab('create'); }}
                        className="font-mono text-xs border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-3 py-1.5 rounded">
                        EDIT
                      </button>
                      <button onClick={() => handleToggle(clue)}
                        className={`font-mono text-xs border px-3 py-1.5 rounded ${
                          clue.isActive
                            ? 'border-red-900/60 text-red-500 hover:bg-red-950/30'
                            : 'border-green-900/60 text-green-500 hover:bg-green-950/30'}`}>
                        {clue.isActive ? 'DISABLE' : 'ENABLE'}
                      </button>
                      <button onClick={() => handleDelete(clue)}
                        className="font-mono text-xs text-red-800 hover:text-red-500 px-2 py-1.5">
                        ✕
                      </button>
                    </div>
                  </motion.div>
                ))}

                {/* Pagination */}
                <div className="text-center pt-2">
                  <p className="font-mono text-xs text-gray-600 mb-3">
                    Showing {clues.length} of {total} clues
                  </p>
                  {hasMore && (
                    <button onClick={loadMore} disabled={loadingClues}
                      className="btn-secondary text-sm disabled:opacity-50">
                      {loadingClues ? 'Loading…' : 'Load More'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
