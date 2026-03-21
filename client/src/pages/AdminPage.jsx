/**
 * AdminPage — Full clue management panel
 * Only accessible when player.isAdmin === true (verified server-side via ADMIN_IDS env or role)
 *
 * Sections:
 *  - Stats bar (total clues, active, inactive, by category)
 *  - Clue list with filter/search, toggle, delete, inline edit
 *  - Create new clue form
 *  - Bulk JSON import
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/authStore';

const API = import.meta.env.VITE_API_URL || '/api';

const CATEGORIES = ['number', 'word', 'symbol', 'environment', 'logic', 'pattern', 'sound'];
const DIFFICULTIES = [1, 2, 3, 4, 5];

const CATEGORY_COLORS = {
  number:      'text-blue-400 border-blue-700/50 bg-blue-900/20',
  word:        'text-purple-400 border-purple-700/50 bg-purple-900/20',
  symbol:      'text-yellow-400 border-yellow-700/50 bg-yellow-900/20',
  environment: 'text-green-400 border-green-700/50 bg-green-900/20',
  logic:       'text-red-400 border-red-700/50 bg-red-900/20',
  pattern:     'text-cyan-400 border-cyan-700/50 bg-cyan-900/20',
  sound:       'text-pink-400 border-pink-700/50 bg-pink-900/20',
};

const EMPTY_CLUE = {
  category: 'number',
  template: '',
  answerRule: '',
  flavorText: '',
  difficulty: 1,
  hints: [],
  variables: [],
};

// ── Tiny helpers ──────────────────────────────────────────────────────────────
const DifficultyDots = ({ level }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((d) => (
      <div
        key={d}
        className={`w-2 h-2 rounded-full ${
          d <= level ? 'bg-orange-400' : 'bg-white/10'
        }`}
      />
    ))}
  </div>
);

const Badge = ({ category }) => (
  <span className={`text-xs font-mono px-2 py-0.5 rounded border ${CATEGORY_COLORS[category] || 'text-gray-400 border-gray-700'}`}>
    {category}
  </span>
);

// ── Variable editor sub-component ─────────────────────────────────────────────
function VariableEditor({ variables, onChange }) {
  const add = () =>
    onChange([...variables, { name: '', type: 'number', min: 1, max: 10, options: [] }]);

  const update = (i, field, value) => {
    const next = variables.map((v, idx) =>
      idx === i ? { ...v, [field]: value } : v
    );
    onChange(next);
  };

  const remove = (i) => onChange(variables.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="font-mono text-xs text-gray-500 uppercase tracking-wider">
          Variables ({variables.length})
        </label>
        <button
          type="button"
          onClick={add}
          className="text-xs font-mono text-green-500 hover:text-green-400 border border-green-800/50 px-2 py-0.5 rounded"
        >
          + ADD
        </button>
      </div>
      {variables.map((v, i) => (
        <div key={i} className="bg-void-700/50 border border-white/5 rounded p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-mono text-[10px] text-gray-600">Name</label>
              <input
                value={v.name}
                onChange={(e) => update(i, 'name', e.target.value.toUpperCase())}
                placeholder="X"
                className="input-field text-sm py-1.5 mt-0.5"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] text-gray-600">Type</label>
              <select
                value={v.type}
                onChange={(e) => update(i, 'type', e.target.value)}
                className="input-field text-sm py-1.5 mt-0.5"
              >
                {['number', 'letter', 'choice', 'symbol'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          {v.type === 'number' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-mono text-[10px] text-gray-600">Min</label>
                <input type="number" value={v.min} onChange={(e) => update(i, 'min', +e.target.value)}
                  className="input-field text-sm py-1.5 mt-0.5" />
              </div>
              <div>
                <label className="font-mono text-[10px] text-gray-600">Max</label>
                <input type="number" value={v.max} onChange={(e) => update(i, 'max', +e.target.value)}
                  className="input-field text-sm py-1.5 mt-0.5" />
              </div>
            </div>
          )}
          {(v.type === 'choice' || v.type === 'word') && (
            <div>
              <label className="font-mono text-[10px] text-gray-600">Options (comma-separated)</label>
              <input
                value={(v.options || []).join(', ')}
                onChange={(e) => update(i, 'options', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                placeholder="RED, BLUE, GREEN"
                className="input-field text-sm py-1.5 mt-0.5"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-xs font-mono text-red-500/70 hover:text-red-400"
          >
            ✕ Remove
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Clue Form (shared by Create and Edit) ─────────────────────────────────────
function ClueForm({ initial, onSubmit, onCancel, submitLabel = 'SAVE' }) {
  const [form, setForm] = useState(initial || EMPTY_CLUE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.template.trim() || !form.answerRule.trim()) {
      setError('Template and Answer Rule are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Category + Difficulty row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">Category</label>
          <select value={form.category} onChange={(e) => set('category', e.target.value)}
            className="input-field">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
            Difficulty ({form.difficulty}/5)
          </label>
          <input type="range" min={1} max={5} value={form.difficulty}
            onChange={(e) => set('difficulty', +e.target.value)}
            className="w-full mt-2 accent-orange-400" />
        </div>
      </div>

      {/* Template */}
      <div>
        <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
          Template <span className="text-gray-700 normal-case tracking-normal">— use {`{X}`} for variables</span>
        </label>
        <textarea
          value={form.template}
          onChange={(e) => set('template', e.target.value)}
          rows={2}
          placeholder='Numbers divisible by {X} survive. The code is {Y}.'
          className="input-field resize-none"
          required
        />
      </div>

      {/* Answer Rule */}
      <div>
        <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
          Answer Rule <span className="text-gray-700 normal-case tracking-normal">— e.g. divisible_by:{`{X}:{Y}`}</span>
        </label>
        <input
          value={form.answerRule}
          onChange={(e) => set('answerRule', e.target.value)}
          placeholder="divisible_by:{X}:{Y}"
          className="input-field font-mono"
          required
        />
      </div>

      {/* Flavor Text */}
      <div>
        <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">Flavor Text (optional)</label>
        <input
          value={form.flavorText}
          onChange={(e) => set('flavorText', e.target.value)}
          placeholder="Mathematical equations cover the walls."
          className="input-field"
        />
      </div>

      {/* Hints */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-mono text-xs text-gray-500 uppercase tracking-wider">
            Hints{' '}
            <span className="text-gray-700 normal-case tracking-normal font-body">
              — revealed progressively during puzzle phase
            </span>
          </label>
          {(form.hints || []).length < 2 && (
            <button
              type="button"
              onClick={() => set('hints', [...(form.hints || []), ''])}
              className="text-xs font-mono text-green-500 hover:text-green-400 border border-green-800/50 px-2 py-0.5 rounded"
            >
              + ADD HINT
            </button>
          )}
        </div>

        {(form.hints || []).length === 0 && (
          <p className="font-mono text-[10px] text-gray-700">
            No hints. Players receive no guidance during the puzzle phase.
          </p>
        )}

        {(form.hints || []).map((hint, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1 relative">
              <div className="absolute left-3 top-3 flex items-center gap-1.5 pointer-events-none">
                <span className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-yellow-500' : 'bg-orange-500'}`} />
                <span className="font-mono text-[10px] text-gray-600">
                  {i === 0 ? 'Shown at ~67% time' : 'Shown at ~33% time'}
                </span>
              </div>
              <input
                value={hint}
                onChange={(e) => {
                  const next = [...(form.hints || [])];
                  next[i] = e.target.value;
                  set('hints', next);
                }}
                placeholder={
                  i === 0
                    ? 'Vague nudge — e.g. "Think about divisibility rules."'
                    : 'Stronger nudge — e.g. "Check if the remainder is zero."'
                }
                className="input-field text-sm pt-8 pb-2"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const next = (form.hints || []).filter((_, idx) => idx !== i);
                set('hints', next);
              }}
              className="mt-2 text-xs font-mono text-red-500/60 hover:text-red-400 border border-transparent hover:border-red-900 px-2 py-1 rounded"
            >
              ✕
            </button>
          </div>
        ))}

        {(form.hints || []).length > 0 && (
          <p className="font-mono text-[10px] text-gray-700 mt-1">
            💡 Good hints guide thinking without giving the answer away.
          </p>
        )}
      </div>

      {/* Variables */}
      <VariableEditor variables={form.variables || []} onChange={(v) => set('variables', v)} />

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded px-3 py-2 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving} className="btn-primary flex-1">
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              SAVING…
            </span>
          ) : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">CANCEL</button>
        )}
      </div>
    </form>
  );
}

// ── Bulk Import Panel ──────────────────────────────────────────────────────────
function BulkImport({ token, onSuccess }) {
  const [json, setJson] = useState('');
  const [status, setStatus] = useState(null); // null | {ok, message}
  const [loading, setLoading] = useState(false);

  const EXAMPLE = JSON.stringify({
    clues: [
      {
        category: 'number',
        template: 'Only even numbers survive. The code is {X}.',
        answerRule: 'even',
        difficulty: 1,
        flavorText: 'Number sequences cover the walls.',
        hints: [
          'Even numbers are divisible by 2 with no remainder.',
          'Check the last digit — 0, 2, 4, 6, or 8 means even.',
        ],
        variables: [{ name: 'X', type: 'number', min: 100, max: 999 }],
      },
      {
        category: 'logic',
        template: 'If it rains, the ground is wet. The ground is dry. Did it rain?',
        answerRule: 'modus_tollens:no',
        difficulty: 3,
        flavorText: 'A weather station with contradictory readings.',
        hints: [
          'This is cause-and-effect: if the cause happened, the effect must follow.',
          'The effect (wet ground) did NOT happen — so can the cause have occurred?',
        ],
        variables: [],
      },
    ],
  }, null, 2);

  const handleImport = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const parsed = JSON.parse(json);
      const res = await fetch(`${API}/clues/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setStatus({ ok: true, message: `✅ Imported ${data.inserted} clue(s) successfully` });
      setJson('');
      onSuccess();
    } catch (err) {
      setStatus({ ok: false, message: `❌ ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-gray-500">Paste a JSON object with a "clues" array</p>
        <button
          onClick={() => setJson(EXAMPLE)}
          className="text-xs font-mono text-green-500/70 hover:text-green-400 border border-green-900 px-2 py-0.5 rounded"
        >
          LOAD EXAMPLE
        </button>
      </div>

      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={14}
        placeholder={EXAMPLE}
        spellCheck={false}
        className="input-field font-mono text-xs resize-none leading-relaxed"
      />

      {status && (
        <div className={`rounded px-3 py-2 text-sm font-body border ${
          status.ok
            ? 'bg-green-900/30 border-green-700/50 text-green-300'
            : 'bg-red-900/30 border-red-700/50 text-red-400'
        }`}>
          {status.message}
        </div>
      )}

      <button
        onClick={handleImport}
        disabled={loading || !json.trim()}
        className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'IMPORTING…' : '⬆ IMPORT CLUES'}
      </button>
    </div>
  );
}

// ── Main Admin Page ────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { player, token } = useAuthStore();
  const navigate = useNavigate();

  // Access guard
  useEffect(() => {
    if (player && !player.isAdmin) navigate('/lobby');
  }, [player]);

  const [clues, setClues] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, byCategory: {} });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ category: '', difficulty: '', search: '', includeInactive: true });
  const [activeTab, setActiveTab] = useState('clues'); // clues | create | bulk
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const authHeaders = { Authorization: `Bearer ${token}` };

  // ── Fetch clues ──────────────────────────────────────────────────────────────
  const fetchClues = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.difficulty) params.set('difficulty', filters.difficulty);
      if (filters.search) params.set('search', filters.search);
      if (filters.includeInactive) params.set('includeInactive', '1');

      const res = await fetch(`${API}/clues?${params}`, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setClues(data.clues || []);

      // Compute stats
      const allRes = await fetch(`${API}/clues?includeInactive=1`, { headers: authHeaders });
      const allData = await allRes.json();
      const all = allData.clues || [];
      const byCategory = {};
      CATEGORIES.forEach((c) => { byCategory[c] = all.filter((cl) => cl.category === c).length; });
      setStats({
        total: all.length,
        active: all.filter((c) => c.isActive).length,
        inactive: all.filter((c) => !c.isActive).length,
        byCategory,
      });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchClues(); }, [fetchClues]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const createClue = async (form) => {
    const res = await fetch(`${API}/clues`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Clue created!');
    setActiveTab('clues');
    fetchClues();
  };

  const updateClue = async (id, form) => {
    const res = await fetch(`${API}/clues/${id}`, {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Clue updated!');
    setEditingId(null);
    fetchClues();
  };

  const toggleClue = async (id) => {
    const res = await fetch(`${API}/clues/${id}/toggle`, {
      method: 'PATCH',
      headers: authHeaders,
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error, 'error');
    showToast(`Clue ${data.clue.isActive ? 'enabled' : 'disabled'}`);
    fetchClues();
  };

  const deleteClue = async (id, template) => {
    if (!window.confirm(`Delete clue?\n"${template.slice(0, 60)}…"`)) return;
    const res = await fetch(`${API}/clues/${id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (!res.ok) return showToast('Delete failed', 'error');
    showToast('Clue deleted');
    fetchClues();
  };

  const editingClue = editingId ? clues.find((c) => c._id === editingId) : null;

  if (!player?.isAdmin) return null;

  return (
    <div className="min-h-screen bg-void-900 text-white">
      {/* Grid bg */}
      <div className="fixed inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,255,136,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-lg border backdrop-blur-sm font-body text-sm shadow-xl ${
              toast.type === 'error'
                ? 'bg-red-900/80 border-red-600/50 text-red-200'
                : 'bg-green-900/80 border-green-600/50 text-green-200'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link to="/lobby" className="font-mono text-xs text-green-500/60 hover:text-green-400">
                ← LOBBY
              </Link>
              <span className="font-mono text-xs text-gray-700">/</span>
              <span className="font-mono text-xs text-gray-600">ADMIN</span>
            </div>
            <h1 className="font-display text-5xl tracking-wider neon-text">ADMIN PANEL</h1>
            <p className="font-mono text-xs text-gray-600 mt-1">
              Signed in as <span className="text-green-500">{player?.username}</span>
              <span className="ml-2 px-1.5 py-0.5 bg-yellow-900/40 border border-yellow-700/50 rounded text-yellow-400 text-[10px]">
                ADMIN
              </span>
            </p>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-3 mb-8">
          <div className="glass-card p-3 text-center col-span-1">
            <div className="font-display text-2xl neon-text">{stats.total}</div>
            <div className="font-mono text-[10px] text-gray-600">TOTAL</div>
          </div>
          <div className="glass-card p-3 text-center col-span-1">
            <div className="font-display text-2xl text-green-400">{stats.active}</div>
            <div className="font-mono text-[10px] text-gray-600">ACTIVE</div>
          </div>
          <div className="glass-card p-3 text-center col-span-1">
            <div className="font-display text-2xl text-red-400">{stats.inactive}</div>
            <div className="font-mono text-[10px] text-gray-600">INACTIVE</div>
          </div>
          {CATEGORIES.map((cat) => (
            <div key={cat} className="glass-card p-3 text-center col-span-1">
              <div className={`font-display text-xl ${CATEGORY_COLORS[cat]?.split(' ')[0] || 'text-gray-400'}`}>
                {stats.byCategory[cat] || 0}
              </div>
              <div className="font-mono text-[10px] text-gray-600 truncate">{cat.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-6 bg-void-800 p-1 rounded-lg w-fit">
          {[
            { id: 'clues', label: `CLUES (${clues.length})` },
            { id: 'create', label: '+ CREATE' },
            { id: 'bulk', label: '⬆ BULK IMPORT' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); setEditingId(null); }}
              className={`font-display tracking-wider px-5 py-2 rounded text-sm transition-all ${
                activeTab === t.id
                  ? 'bg-green-800/50 text-green-300 border border-green-700/50'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ─── CLUES TAB ────────────────────────────────────────────────── */}
          {activeTab === 'clues' && (
            <motion.div key="clues" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* Filters */}
              <div className="glass-card p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">Search</label>
                  <input
                    value={filters.search}
                    onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                    placeholder="Search templates…"
                    className="input-field text-sm py-1.5"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">Category</label>
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
                    className="input-field text-sm py-1.5"
                  >
                    <option value="">All</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">Difficulty</label>
                  <select
                    value={filters.difficulty}
                    onChange={(e) => setFilters((f) => ({ ...f, difficulty: e.target.value }))}
                    className="input-field text-sm py-1.5"
                  >
                    <option value="">All</option>
                    {DIFFICULTIES.map((d) => <option key={d} value={d}>{'★'.repeat(d)}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.includeInactive}
                      onChange={(e) => setFilters((f) => ({ ...f, includeInactive: e.target.checked }))}
                      className="accent-green-500 w-4 h-4"
                    />
                    <span className="font-mono text-xs text-gray-500">Show inactive</span>
                  </label>
                  <button
                    onClick={() => setFilters({ category: '', difficulty: '', search: '', includeInactive: true })}
                    className="font-mono text-xs text-gray-600 hover:text-gray-400"
                  >
                    RESET
                  </button>
                </div>
              </div>

              {/* Loading */}
              {loading && (
                <div className="flex justify-center py-16">
                  <div className="w-8 h-8 border-2 border-green-500/40 border-t-green-500 rounded-full animate-spin" />
                </div>
              )}

              {/* Clue list */}
              {!loading && (
                <div className="space-y-2">
                  {clues.length === 0 && (
                    <div className="glass-card p-12 text-center">
                      <div className="text-4xl mb-3">🔍</div>
                      <p className="font-body text-gray-500">No clues match your filters</p>
                    </div>
                  )}

                  {clues.map((clue) => (
                    <motion.div
                      key={clue._id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`glass-card overflow-hidden transition-all ${
                        !clue.isActive ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Collapsed row */}
                      {editingId !== clue._id && (
                        <div className="p-4 flex items-start gap-4">
                          {/* Left: badges */}
                          <div className="flex flex-col gap-1.5 flex-shrink-0 w-28">
                            <Badge category={clue.category} />
                            <DifficultyDots level={clue.difficulty} />
                            <span className={`text-[10px] font-mono px-1 py-0.5 rounded w-fit ${
                              clue.isActive ? 'text-green-500 bg-green-900/30' : 'text-red-500 bg-red-900/30'
                            }`}>
                              {clue.isActive ? '● ACTIVE' : '○ OFF'}
                            </span>
                          </div>

                          {/* Middle: content */}
                          <div className="flex-1 min-w-0">
                            <p className="font-body text-sm text-white leading-relaxed mb-1">
                              {clue.template}
                            </p>
                            <p className="font-mono text-xs text-gray-600">
                              Rule: <span className="text-gray-500">{clue.answerRule}</span>
                            </p>
                            {clue.flavorText && (
                              <p className="font-body text-xs text-gray-700 italic mt-0.5">{clue.flavorText}</p>
                            )}
                            {clue.variables?.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {clue.variables.map((v, i) => (
                                  <span key={i} className="font-mono text-[10px] text-cyan-500/70 border border-cyan-900 px-1 rounded">
                                    {'{' + v.name + '}'} {v.type}
                                    {v.type === 'number' ? ` [${v.min}-${v.max}]` : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Right: actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => setEditingId(clue._id)}
                              className="font-mono text-xs text-gray-500 hover:text-white border border-white/10 hover:border-white/30 px-2 py-1 rounded transition-colors"
                            >
                              EDIT
                            </button>
                            <button
                              onClick={() => toggleClue(clue._id)}
                              className={`font-mono text-xs px-2 py-1 rounded border transition-colors ${
                                clue.isActive
                                  ? 'text-red-400/70 border-red-900/50 hover:text-red-400 hover:border-red-700'
                                  : 'text-green-400/70 border-green-900/50 hover:text-green-400 hover:border-green-700'
                              }`}
                            >
                              {clue.isActive ? 'DISABLE' : 'ENABLE'}
                            </button>
                            <button
                              onClick={() => deleteClue(clue._id, clue.template)}
                              className="font-mono text-xs text-red-600/50 hover:text-red-400 border border-transparent hover:border-red-900 px-2 py-1 rounded transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Expanded edit form */}
                      {editingId === clue._id && (
                        <div className="p-5 border-t border-green-700/20">
                          <h3 className="font-display text-lg tracking-wider text-green-400 mb-4">EDIT CLUE</h3>
                          <ClueForm
                            initial={clue}
                            onSubmit={(form) => updateClue(clue._id, form)}
                            onCancel={() => setEditingId(null)}
                            submitLabel="UPDATE CLUE"
                          />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ─── CREATE TAB ───────────────────────────────────────────────── */}
          {activeTab === 'create' && (
            <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="glass-card p-6 max-w-2xl">
                <h2 className="font-display text-2xl tracking-wider text-white mb-6">CREATE NEW CLUE</h2>
                <ClueForm onSubmit={createClue} submitLabel="CREATE CLUE" />
              </div>
            </motion.div>
          )}

          {/* ─── BULK IMPORT TAB ──────────────────────────────────────────── */}
          {activeTab === 'bulk' && (
            <motion.div key="bulk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="glass-card p-6 max-w-2xl">
                <h2 className="font-display text-2xl tracking-wider text-white mb-2">BULK IMPORT</h2>
                <p className="font-body text-sm text-gray-500 mb-6">
                  Paste a JSON object containing a <code className="font-mono text-green-400 text-xs bg-green-900/20 px-1 rounded">clues</code> array.
                  Each clue must have <code className="font-mono text-xs bg-white/5 px-1 rounded">category</code>,{' '}
                  <code className="font-mono text-xs bg-white/5 px-1 rounded">template</code>, and{' '}
                  <code className="font-mono text-xs bg-white/5 px-1 rounded">answerRule</code>.
                </p>
                <BulkImport token={token} onSuccess={fetchClues} />
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
