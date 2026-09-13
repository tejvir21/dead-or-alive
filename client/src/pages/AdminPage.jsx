/**
 * AdminPage.jsx — Complete, self-contained (Phase 3)
 * Tabs: Dashboard | Clues | Players | Settings | Beta Requests | Audit Log
 *
 * Everything is inline in this ONE file — no separate component imports
 * needed for Settings sub-sections or Beta Requests. This fixes the earlier
 * issue where the Beta Requests tab wasn't visible because it required
 * manual wiring into a file that wasn't actually updated.
 */
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { apiJSON } from "../api/apiClient";

const ALL_CATEGORIES = [
  "number",
  "word",
  "symbol",
  "environment",
  "logic",
  "pattern",
  "sound",
  "math",
  "binary",
  "cipher",
  "spatial",
  "time",
  "color",
  "riddle",
];
const EMPTY_CLUE = {
  category: "number",
  template: "",
  answerRule: "",
  flavorText: "",
  difficulty: 1,
  hints: [],
  variables: [],
};
const PAGE = 50;

function StatCard({ label, value, color = "text-green-400", loading }) {
  return (
    <div className="glass-card p-4 text-center">
      <p className={`font-display text-2xl font-bold ${color}`}>
        {loading ? "—" : (value ?? 0)}
      </p>
      <p className="font-mono text-[10px] text-gray-600 uppercase tracking-widest mt-1">
        {label}
      </p>
    </div>
  );
}

function Toggle({ label, value, onChange, hint }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`flex items-center justify-between px-3 py-2.5 rounded border text-left transition-colors w-full ${value ? "border-green-800 bg-green-950/20" : "border-gray-800 bg-gray-900/50"}`}
    >
      <div className="min-w-0 pr-2">
        <span className="font-mono text-xs text-gray-300 block">{label}</span>
        {hint && (
          <span className="font-mono text-[10px] text-gray-600 block mt-0.5">
            {hint}
          </span>
        )}
      </div>
      <span
        className={`font-mono text-[10px] font-bold flex-shrink-0 ${value ? "text-green-400" : "text-gray-600"}`}
      >
        {value ? "ON" : "OFF"}
      </span>
    </button>
  );
}

function NumberField({ label, value, onChange, min, max }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div>
      <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="number"
          value={local}
          min={min}
          max={max}
          onChange={(e) => setLocal(e.target.value)}
          className="input-field text-sm flex-1 min-w-0"
        />
        <button
          onClick={() => onChange(parseInt(local))}
          className="font-mono text-xs border border-green-800 text-green-500 hover:bg-green-950/30 px-2.5 rounded flex-shrink-0"
        >
          ✓
        </button>
      </div>
    </div>
  );
}

function VariableEditor({ variables, onChange }) {
  const add = () =>
    onChange([
      ...variables,
      { name: "X", type: "number", min: 1, max: 10, options: [] },
    ]);
  const remove = (i) => onChange(variables.filter((_, j) => j !== i));
  const update = (i, f, v) => {
    const n = [...variables];
    n[i] = { ...n[i], [f]: v };
    onChange(n);
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="font-mono text-xs text-gray-500 uppercase tracking-wider">
          Variables ({variables.length})
        </label>
        {variables.length < 6 && (
          <button
            type="button"
            onClick={add}
            className="text-xs font-mono text-green-500 border border-green-800/50 px-2 py-0.5 rounded"
          >
            + ADD
          </button>
        )}
      </div>
      {variables.map((v, i) => (
        <div
          key={i}
          className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end"
        >
          <div>
            <span className="font-mono text-[10px] text-gray-600 block mb-1">
              NAME
            </span>
            <input
              value={v.name}
              onChange={(e) => update(i, "name", e.target.value.toUpperCase())}
              maxLength={4}
              className="input-field text-sm uppercase w-full"
            />
          </div>
          <div>
            <span className="font-mono text-[10px] text-gray-600 block mb-1">
              TYPE
            </span>
            <select
              value={v.type}
              onChange={(e) => update(i, "type", e.target.value)}
              className="input-field text-sm w-full"
            >
              <option value="number">number</option>
              <option value="letter">letter</option>
              <option value="choice">choice</option>
              <option value="symbol">symbol</option>
            </select>
          </div>
          {v.type === "number" && (
            <>
              <div>
                <span className="font-mono text-[10px] text-gray-600 block mb-1">
                  MIN
                </span>
                <input
                  type="number"
                  value={v.min}
                  onChange={(e) =>
                    update(i, "min", parseInt(e.target.value) || 0)
                  }
                  className="input-field text-sm w-full"
                />
              </div>
              <div>
                <span className="font-mono text-[10px] text-gray-600 block mb-1">
                  MAX
                </span>
                <input
                  type="number"
                  value={v.max}
                  onChange={(e) =>
                    update(i, "max", parseInt(e.target.value) || 10)
                  }
                  className="input-field text-sm w-full"
                />
              </div>
            </>
          )}
          {v.type === "choice" && (
            <div className="col-span-2">
              <span className="font-mono text-[10px] text-gray-600 block mb-1">
                OPTIONS
              </span>
              <input
                value={(v.options || []).join(",")}
                onChange={(e) =>
                  update(
                    i,
                    "options",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                className="input-field text-sm w-full"
                placeholder="A,B,C"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => remove(i)}
            className="font-mono text-xs text-red-500/60 hover:text-red-400 px-2 py-1.5"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

function ClueForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || EMPTY_CLUE);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
            Category
          </label>
          <select
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className="input-field w-full"
          >
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
            Difficulty (1-10)
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={form.difficulty}
            onChange={(e) => set("difficulty", parseInt(e.target.value))}
            className="w-full accent-green-500 mt-2"
          />
          <span className="font-mono text-xs text-gray-500">
            {form.difficulty}/10
          </span>
        </div>
      </div>
      <div>
        <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
          Template
        </label>
        <textarea
          value={form.template}
          onChange={(e) => set("template", e.target.value)}
          rows={3}
          placeholder="Only even numbers survive. The code is {X}."
          className="input-field w-full font-mono text-sm"
        />
      </div>
      <div>
        <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
          Answer Rule
        </label>
        <input
          value={form.answerRule}
          onChange={(e) => set("answerRule", e.target.value)}
          placeholder="even:{X}"
          className="input-field w-full font-mono"
        />
      </div>
      <div>
        <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
          Flavor Text
        </label>
        <input
          value={form.flavorText}
          onChange={(e) => set("flavorText", e.target.value)}
          className="input-field w-full"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-mono text-xs text-gray-500 uppercase tracking-wider">
            Hints
          </label>
          {(form.hints || []).length < 2 && form.difficulty <= 6 && (
            <button
              type="button"
              onClick={() => set("hints", [...(form.hints || []), ""])}
              className="text-xs font-mono text-green-500 border border-green-800/50 px-2 py-0.5 rounded"
            >
              + ADD HINT
            </button>
          )}
        </div>
        {(form.hints || []).map((h, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={h}
              onChange={(e) => {
                const n = [...(form.hints || [])];
                n[i] = e.target.value;
                set("hints", n);
              }}
              placeholder={i === 0 ? "Hint 1 (vague)" : "Hint 2 (stronger)"}
              className="input-field flex-1 text-sm"
            />
            <button
              type="button"
              onClick={() =>
                set(
                  "hints",
                  (form.hints || []).filter((_, j) => j !== i),
                )
              }
              className="text-xs text-red-500/60 hover:text-red-400 px-2"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <VariableEditor
        variables={form.variables || []}
        onChange={(v) => set("variables", v)}
      />
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={saving || !form.template || !form.answerRule}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          {saving ? "SAVING…" : initial?._id ? "SAVE CHANGES" : "CREATE CLUE"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary px-6">
          CANCEL
        </button>
      </div>
    </div>
  );
}

function BulkImport({ onDone }) {
  const [json, setJson] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handle = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await apiJSON("/clues/bulk", {
        method: "POST",
        body: JSON.stringify(JSON.parse(json)),
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
        Paste JSON with a <code className="text-green-400">clues</code> array.
        Duplicates skipped automatically.
      </p>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={12}
        placeholder='{"clues":[...]}'
        className="input-field w-full font-mono text-xs"
      />
      {error && <p className="font-mono text-xs text-red-400">⚠ {error}</p>}
      {result && (
        <div className="font-mono text-xs space-y-1">
          <p className="text-green-400">✅ {result.inserted} clues added</p>
          {result.skipped > 0 && (
            <p className="text-yellow-500">
              ⏭ {result.skipped} duplicates skipped
            </p>
          )}
        </div>
      )}
      <button
        onClick={handle}
        disabled={!json.trim() || loading}
        className="btn-primary w-full disabled:opacity-50"
      >
        {loading ? "IMPORTING…" : "⬆ IMPORT CLUES"}
      </button>
    </div>
  );
}

function GiftModal({ player, onClose, onDone }) {
  const [plan, setPlan] = useState("pro");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handle = async () => {
    setLoading(true);
    setError("");
    try {
      await apiJSON(`/admin/players/${player._id}/subscription`, {
        method: "POST",
        body: JSON.stringify({ plan, durationDays: parseInt(days) }),
      });
      onDone?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 glass-card p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-white">
            Gift Subscription
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-400 text-xl"
          >
            ×
          </button>
        </div>
        <p className="font-mono text-xs text-gray-500">
          To: <span className="text-green-400">{player.username}</span>
        </p>
        {error && <p className="font-mono text-xs text-red-400">⚠ {error}</p>}
        <div>
          <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
            Plan
          </label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="input-field w-full"
          >
            <option value="pro">Pro</option>
            <option value="elite">Elite</option>
          </select>
        </div>
        <div>
          <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
            Duration
          </label>
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="input-field w-full"
          >
            {[7, 14, 30, 60, 90, 180, 365].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handle}
          disabled={loading}
          className="btn-primary w-full disabled:opacity-50"
        >
          {loading ? "GIFTING…" : "🎁 GIFT SUBSCRIPTION"}
        </button>
      </div>
    </div>
  );
}

function BanModal({ player, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handle = async () => {
    if (!reason.trim()) {
      setError("Ban reason is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiJSON(`/admin/players/${player._id}/ban`, {
        method: "POST",
        body: JSON.stringify({
          reason,
          durationDays: days ? parseInt(days) : undefined,
        }),
      });
      onDone?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 glass-card p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-red-400">
            Ban Player
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-400 text-xl"
          >
            ×
          </button>
        </div>
        <p className="font-mono text-xs text-gray-500">
          Banning: <span className="text-red-400">{player.username}</span>
        </p>
        {error && <p className="font-mono text-xs text-red-400">⚠ {error}</p>}
        <div>
          <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
            Reason *
          </label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for ban"
            className="input-field w-full"
          />
        </div>
        <div>
          <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
            Duration (empty = permanent)
          </label>
          <input
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="Leave empty for permanent"
            min={1}
            className="input-field w-full"
          />
        </div>
        <button
          onClick={handle}
          disabled={loading}
          className="bg-red-900/50 hover:bg-red-800/50 border border-red-700 text-red-300 font-mono text-sm px-4 py-2 rounded w-full disabled:opacity-50"
        >
          {loading ? "BANNING…" : "🚫 BAN PLAYER"}
        </button>
      </div>
    </div>
  );
}

function SettingsTab() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [section, setSection] = useState("general");

  const [editCurve, setEditCurve] = useState(null);
  const [showAddCurve, setShowAddCurve] = useState(false);
  const [newCurve, setNewCurve] = useState({
    name: "",
    label: "",
    levels: "1,2,3,4,5,6,7,8,9,10",
    availableTo: "all",
  });

  const [editPlan, setEditPlan] = useState(null);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({
    name: "",
    label: "",
    price: "",
    durationDays: "30",
    maxPlayersBonus: "0",
    features: "",
  });

  useEffect(() => {
    load();
  }, []);
  const load = async () => {
    setLoading(true);
    try {
      const d = await apiJSON("/settings");
      setSettings(d.settings || d);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };
  const showMsg = (m, isErr = false) => {
    if (isErr) setError(m);
    else setMsg(m);
    setTimeout(() => {
      setMsg("");
      setError("");
    }, 3000);
  };

  const saveGeneral = async (updates) => {
    try {
      await apiJSON("/settings/general", {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      await load();
      showMsg("✅ Saved");
    } catch (err) {
      showMsg(err.message, true);
    }
  };
  const saveFeature = async (key, val) => {
    try {
      await apiJSON("/settings/features", {
        method: "PATCH",
        body: JSON.stringify({ [key]: val }),
      });
      await load();
      showMsg(`✅ ${key} ${val ? "enabled" : "disabled"}`);
    } catch (err) {
      showMsg(err.message, true);
    }
  };
  const saveDailyLimit = async (tier, field, value) => {
    try {
      await apiJSON("/settings/daily-limits", {
        method: "PATCH",
        body: JSON.stringify({ tier, [field]: value }),
      });
      await load();
      showMsg(`✅ ${tier} ${field} limit updated`);
    } catch (err) {
      showMsg(err.message, true);
    }
  };
  const saveAutoStart = async (updates) => {
    try {
      await apiJSON("/settings/auto-start", {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      await load();
      showMsg("✅ Auto-start updated");
    } catch (err) {
      showMsg(err.message, true);
    }
  };
  const saveKickSystem = async (updates) => {
    try {
      await apiJSON("/settings/kick-system", {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      await load();
      showMsg("✅ Kick system updated");
    } catch (err) {
      showMsg(err.message, true);
    }
  };
  const saveBetaAccess = async (updates) => {
    try {
      await apiJSON("/settings/beta-access", {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      await load();
      showMsg("✅ Beta access updated");
    } catch (err) {
      showMsg(err.message, true);
    }
  };
  const saveCurve = async (name, updates) => {
    try {
      await apiJSON(`/settings/curves/${name}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      await load();
      showMsg("✅ Curve updated");
      setEditCurve(null);
    } catch (err) {
      showMsg(err.message, true);
    }
  };
  const addCurve = async () => {
    try {
      const levels = newCurve.levels
        .split(",")
        .map((n) => parseInt(n.trim()))
        .filter((n) => !isNaN(n));
      if (!newCurve.name || levels.length === 0) {
        showMsg("Name and levels required", true);
        return;
      }
      await apiJSON("/settings/curves", {
        method: "POST",
        body: JSON.stringify({ ...newCurve, levels }),
      });
      await load();
      showMsg("✅ Curve added");
      setShowAddCurve(false);
      setNewCurve({
        name: "",
        label: "",
        levels: "1,2,3,4,5,6,7,8,9,10",
        availableTo: "all",
      });
    } catch (err) {
      showMsg(err.message, true);
    }
  };

  const savePlan = async (name, updates) => {
    try {
      await apiJSON(`/settings/plans/${name}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      await load();
      showMsg("✅ Plan updated");
      setEditPlan(null);
    } catch (err) {
      showMsg(err.message, true);
    }
  };
  const addPlan = async () => {
    try {
      const price = parseFloat(newPlan.price);
      const durationDays = parseInt(newPlan.durationDays);
      if (!newPlan.name.trim()) {
        showMsg("Plan name (id) is required", true);
        return;
      }
      if (!/^[a-z0-9_]+$/.test(newPlan.name.trim())) {
        showMsg(
          "Plan name must be lowercase letters/numbers/underscores only",
          true,
        );
        return;
      }
      if (!price || price <= 0) {
        showMsg("Price must be a positive number", true);
        return;
      }
      if (!durationDays || durationDays <= 0) {
        showMsg("Duration (days) must be a positive number", true);
        return;
      }
      const features = newPlan.features
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await apiJSON("/settings/plans", {
        method: "POST",
        body: JSON.stringify({
          name: newPlan.name.trim(),
          label: newPlan.label.trim() || newPlan.name.trim(),
          price,
          currency: "INR",
          durationDays,
          maxPlayersBonus: parseInt(newPlan.maxPlayersBonus) || 0,
          features,
        }),
      });
      await load();
      showMsg("✅ Plan created");
      setShowAddPlan(false);
      setNewPlan({
        name: "",
        label: "",
        price: "",
        durationDays: "30",
        maxPlayersBonus: "0",
        features: "",
      });
    } catch (err) {
      showMsg(err.message, true);
    }
  };
  const deletePlan = async (name) => {
    if (
      !window.confirm(
        `Delete plan "${name}"? Existing subscribers keep it until expiry, but nobody can purchase it again.`,
      )
    )
      return;
    try {
      const d = await apiJSON(`/settings/plans/${name}`, { method: "DELETE" });
      await load();
      showMsg(d.warning ? `⚠ Plan deleted — ${d.warning}` : "✅ Plan deleted");
    } catch (err) {
      showMsg(err.message, true);
    }
  };

  if (loading)
    return (
      <p className="font-mono text-xs text-gray-700 text-center py-12">
        Loading settings…
      </p>
    );
  if (!settings)
    return (
      <p className="font-mono text-xs text-red-500 text-center py-12">
        Failed to load settings
      </p>
    );

  const dl = settings.dailyLimits || {};
  const at = settings.autoStartTimer || {};
  const ks = settings.kickSystem || {};
  const ba = settings.betaAccess || {};
  const features = settings.features || {};
  const curves = settings.difficultyCurves || [];

  const sections = [
    { id: "general", label: "Timers & Limits" },
    { id: "features", label: "Feature Flags" },
    { id: "limits", label: "Daily Limits" },
    { id: "autostart", label: "Auto-Start" },
    { id: "kick", label: "Kick System" },
    { id: "beta", label: "Beta Access" },
    { id: "curves", label: "Difficulty Curves" },
    { id: "plans", label: "Subscription Plans" },
    { id: "clanBattles", label: "Clan Battles" },
  ];

  return (
    <div className="space-y-4">
      {msg && (
        <p className="font-mono text-sm text-green-400 bg-green-950/30 border border-green-800 px-4 py-2 rounded">
          {msg}
        </p>
      )}
      {error && (
        <p className="font-mono text-sm text-red-400 bg-red-950/30 border border-red-800 px-4 py-2 rounded">
          ⚠ {error}
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`font-mono text-xs px-3 py-1.5 rounded border transition-colors ${section === s.id ? "bg-blue-900/30 border-blue-700 text-blue-400" : "border-gray-800 text-gray-600 hover:text-gray-400"}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "general" && (
        <div className="glass-card p-4 sm:p-5 space-y-4">
          <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">
            ⏱ Timers & Player Limits
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              [
                "Puzzle Timer (sec)",
                "puzzleTimerSeconds",
                settings.puzzleTimerSeconds,
              ],
              [
                "Door Timer (sec)",
                "doorTimerSeconds",
                settings.doorTimerSeconds,
              ],
              [
                "Countdown (sec)",
                "countdownSeconds",
                settings.countdownSeconds,
              ],
              [
                "Max Players (normal)",
                "maxPlayersNormal",
                settings.maxPlayersNormal,
              ],
              [
                "Max Players (verified+)",
                "maxPlayersVerified",
                settings.maxPlayersVerified,
              ],
              [
                "Min Players to Start",
                "minPlayersToStart",
                settings.minPlayersToStart,
              ],
              [
                "Reconnect Grace (normal)",
                "reconnectGraceNormal",
                settings.reconnectGraceNormal,
              ],
              [
                "Reconnect Grace (verified)",
                "reconnectGraceVerified",
                settings.reconnectGraceVerified,
              ],
            ].map(([label, key, val]) => (
              <NumberField
                key={key}
                label={label}
                value={val}
                min={1}
                onChange={(v) => saveGeneral({ [key]: v })}
              />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-800">
            <NumberField
              label="Timer Reduction Factor ×100 (e.g. 30 = 0.3)"
              value={Math.round((settings.timerReductionFactor || 0.3) * 100)}
              min={0}
              max={100}
              onChange={(v) => saveGeneral({ timerReductionFactor: v / 100 })}
            />
            <Toggle
              label="Timer Reduction Enabled"
              value={settings.timerReductionEnabled}
              onChange={(v) => saveGeneral({ timerReductionEnabled: v })}
              hint="Shrinks timer when players pick correctly early"
            />
          </div>
        </div>
      )}

      {section === "features" && (
        <div className="glass-card p-4 sm:p-5 space-y-3">
          <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">
            🚩 Feature Flags
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(features).map(([key, val]) => (
              <Toggle
                key={key}
                label={key
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (c) => c.toUpperCase())}
                value={val}
                onChange={(v) => saveFeature(key, v)}
              />
            ))}
          </div>
        </div>
      )}

      {section === "limits" && (
        <div className="glass-card p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">
              📅 Daily Room Limits
            </h2>
            <p className="font-mono text-[10px] text-gray-700 mt-1">
              💡 Set -1 for unlimited. Resets 24h after each player's first
              action that day (rolling window).
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {["free", "verified", "pro", "elite"].map((tier) => (
              <div key={tier} className="border border-gray-800 rounded-lg p-3">
                <p className="font-mono text-xs text-white uppercase mb-2 flex items-center gap-2">
                  {tier}
                  {tier === "elite" && (
                    <span className="font-mono text-[9px] text-yellow-500 border border-yellow-800 px-1 rounded">
                      suggest -1
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="Create/day"
                    value={dl[tier]?.create ?? 0}
                    min={-1}
                    onChange={(v) => saveDailyLimit(tier, "create", v)}
                  />
                  <NumberField
                    label="Join/day"
                    value={dl[tier]?.join ?? 0}
                    min={-1}
                    onChange={(v) => saveDailyLimit(tier, "join", v)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === "autostart" && (
        <div className="glass-card p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">
              ⏱ Auto-Start Timer
            </h2>
            <p className="font-mono text-[10px] text-gray-700 mt-1">
              💡 When the timer expires: ready players start automatically,
              not-ready players are removed. If ready count is below Min
              Players, the room is cancelled instead.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Toggle
              label="Auto-start enabled"
              value={at.enabled}
              onChange={(v) => saveAutoStart({ enabled: v })}
              hint="Master switch"
            />
            <NumberField
              label="Default duration (sec)"
              value={at.defaultDuration || 180}
              min={10}
              max={1800}
              onChange={(v) => saveAutoStart({ defaultDuration: v })}
            />
          </div>
          <p className="font-mono text-[10px] text-gray-600 uppercase pt-2 border-t border-gray-800">
            Per-tier adjustable range (room creator can choose within this)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {["free", "verified", "pro", "elite"].map((tier) => (
              <div key={tier} className="border border-gray-800 rounded-lg p-3">
                <p className="font-mono text-xs text-white uppercase mb-2">
                  {tier}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="Min (sec)"
                    value={at.tierLimits?.[tier]?.min || 0}
                    min={10}
                    onChange={(v) =>
                      saveAutoStart({ tierLimits: { [tier]: { min: v } } })
                    }
                  />
                  <NumberField
                    label="Max (sec)"
                    value={at.tierLimits?.[tier]?.max || 0}
                    min={10}
                    onChange={(v) =>
                      saveAutoStart({ tierLimits: { [tier]: { max: v } } })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === "kick" && (
        <div className="glass-card p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">
              🚫 Kick System
            </h2>
            <p className="font-mono text-[10px] text-gray-700 mt-1">
              💡 Waiting room: host-only (or direct kick if below min players).
              In-game: any player can start a vote.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Toggle
              label="Kick system enabled"
              value={ks.enabled}
              onChange={(v) => saveKickSystem({ enabled: v })}
            />
            <Toggle
              label="Host can kick unilaterally"
              value={ks.creatorCanKick}
              onChange={(v) => saveKickSystem({ creatorCanKick: v })}
              hint="Waiting room, below min-players threshold"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <NumberField
              label="Min players to vote"
              value={ks.minimumPlayers || 3}
              min={2}
              max={20}
              onChange={(v) => saveKickSystem({ minimumPlayers: v })}
            />
            <NumberField
              label="Threshold %"
              value={ks.thresholdPercent || 50}
              min={1}
              max={100}
              onChange={(v) => saveKickSystem({ thresholdPercent: v })}
            />
            <NumberField
              label="Vote timeout (sec)"
              value={ks.voteTimeoutSeconds || 30}
              min={5}
              max={300}
              onChange={(v) => saveKickSystem({ voteTimeoutSeconds: v })}
            />
          </div>
          <p className="font-mono text-[10px] text-gray-700 bg-gray-900/50 border border-gray-800 rounded p-2">
            💡 Threshold 50% = &gt;50% of <em>other</em> players (excluding the
            target) must vote yes.
          </p>
        </div>
      )}

      {section === "beta" && (
        <div className="glass-card p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">
              🧪 Beta Access
            </h2>
            <p className="font-mono text-[10px] text-gray-700 mt-1">
              💡 Controls who can access the separate beta-version frontend URL.
              Use the "Beta Requests" tab to approve individual requests or
              grant access directly to any player.
            </p>
          </div>
          <Toggle
            label="Beta gating enabled"
            value={ba.enabled}
            onChange={(v) => saveBetaAccess({ enabled: v })}
            hint="If off, everyone can access the beta URL freely"
          />
          <div>
            <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
              Beta URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                defaultValue={ba.betaUrl}
                id="beta-url-input"
                placeholder="https://beta.dead-or-alive.io"
                className="input-field text-sm flex-1 min-w-0"
              />
              <button
                onClick={() =>
                  saveBetaAccess({
                    betaUrl: document.getElementById("beta-url-input").value,
                  })
                }
                className="font-mono text-xs border border-green-800 text-green-500 hover:bg-green-950/30 px-2.5 rounded flex-shrink-0"
              >
                ✓
              </button>
            </div>
            <p className="font-mono text-[10px] text-gray-700 mt-1">
              Shown in profile page to approved beta testers.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Toggle
              label="Elite = automatic beta access"
              value={ba.allowElite}
              onChange={(v) => saveBetaAccess({ allowElite: v })}
            />
            <Toggle
              label="Pro can request beta access"
              value={ba.allowPro}
              onChange={(v) => saveBetaAccess({ allowPro: v })}
              hint="Requests appear in Beta Requests tab"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
              Locked screen message (non-beta users)
            </label>
            <textarea
              defaultValue={ba.lockedMessage}
              id="beta-msg-input"
              rows={2}
              className="input-field w-full text-sm resize-none"
            />
            <button
              onClick={() =>
                saveBetaAccess({
                  lockedMessage:
                    document.getElementById("beta-msg-input").value,
                })
              }
              className="font-mono text-xs border border-green-800 text-green-500 hover:bg-green-950/30 px-3 py-1 rounded mt-2"
            >
              Save Message
            </button>
          </div>
        </div>
      )}

      {section === "curves" && (
        <div className="glass-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">
              📈 Difficulty Curves
            </h2>
            <button
              onClick={() => setShowAddCurve((s) => !s)}
              className="font-mono text-xs text-green-500 border border-green-800 px-3 py-1 rounded hover:bg-green-950/30"
            >
              + ADD CURVE
            </button>
          </div>

          {showAddCurve && (
            <div className="border border-green-900/50 rounded-lg p-4 space-y-3 bg-green-950/10">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
                    Name (id)
                  </label>
                  <input
                    value={newCurve.name}
                    onChange={(e) =>
                      setNewCurve((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="my_curve"
                    className="input-field text-sm w-full"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
                    Label
                  </label>
                  <input
                    value={newCurve.label}
                    onChange={(e) =>
                      setNewCurve((f) => ({ ...f, label: e.target.value }))
                    }
                    placeholder="My Curve"
                    className="input-field text-sm w-full"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
                    Available To
                  </label>
                  <select
                    value={newCurve.availableTo}
                    onChange={(e) =>
                      setNewCurve((f) => ({
                        ...f,
                        availableTo: e.target.value,
                      }))
                    }
                    className="input-field text-sm w-full"
                  >
                    <option value="all">All players</option>
                    <option value="verified">Verified only</option>
                    <option value="admin">Admin only</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
                  Levels (comma-separated 1-10)
                </label>
                <input
                  value={newCurve.levels}
                  onChange={(e) =>
                    setNewCurve((f) => ({ ...f, levels: e.target.value }))
                  }
                  className="input-field w-full font-mono text-sm"
                />
                <p className="font-mono text-[10px] text-gray-700 mt-1">
                  💡 10 values = full game. Fewer values = shorter game.
                </p>
              </div>
              <button onClick={addCurve} className="btn-primary w-full">
                ADD CURVE
              </button>
            </div>
          )}

          <div className="space-y-3">
            {curves.map((curve) => (
              <div
                key={curve.name}
                className={`border rounded-lg p-4 ${curve.isDefault ? "border-green-700 bg-green-950/10" : "border-gray-800"}`}
              >
                {editCurve === curve.name ? (
                  <EditCurveForm
                    curve={curve}
                    onSave={(u) => saveCurve(curve.name, u)}
                    onCancel={() => setEditCurve(null)}
                  />
                ) : (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm text-white font-bold">
                          {curve.label || curve.name}
                        </span>
                        {curve.isDefault && (
                          <span className="font-mono text-[10px] text-green-400 border border-green-700 px-1.5 rounded">
                            DEFAULT
                          </span>
                        )}
                        <span
                          className={`font-mono text-[10px] border px-1.5 rounded ${curve.availableTo === "all" ? "text-blue-400 border-blue-800" : curve.availableTo === "verified" ? "text-yellow-400 border-yellow-800" : "text-gray-500 border-gray-700"}`}
                        >
                          {curve.availableTo}
                        </span>
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {(curve.levels || []).map((lvl, i) => (
                          <div
                            key={i}
                            className="flex flex-col items-center gap-0.5"
                          >
                            <div
                              style={{ height: `${lvl * 3}px` }}
                              className={`w-3 rounded-sm ${lvl <= 3 ? "bg-green-700" : lvl <= 6 ? "bg-yellow-700" : lvl <= 8 ? "bg-orange-700" : "bg-red-700"}`}
                            />
                            <span className="font-mono text-[8px] text-gray-700">
                              {lvl}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {!curve.isDefault && (
                        <button
                          onClick={() =>
                            saveCurve(curve.name, { isDefault: true })
                          }
                          className="font-mono text-xs border border-gray-700 text-gray-500 hover:text-green-400 hover:border-green-800 px-2 py-1 rounded"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        onClick={() => setEditCurve(curve.name)}
                        className="font-mono text-xs border border-gray-700 text-gray-400 hover:text-white px-2 py-1 rounded"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {section === "plans" && (
        <div className="glass-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">
                💳 Subscription Plans
              </h2>
              <p className="font-mono text-[10px] text-gray-700 mt-1">
                💡 These power the Pricing page and beta-locked screen purchase
                buttons. Prices are in ₹ (INR).
              </p>
            </div>
            <button
              onClick={() => setShowAddPlan((s) => !s)}
              className="font-mono text-xs text-green-500 border border-green-800 px-3 py-1 rounded hover:bg-green-950/30"
            >
              + ADD PLAN
            </button>
          </div>

          {showAddPlan && (
            <div className="border border-green-900/50 rounded-lg p-4 space-y-3 bg-green-950/10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
                    Name (id — lowercase, no spaces)
                  </label>
                  <input
                    value={newPlan.name}
                    onChange={(e) =>
                      setNewPlan((f) => ({
                        ...f,
                        name: e.target.value.toLowerCase(),
                      }))
                    }
                    placeholder="premium"
                    className="input-field text-sm w-full"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
                    Label (display name)
                  </label>
                  <input
                    value={newPlan.label}
                    onChange={(e) =>
                      setNewPlan((f) => ({ ...f, label: e.target.value }))
                    }
                    placeholder="Premium"
                    className="input-field text-sm w-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    value={newPlan.price}
                    onChange={(e) =>
                      setNewPlan((f) => ({ ...f, price: e.target.value }))
                    }
                    placeholder="299"
                    min="1"
                    className="input-field text-sm w-full"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
                    Duration (days)
                  </label>
                  <input
                    type="number"
                    value={newPlan.durationDays}
                    onChange={(e) =>
                      setNewPlan((f) => ({
                        ...f,
                        durationDays: e.target.value,
                      }))
                    }
                    placeholder="30"
                    min="1"
                    className="input-field text-sm w-full"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
                    Max Players Bonus
                  </label>
                  <input
                    type="number"
                    value={newPlan.maxPlayersBonus}
                    onChange={(e) =>
                      setNewPlan((f) => ({
                        ...f,
                        maxPlayersBonus: e.target.value,
                      }))
                    }
                    placeholder="0"
                    min="0"
                    className="input-field text-sm w-full"
                  />
                </div>
              </div>
              <div>
                <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
                  Features (comma-separated)
                </label>
                <input
                  value={newPlan.features}
                  onChange={(e) =>
                    setNewPlan((f) => ({ ...f, features: e.target.value }))
                  }
                  placeholder="Extended limits, Priority support, Custom badge"
                  className="input-field w-full text-sm"
                />
                <p className="font-mono text-[10px] text-gray-700 mt-1">
                  💡 Shown as a bullet list on the pricing card.
                </p>
              </div>
              <button onClick={addPlan} className="btn-primary w-full">
                CREATE PLAN
              </button>
            </div>
          )}

          <div className="space-y-3">
            {(settings.subscriptionPlans || []).length === 0 ? (
              <p className="font-mono text-xs text-gray-700 text-center py-6">
                No subscription plans configured yet — click + ADD PLAN above.
              </p>
            ) : (
              (settings.subscriptionPlans || []).map((plan) => (
                <div
                  key={plan.name}
                  className="border border-gray-800 rounded-lg p-4"
                >
                  {editPlan === plan.name ? (
                    <EditPlanForm
                      plan={plan}
                      onSave={(u) => savePlan(plan.name, u)}
                      onCancel={() => setEditPlan(null)}
                    />
                  ) : (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm text-white font-bold">
                            {plan.label || plan.name}
                          </span>
                          <span className="font-mono text-xs text-green-400">
                            ₹{plan.price}
                          </span>
                          <span className="font-mono text-[10px] text-gray-600">
                            / {plan.durationDays}d
                          </span>
                          {plan.maxPlayersBonus > 0 && (
                            <span className="font-mono text-[10px] text-blue-400 border border-blue-800 px-1.5 rounded">
                              +{plan.maxPlayersBonus} players
                            </span>
                          )}
                        </div>
                        {(plan.features || []).length > 0 && (
                          <p className="font-mono text-[10px] text-gray-600 mt-1.5 break-words">
                            {plan.features.join(" · ")}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => setEditPlan(plan.name)}
                          className="font-mono text-xs border border-gray-700 text-gray-400 hover:text-white px-2 py-1 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deletePlan(plan.name)}
                          className="font-mono text-xs border border-red-900 text-red-500 hover:bg-red-950/30 px-2 py-1 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {section === "clanBattles" && (
        <ClanBattleSettingsSection
          settings={settings}
          onSaved={load}
          showMsg={showMsg}
        />
      )}
    </div>
  );
}

function EditPlanForm({ plan, onSave, onCancel }) {
  const [label, setLabel] = useState(plan.label || "");
  const [price, setPrice] = useState(plan.price ?? "");
  const [durationDays, setDurationDays] = useState(plan.durationDays ?? "");
  const [maxPlayersBonus, setMaxPlayersBonus] = useState(
    plan.maxPlayersBonus ?? 0,
  );
  const [features, setFeatures] = useState((plan.features || []).join(", "));
  const [error, setError] = useState("");

  const handleSave = () => {
    const p = parseFloat(price),
      d = parseInt(durationDays);
    if (!p || p <= 0) {
      setError("Price must be a positive number");
      return;
    }
    if (!d || d <= 0) {
      setError("Duration (days) must be a positive number");
      return;
    }
    onSave({
      label: label.trim() || plan.name,
      price: p,
      durationDays: d,
      maxPlayersBonus: parseInt(maxPlayersBonus) || 0,
      features: features
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  };

  return (
    <div className="space-y-3">
      {error && <p className="font-mono text-xs text-red-400">⚠ {error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
            Label
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="input-field text-sm w-full"
          />
        </div>
        <div>
          <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
            Price (₹)
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            min="1"
            className="input-field text-sm w-full"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
            Duration (days)
          </label>
          <input
            type="number"
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            min="1"
            className="input-field text-sm w-full"
          />
        </div>
        <div>
          <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
            Max Players Bonus
          </label>
          <input
            type="number"
            value={maxPlayersBonus}
            onChange={(e) => setMaxPlayersBonus(e.target.value)}
            min="0"
            className="input-field text-sm w-full"
          />
        </div>
      </div>
      <div>
        <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
          Features (comma-separated)
        </label>
        <input
          value={features}
          onChange={(e) => setFeatures(e.target.value)}
          className="input-field w-full text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} className="btn-primary flex-1">
          SAVE
        </button>
        <button onClick={onCancel} className="btn-secondary px-4">
          CANCEL
        </button>
      </div>
    </div>
  );
}

function EditCurveForm({ curve, onSave, onCancel }) {
  const [label, setLabel] = useState(curve.label || "");
  const [desc, setDesc] = useState(curve.description || "");
  const [levels, setLevels] = useState((curve.levels || []).join(","));
  const [access, setAccess] = useState(curve.availableTo || "all");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
            Label
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="input-field text-sm w-full"
          />
        </div>
        <div>
          <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
            Available To
          </label>
          <select
            value={access}
            onChange={(e) => setAccess(e.target.value)}
            className="input-field text-sm w-full"
          >
            <option value="all">All players</option>
            <option value="verified">Verified only</option>
            <option value="admin">Admin only</option>
          </select>
        </div>
      </div>
      <div>
        <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
          Description
        </label>
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="input-field text-sm w-full"
        />
      </div>
      <div>
        <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
          Levels
        </label>
        <input
          value={levels}
          onChange={(e) => setLevels(e.target.value)}
          className="input-field w-full font-mono text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() =>
            onSave({
              label,
              description: desc,
              levels: levels
                .split(",")
                .map((n) => parseInt(n.trim()))
                .filter((n) => !isNaN(n)),
              availableTo: access,
            })
          }
          className="btn-primary flex-1"
        >
          SAVE
        </button>
        <button onClick={onCancel} className="btn-secondary px-4">
          CANCEL
        </button>
      </div>
    </div>
  );
}

function BetaRequestsSection() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    load();
  }, [filter]);
  const load = async () => {
    setLoading(true);
    try {
      const params = filter === "all" ? "" : `?status=${filter}`;
      const d = await apiJSON(`/settings/beta-requests${params}`);
      setRequests(d.requests || []);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };
  const showMsg = (m) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  const approve = async (req) => {
    try {
      await apiJSON(`/settings/beta-requests/${req._id}/approve`, {
        method: "POST",
      });
      await load();
      showMsg(`✅ Granted beta access to ${req.username}`);
    } catch (err) {
      showMsg(`❌ ${err.message}`);
    }
  };
  const reject = async (req) => {
    const note = window.prompt("Reason for rejection (optional):") || "";
    try {
      await apiJSON(`/settings/beta-requests/${req._id}/reject`, {
        method: "POST",
        body: JSON.stringify({ note }),
      });
      await load();
      showMsg(`Request from ${req.username} rejected`);
    } catch (err) {
      showMsg(`❌ ${err.message}`);
    }
  };
  const searchPlayers = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const d = await apiJSON(
        `/admin/players?search=${encodeURIComponent(searchQuery)}&limit=10`,
      );
      setSearchResults(d.players || []);
    } catch (_) {
    } finally {
      setSearching(false);
    }
  };
  const grantDirect = async (p) => {
    try {
      await apiJSON(`/settings/beta-access/grant/${p._id}`, { method: "POST" });
      showMsg(`✅ Beta access granted to ${p.username}`);
      setSearchResults((prev) =>
        prev.map((x) => (x._id === p._id ? { ...x, hasBetaAccess: true } : x)),
      );
    } catch (err) {
      showMsg(`❌ ${err.message}`);
    }
  };
  const revokeDirect = async (p) => {
    try {
      await apiJSON(`/settings/beta-access/revoke/${p._id}`, {
        method: "POST",
      });
      showMsg(`Beta access revoked from ${p.username}`);
      setSearchResults((prev) =>
        prev.map((x) => (x._id === p._id ? { ...x, hasBetaAccess: false } : x)),
      );
    } catch (err) {
      showMsg(`❌ ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {msg && (
        <p className="font-mono text-sm text-green-400 bg-green-950/30 border border-green-800 px-4 py-2 rounded">
          {msg}
        </p>
      )}

      <div className="glass-card p-4 sm:p-5 space-y-3">
        <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">
          Grant Beta Access Directly
        </h2>
        <p className="font-mono text-[10px] text-gray-700">
          💡 Admin can give beta access to any player, regardless of
          subscription plan.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchPlayers()}
            placeholder="Search username or email…"
            className="input-field flex-1 text-sm"
          />
          <button
            onClick={searchPlayers}
            disabled={searching}
            className="btn-secondary text-sm disabled:opacity-50 flex-shrink-0"
          >
            {searching ? "…" : "SEARCH"}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="space-y-2 pt-2">
            {searchResults.map((p) => (
              <div
                key={p._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-900/50 border border-gray-800 rounded px-3 py-2"
              >
                <div>
                  <span className="font-mono text-sm text-white">
                    {p.username}
                  </span>
                  <span className="font-mono text-xs text-gray-600 ml-2">
                    {p.email}
                  </span>
                  {p.hasBetaAccess && (
                    <span className="font-mono text-[10px] text-green-400 border border-green-800 px-1 rounded ml-2">
                      HAS ACCESS
                    </span>
                  )}
                </div>
                {p.hasBetaAccess ? (
                  <button
                    onClick={() => revokeDirect(p)}
                    className="font-mono text-xs text-red-500 border border-red-900 hover:bg-red-950/30 px-2 py-1 rounded flex-shrink-0"
                  >
                    Revoke
                  </button>
                ) : (
                  <button
                    onClick={() => grantDirect(p)}
                    className="font-mono text-xs text-green-500 border border-green-800 hover:bg-green-950/30 px-2 py-1 rounded flex-shrink-0"
                  >
                    Grant
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">
            Beta Access Requests
          </h2>
          <div className="flex gap-2 flex-wrap">
            {["pending", "approved", "rejected", "all"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`font-mono text-xs px-3 py-1 rounded border transition-colors ${filter === f ? "bg-blue-900/30 border-blue-700 text-blue-400" : "border-gray-800 text-gray-600 hover:text-gray-400"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <p className="font-mono text-xs text-gray-700 text-center py-8">
            Loading…
          </p>
        ) : requests.length === 0 ? (
          <p className="font-mono text-xs text-gray-700 text-center py-8">
            No {filter !== "all" ? filter : ""} requests.
          </p>
        ) : (
          requests.map((req) => (
            <div
              key={req._id}
              className="glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-white">
                    {req.username}
                  </span>
                  <span className="font-mono text-[10px] text-purple-400 border border-purple-800 px-1 rounded uppercase">
                    {req.plan}
                  </span>
                  <span
                    className={`font-mono text-[10px] px-1.5 rounded border ${req.status === "pending" ? "text-yellow-400 border-yellow-800" : req.status === "approved" ? "text-green-400 border-green-800" : "text-red-400 border-red-800"}`}
                  >
                    {req.status.toUpperCase()}
                  </span>
                </div>
                <p className="font-mono text-xs text-gray-600 mt-0.5">
                  {req.email}
                </p>
                {req.message && (
                  <p className="font-mono text-xs text-gray-400 mt-1 italic">
                    "{req.message}"
                  </p>
                )}
                {req.adminNote && (
                  <p className="font-mono text-[10px] text-gray-600 mt-1">
                    Admin note: {req.adminNote}
                  </p>
                )}
                <p className="font-mono text-[10px] text-gray-700 mt-1">
                  Requested {new Date(req.createdAt).toLocaleString()}
                </p>
              </div>
              {req.status === "pending" && (
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => approve(req)}
                    className="font-mono text-xs text-green-400 border border-green-800 hover:bg-green-950/30 px-3 py-1.5 rounded"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => reject(req)}
                    className="font-mono text-xs text-red-500 border border-red-900 hover:bg-red-950/30 px-3 py-1.5 rounded"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENTS TAB — view all transactions, cancel/refund
// ─────────────────────────────────────────────────────────────────────────────
function PaymentsSection() {
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [msg, setMsg] = useState("");
  const [refundTarget, setRefundTarget] = useState(null);

  useEffect(() => {
    load(true);
  }, [statusFilter, planFilter]);

  const load = async (reset = false) => {
    const p = reset ? 1 : page;
    if (reset) setPage(1);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: p,
        limit: 50,
        ...(statusFilter && { status: statusFilter }),
        ...(planFilter && { plan: planFilter }),
      });
      const d = await apiJSON(`/payments/admin/all?${params}`);
      if (reset) setPayments(d.payments || []);
      else setPayments((prev) => [...prev, ...(d.payments || [])]);
      setTotal(d.total || 0);
      setTotalRevenue(d.totalRevenue || 0);
      setHasMore((d.page || 1) < (d.pages || 1));
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const showMsg = (m) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  const cancelPayment = async (payment) => {
    const reason = window.prompt("Reason for cancellation (optional):") || "";
    try {
      await apiJSON(`/payments/admin/${payment._id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      showMsg(`✅ Cancelled subscription for ${payment.playerId?.username}`);
      load(true);
    } catch (err) {
      showMsg(`❌ ${err.message}`);
    }
  };

  const confirmRefund = async () => {
    if (!refundTarget) return;
    try {
      await apiJSON(`/payments/admin/${refundTarget._id}/refund`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      showMsg(`✅ Refund processed for ${refundTarget.playerId?.username}`);
      setRefundTarget(null);
      load(true);
    } catch (err) {
      showMsg(`❌ ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      {msg && (
        <p className="font-mono text-sm text-green-400 bg-green-950/30 border border-green-800 px-4 py-2 rounded">
          {msg}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total Transactions"
          value={total}
          color="text-blue-400"
          loading={loading}
        />
        <StatCard
          label="Total Revenue"
          value={`₹${totalRevenue.toFixed(0)}`}
          color="text-green-400"
          loading={loading}
        />
        <StatCard
          label="Filtered"
          value={payments.length}
          color="text-gray-400"
          loading={loading}
        />
      </div>

      <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field text-sm"
          >
            <option value="">All</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div>
          <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
            Plan
          </label>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="input-field text-sm"
          >
            <option value="">All</option>
            <option value="pro">Pro</option>
            <option value="elite">Elite</option>
          </select>
        </div>
      </div>

      {loading && payments.length === 0 ? (
        <p className="font-mono text-xs text-gray-700 text-center py-8">
          Loading…
        </p>
      ) : payments.length === 0 ? (
        <p className="font-mono text-xs text-gray-700 text-center py-8">
          No transactions found.
        </p>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => (
            <div
              key={p._id}
              className="glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-white">
                    {p.playerId?.username || "Unknown"}
                  </span>
                  <span className="font-mono text-[10px] text-purple-400 border border-purple-800 px-1 rounded uppercase">
                    {p.plan}
                  </span>
                  <span
                    className={`font-mono text-[10px] px-1.5 rounded border ${
                      p.status === "paid"
                        ? "text-green-400 border-green-800"
                        : p.status === "refunded"
                          ? "text-red-400 border-red-800"
                          : p.status === "cancelled"
                            ? "text-gray-400 border-gray-700"
                            : "text-yellow-400 border-yellow-800"
                    }`}
                  >
                    {p.status.toUpperCase()}
                  </span>
                </div>
                <p className="font-mono text-xs text-gray-600 mt-0.5">
                  {p.playerId?.email}
                </p>
                <p className="font-mono text-[10px] text-gray-700 mt-0.5">
                  {p.receiptNumber || "No receipt"} · ₹
                  {(p.amount / 100).toFixed(2)} ·{" "}
                  {new Date(p.createdAt).toLocaleDateString("en-IN")}
                  {p.razorpayPaymentId && <> · {p.razorpayPaymentId}</>}
                </p>
              </div>
              {p.status === "paid" && (
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => cancelPayment(p)}
                    className="font-mono text-xs text-gray-400 border border-gray-700 hover:bg-gray-800 px-3 py-1.5 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setRefundTarget(p)}
                    className="font-mono text-xs text-red-500 border border-red-900 hover:bg-red-950/30 px-3 py-1.5 rounded"
                  >
                    Refund
                  </button>
                </div>
              )}
            </div>
          ))}
          {hasMore && (
            <div className="text-center pt-2">
              <button
                onClick={() => {
                  setPage((p) => p + 1);
                  load(false);
                }}
                disabled={loading}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                {loading ? "Loading…" : "Load More"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Refund confirmation modal */}
      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setRefundTarget(null)}
          />
          <div className="relative z-10 glass-card p-6 w-full max-w-sm space-y-4">
            <h2 className="font-display text-lg font-bold text-red-400">
              Confirm Refund
            </h2>
            <p className="font-mono text-xs text-gray-500">
              Refund ₹{(refundTarget.amount / 100).toFixed(2)} to{" "}
              <span className="text-white">
                {refundTarget.playerId?.username}
              </span>{" "}
              via Razorpay? This also downgrades them to the free tier
              immediately.
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmRefund}
                className="flex-1 bg-red-900/50 hover:bg-red-800/50 border border-red-700 text-red-300 font-mono text-sm py-2 rounded"
              >
                CONFIRM REFUND
              </button>
              <button
                onClick={() => setRefundTarget(null)}
                className="flex-1 font-mono text-sm text-gray-500 border border-gray-700 py-2 rounded"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLANS TAB — moderation: view all clans, disband any
// ─────────────────────────────────────────────────────────────────────────────
function ClansSection() {
  const [clans, setClans] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: 1,
        limit: 50,
        ...(search && { search }),
      });
      const d = await apiJSON(`/clans/admin/all?${params}`);
      setClans(d.clans || []);
      setTotal(d.total || 0);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const showMsg = (m) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  const disband = async (clan) => {
    const reason = window.prompt(`Disband "${clan.name}"? Reason (optional):`);
    if (reason === null) return; // cancelled
    try {
      await apiJSON(`/clans/admin/${clan._id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      showMsg(`✅ ${clan.name} disbanded`);
      load();
    } catch (err) {
      showMsg(`❌ ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      {msg && (
        <p className="font-mono text-sm text-green-400 bg-green-950/30 border border-green-800 px-4 py-2 rounded">
          {msg}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Total Clans"
          value={total}
          color="text-cyan-400"
          loading={loading}
        />
        <StatCard
          label="Filtered"
          value={clans.length}
          color="text-gray-400"
          loading={loading}
        />
      </div>
      <div className="glass-card p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or tag…"
          className="input-field text-sm w-full"
        />
      </div>
      {loading ? (
        <p className="font-mono text-xs text-gray-700 text-center py-8">
          Loading…
        </p>
      ) : clans.length === 0 ? (
        <p className="font-mono text-xs text-gray-700 text-center py-8">
          No clans found.
        </p>
      ) : (
        <div className="space-y-2">
          {clans.map((clan) => (
            <div
              key={clan._id}
              className="glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl flex-shrink-0">{clan.badge}</span>
                <div className="min-w-0">
                  <p className="font-mono text-sm text-white font-bold truncate">
                    {clan.name}{" "}
                    <span className="text-cyan-400">[{clan.tag}]</span>
                  </p>
                  <p className="font-mono text-[10px] text-gray-600">
                    Owner: {clan.owner?.username || "Unknown"} ·{" "}
                    {clan.memberCount}/{clan.maxMembers} members ·{" "}
                    {clan.joinPolicy}
                  </p>
                  <p className="font-mono text-[10px] text-gray-700">
                    🏆 {clan.stats?.totalWins || 0} wins ·{" "}
                    {clan.stats?.totalMatches || 0} matches
                  </p>
                </div>
              </div>
              <button
                onClick={() => disband(clan)}
                className="font-mono text-xs text-red-500 border border-red-900 hover:bg-red-950/30 px-3 py-1.5 rounded flex-shrink-0"
              >
                Disband
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ClanBattleSettingsSection({ settings, onSaved, showMsg }) {
  const cbs = settings.clanBattleSettings || {};
  const [challengeExpiryDays, setChallengeExpiryDays] = useState(
    cbs.challengeExpiryDays ?? 7,
  );
  const [battleWindowHours, setBattleWindowHours] = useState(
    cbs.battleWindowHours ?? 24,
  );
  const [scoringMode, setScoringMode] = useState(cbs.scoringMode || "sum");
  const [roomCount, setRoomCount] = useState(cbs.roomCount ?? 10);

  const save = async () => {
    try {
      await apiJSON("/clans/admin/battle-settings", {
        method: "PATCH",
        body: JSON.stringify({
          challengeExpiryDays: parseInt(challengeExpiryDays),
          battleWindowHours: parseInt(battleWindowHours),
          scoringMode,
          roomCount: parseInt(roomCount),
        }),
      });
      onSaved();
      showMsg("✅ Clan battle settings updated");
    } catch (err) {
      showMsg(err.message, true);
    }
  };

  return (
    <div className="glass-card p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">
          ⚔ Clan Battle Settings
        </h2>
        <p className="font-mono text-[10px] text-gray-700 mt-1">
          💡 Async clan-vs-clan battles: members play their own runs
          independently within a time window; scores are compared when it
          closes.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
            Unaccepted Challenge Expiry (days)
          </label>
          <input
            type="number"
            value={challengeExpiryDays}
            onChange={(e) => setChallengeExpiryDays(e.target.value)}
            min="1"
            max="30"
            className="input-field text-sm w-full"
          />
        </div>
        <div>
          <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
            Battle Window (hours, after accept)
          </label>
          <input
            type="number"
            value={battleWindowHours}
            onChange={(e) => setBattleWindowHours(e.target.value)}
            min="1"
            max="168"
            className="input-field text-sm w-full"
          />
        </div>
      </div>

      <div>
        <label className="font-mono text-[10px] text-gray-600 uppercase block mb-2">
          Scoring Mode
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "sum", label: "Sum", desc: "Total across all members" },
            { id: "average", label: "Average", desc: "Per-member average" },
            { id: "best", label: "Best Run", desc: "Highest single run" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setScoringMode(m.id)}
              className={`rounded-lg border p-3 text-left transition-colors ${scoringMode === m.id ? "border-orange-600 bg-orange-950/20" : "border-gray-800"}`}
            >
              <p
                className={`font-mono text-xs font-bold ${scoringMode === m.id ? "text-orange-400" : "text-gray-400"}`}
              >
                {m.label}
              </p>
              <p className="font-mono text-[10px] text-gray-600 mt-0.5">
                {m.desc}
              </p>
            </button>
          ))}
        </div>
        <p className="font-mono text-[10px] text-gray-700 mt-1">
          💡 Only applies to battles created AFTER this change —
          completed/active battles keep their original scoring mode.
        </p>
      </div>

      <div>
        <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
          Rooms Per Battle
        </label>
        <input
          type="number"
          value={roomCount}
          onChange={(e) => setRoomCount(e.target.value)}
          min="3"
          max="20"
          className="input-field text-sm w-40"
        />
        <p className="font-mono text-[10px] text-gray-700 mt-1">
          Number of rooms in each battle's shared sequence — applies to battles
          created after saving.
        </p>
      </div>

      <button onClick={save} className="btn-primary w-full">
        SAVE BATTLE SETTINGS
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function PlayerDetailModal({ playerId, onClose, onAction }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [playerId]);
  const load = async () => {
    setLoading(true);
    try {
      const d = await apiJSON(`/admin/players/${playerId}/detail`);
      setData(d);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="relative z-10 glass-card p-6">
          <p className="font-mono text-xs text-gray-500">Loading…</p>
        </div>
      </div>
    );
  if (!data) return null;

  const { player, clan, recentMatches, dailyUsage } = data;
  const stats = player.stats || {};
  const survivalRate = stats.gamesPlayed
    ? ((stats.wins / stats.gamesPlayed) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 glass-card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-900/50 border border-green-700 flex items-center justify-center text-xl">
              🎮
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                {player.displayName || player.username}
              </h2>
              <p className="font-mono text-xs text-gray-500">
                @{player.username}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-400 text-xl"
          >
            ×
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {player.isEmailVerified && (
            <span className="font-mono text-[10px] text-green-500 border border-green-800 px-1.5 py-0.5 rounded">
              ✓ Email
            </span>
          )}
          {player.isPhoneVerified && (
            <span className="font-mono text-[10px] text-green-500 border border-green-800 px-1.5 py-0.5 rounded">
              ✓ Phone
            </span>
          )}
          {player.isVerified && (
            <span className="font-mono text-[10px] text-yellow-400 border border-yellow-700 px-1.5 py-0.5 rounded">
              ✓ VERIFIED
            </span>
          )}
          {player.subscription?.plan !== "free" && (
            <span className="font-mono text-[10px] text-purple-400 border border-purple-700 px-1.5 py-0.5 rounded uppercase">
              {player.subscription?.plan}
            </span>
          )}
          {player.isBanned && (
            <span className="font-mono text-[10px] text-red-500 border border-red-800 px-1.5 py-0.5 rounded">
              🚫 BANNED
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 font-mono text-xs text-gray-500">
          <p>
            Email: <span className="text-gray-300">{player.email}</span>
          </p>
          {player.phone && (
            <p>
              Phone: <span className="text-gray-300">{player.phone}</span>
            </p>
          )}
          {player.country && (
            <p>
              Country: <span className="text-gray-300">{player.country}</span>
            </p>
          )}
          <p>
            Joined:{" "}
            <span className="text-gray-300">
              {new Date(player.createdAt).toLocaleDateString()}
            </span>
          </p>
          <p>
            Last seen:{" "}
            <span className="text-gray-300">
              {player.isOnline
                ? "Online now"
                : new Date(player.lastSeen).toLocaleDateString()}
            </span>
          </p>
          {player.subscription?.expiresAt && (
            <p>
              Plan expires:{" "}
              <span className="text-gray-300">
                {new Date(player.subscription.expiresAt).toLocaleDateString()}
              </span>
            </p>
          )}
        </div>

        {player.bio && (
          <p className="font-mono text-xs text-gray-500 italic border-l-2 border-gray-800 pl-2">
            {player.bio}
          </p>
        )}

        <div className="grid grid-cols-4 gap-2">
          {[
            ["Games", stats.gamesPlayed || 0, "text-blue-400"],
            ["Wins", stats.wins || 0, "text-green-400"],
            ["Survival", survivalRate + "%", "text-yellow-400"],
            ["Rooms", stats.totalRoomsSurvived || 0, "text-purple-400"],
          ].map(([label, val, color]) => (
            <div
              key={label}
              className="bg-gray-900/50 border border-gray-800 rounded p-2 text-center"
            >
              <p className={`font-mono text-sm font-bold ${color}`}>{val}</p>
              <p className="font-mono text-[9px] text-gray-600 uppercase">
                {label}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded p-2 flex justify-between font-mono text-[10px] text-gray-500">
          <span>Rooms created today: {dailyUsage.roomsCreatedToday}</span>
          <span>Rooms joined today: {dailyUsage.roomsJoinedToday}</span>
        </div>

        {clan && (
          <div className="border border-cyan-900/50 rounded-lg p-3">
            <p className="font-mono text-xs text-cyan-400">
              {clan.badge} {clan.name}{" "}
              <span className="text-gray-500">[{clan.tag}]</span> · {clan.role}
            </p>
          </div>
        )}

        {player.isBanned && (
          <div className="border border-red-900/50 rounded-lg p-3 space-y-1">
            <p className="font-mono text-xs text-red-400">
              Ban reason: {player.banReason || "—"}
            </p>
            <p className="font-mono text-[10px] text-gray-600">
              {player.banUntil
                ? `Until ${new Date(player.banUntil).toLocaleDateString()}`
                : "Permanent"}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <p className="font-mono text-xs text-gray-500 uppercase">
            Recent Matches
          </p>
          {recentMatches.length === 0 ? (
            <p className="font-mono text-[10px] text-gray-700">
              No completed matches yet.
            </p>
          ) : (
            recentMatches.map((m) => (
              <div
                key={m.roomCode}
                className="flex items-center justify-between font-mono text-[10px] text-gray-500 border-b border-gray-900 pb-1"
              >
                <span>
                  {m.roomCode} · {m.mode}
                </span>
                <span
                  className={
                    m.result?.isWinner ? "text-green-400" : "text-red-500"
                  }
                >
                  {m.result?.isWinner ? "WON" : "LOST"} ·{" "}
                  {m.result?.roomsSurvived ?? 0}/{m.totalRooms}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Reuse your existing quick-action buttons here — verify/unverify,
            ban/unban, gift subscription — same handlers you already have
            wired to the Players tab row buttons, just called from here too */}
        <div className="flex gap-2 pt-2 border-t border-gray-800">
          <button
            onClick={() => onAction("verify", player)}
            className="flex-1 font-mono text-xs text-yellow-400 border border-yellow-800 hover:bg-yellow-950/30 py-2 rounded"
          >
            {player.isVerified ? "Unverify" : "Verify"}
          </button>
          <button
            onClick={() => onAction("ban", player)}
            className="flex-1 font-mono text-xs text-red-500 border border-red-900 hover:bg-red-950/30 py-2 rounded"
          >
            {player.isBanned ? "Unban" : "Ban"}
          </button>
          <button
            onClick={() => onAction("gift", player)}
            className="flex-1 font-mono text-xs text-purple-400 border border-purple-800 hover:bg-purple-950/30 py-2 rounded"
          >
            Gift Sub
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function MatchesTab() {
  const [matches, setMatches] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    load(true);
  }, [statusFilter, modeFilter, search]);

  const load = async (reset = false) => {
    setLoading(true);
    const p = reset ? 1 : page;
    try {
      const params = new URLSearchParams({ page: p, limit: 30 });
      if (statusFilter) params.set("status", statusFilter);
      if (modeFilter) params.set("mode", modeFilter);
      if (search) params.set("search", search);
      const d = await apiJSON(`/admin/matches?${params}`);
      setMatches((prev) => (reset ? d.matches : [...prev, ...d.matches]));
      setHasMore(p < d.pages);
      setPage(p + 1);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const abandonMatch = async (id) => {
    if (!window.confirm("Force-abandon this match?")) return;
    try {
      await apiJSON(`/admin/matches/${id}/abandon`, { method: "PATCH" });
      load(true);
    } catch (_) {}
  };
  const deleteMatch = async (id) => {
    if (!window.confirm("Permanently delete this match record?")) return;
    try {
      await apiJSON(`/admin/matches/${id}`, { method: "DELETE" });
      load(true);
    } catch (_) {}
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search room code…"
          className="input-field text-sm w-48"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field text-sm"
        >
          <option value="">All statuses</option>
          <option value="waiting">Waiting</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="abandoned">Abandoned</option>
        </select>
        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
          className="input-field text-sm"
        >
          <option value="">All modes</option>
          <option value="solo">Solo</option>
          <option value="coop">Co-op</option>
          <option value="vs">Vs</option>
        </select>
      </div>

      <div className="space-y-2">
        {matches.map((m) => (
          <div
            key={m._id}
            className="glass-card p-3 flex items-center justify-between flex-wrap gap-2"
          >
            <button
              onClick={() => setSelected(m)}
              className="font-mono text-xs text-cyan-400 hover:underline"
            >
              {m.roomCode}
            </button>
            <span
              className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                m.status === "completed"
                  ? "text-green-400 border-green-800"
                  : m.status === "in_progress"
                    ? "text-yellow-400 border-yellow-800"
                    : m.status === "abandoned"
                      ? "text-gray-500 border-gray-700"
                      : "text-blue-400 border-blue-800"
              }`}
            >
              {m.status}
            </span>
            <span className="font-mono text-[10px] text-gray-600">
              {m.mode} · {m.players?.length || 0} players · {m.totalRooms || 0}{" "}
              rooms
            </span>
            <span className="font-mono text-[10px] text-gray-700">
              {new Date(m.createdAt).toLocaleDateString()}
            </span>
            <div className="flex gap-1">
              {m.status === "in_progress" && (
                <button
                  onClick={() => abandonMatch(m._id)}
                  className="font-mono text-[9px] text-yellow-500 border border-yellow-800 px-1.5 py-0.5 rounded"
                >
                  abandon
                </button>
              )}
              <button
                onClick={() => deleteMatch(m._id)}
                className="font-mono text-[9px] text-red-500 border border-red-900 px-1.5 py-0.5 rounded"
              >
                delete
              </button>
            </div>
          </div>
        ))}
        {hasMore && (
          <div className="text-center pt-2">
            <button
              onClick={() => load(false)}
              disabled={loading}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              {loading ? "Loading…" : "Load More"}
            </button>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <div className="relative z-10 glass-card p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-white">
                {selected.roomCode}
              </h2>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-600 hover:text-gray-400 text-xl"
              >
                ×
              </button>
            </div>
            <p className="font-mono text-xs text-gray-500">
              {selected.mode} · {selected.status} · {selected.totalRooms} rooms
              · {selected.difficultyCurve}
            </p>
            <div className="space-y-1">
              {(selected.players || []).map((p) => (
                <div
                  key={p.playerId?._id || p.username}
                  className="flex justify-between font-mono text-xs"
                >
                  <span className="text-white">
                    {p.playerId?.username || p.username}
                  </span>
                  <span
                    className={p.isWinner ? "text-green-400" : "text-gray-500"}
                  >
                    {p.isWinner ? "WON" : "LOST"} · {p.roomsSurvived ?? 0}/
                    {selected.totalRooms}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function ClanBattlesTab() {
  const [battles, setBattles] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [subview, setSubview] = useState("battles"); // battles | challenges

  useEffect(() => {
    if (subview === "battles") load(true);
    else loadChallenges();
  }, [statusFilter, search, subview]);

  const load = async (reset = false) => {
    setLoading(true);
    const p = reset ? 1 : page;
    try {
      const params = new URLSearchParams({ page: p, limit: 30 });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const d = await apiJSON(`/admin/clan-battles?${params}`);
      setBattles((prev) => (reset ? d.battles : [...prev, ...d.battles]));
      setHasMore(p < d.pages);
      setPage(p + 1);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const loadChallenges = async () => {
    setLoading(true);
    try {
      const d = await apiJSON("/admin/clan-challenges?status=pending");
      setChallenges(d.challenges || []);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const forceFinalize = async (id) => {
    if (
      !window.confirm(
        "Force-finalize this battle now, using whatever runs have been submitted so far?",
      )
    )
      return;
    try {
      await apiJSON(`/admin/clan-battles/${id}/force-finalize`, {
        method: "POST",
      });
      load(true);
      setSelected(null);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setSubview("battles")}
          className={`font-mono text-xs px-3 py-1.5 rounded border ${subview === "battles" ? "bg-orange-900/30 border-orange-700 text-orange-400" : "border-gray-800 text-gray-600"}`}
        >
          Battles
        </button>
        <button
          onClick={() => setSubview("challenges")}
          className={`font-mono text-xs px-3 py-1.5 rounded border ${subview === "challenges" ? "bg-orange-900/30 border-orange-700 text-orange-400" : "border-gray-800 text-gray-600"}`}
        >
          Pending Challenges
        </button>
      </div>

      {subview === "battles" && (
        <>
          <div className="flex gap-2 flex-wrap">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by clan name/tag…"
              className="input-field text-sm w-56"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field text-sm"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="space-y-2">
            {battles.map((b) => {
              const isOverdue =
                b.status === "active" && new Date(b.expiresAt) < new Date();
              return (
                <div
                  key={b._id}
                  className={`glass-card p-3 flex items-center justify-between flex-wrap gap-2 ${isOverdue ? "border border-red-800" : ""}`}
                >
                  <button
                    onClick={() => setSelected(b)}
                    className="font-mono text-xs text-cyan-400 hover:underline"
                  >
                    {b.clanAId?.tag} vs {b.clanBId?.tag}
                  </button>
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${b.status === "completed" ? "text-green-400 border-green-800" : isOverdue ? "text-red-400 border-red-800 animate-pulse" : "text-yellow-400 border-yellow-800"}`}
                  >
                    {isOverdue
                      ? "OVERDUE — cron may have missed this"
                      : b.status}
                  </span>
                  <span className="font-mono text-[10px] text-gray-600">
                    {b.runs?.length || 0} run(s) · score {b.clanAScore ?? "—"}-
                    {b.clanBScore ?? "—"}
                  </span>
                  {b.status === "active" && (
                    <button
                      onClick={() => forceFinalize(b._id)}
                      className="font-mono text-[9px] text-orange-500 border border-orange-800 px-1.5 py-0.5 rounded"
                    >
                      force finalize
                    </button>
                  )}
                </div>
              );
            })}
            {hasMore && (
              <div className="text-center pt-2">
                <button
                  onClick={() => load(false)}
                  disabled={loading}
                  className="btn-secondary text-sm disabled:opacity-50"
                >
                  {loading ? "Loading…" : "Load More"}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {subview === "challenges" && (
        <div className="space-y-2">
          {challenges.length === 0 ? (
            <p className="font-mono text-xs text-gray-700">
              No pending challenges.
            </p>
          ) : (
            challenges.map((c) => (
              <div
                key={c._id}
                className="glass-card p-3 flex items-center justify-between"
              >
                <span className="font-mono text-xs text-white">
                  {c.challengerClanId?.tag} → {c.targetClanId?.tag}
                </span>
                <span className="font-mono text-[10px] text-gray-600">
                  Sent {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <div className="relative z-10 glass-card p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-white">
                {selected.clanAId?.tag} vs {selected.clanBId?.tag}
              </h2>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-600 hover:text-gray-400 text-xl"
              >
                ×
              </button>
            </div>
            <p className="font-mono text-xs text-gray-500">
              Status: {selected.status} · Scoring: {selected.scoringMode} ·
              Window closes {new Date(selected.expiresAt).toLocaleString()}
            </p>
            <div className="space-y-1">
              {(selected.runs || []).map((r, i) => (
                <div key={i} className="flex justify-between font-mono text-xs">
                  <span className="text-white">
                    {r.playerId?.username || r.username}
                  </span>
                  <span className="text-gray-400">{r.roomsSurvived} rooms</span>
                </div>
              ))}
              {(selected.runs || []).length === 0 && (
                <p className="font-mono text-[10px] text-gray-700">
                  No runs submitted yet.
                </p>
              )}
            </div>
            {selected.status === "active" && (
              <button
                onClick={() => forceFinalize(selected._id)}
                className="w-full font-mono text-xs text-orange-400 border border-orange-800 hover:bg-orange-950/30 py-2 rounded"
              >
                Force Finalize Now
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { player } = useAuthStore();
  const [tab, setTab] = useState("dashboard");
  const [actionMsg, setActionMsg] = useState("");

  const [dash, setDash] = useState(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [clueStats, setClueStats] = useState(null);
  const [clueStatsLoading, setClueStatsLoading] = useState(true);

  const [clues, setClues] = useState([]);
  const [clueTotal, setClueTotal] = useState(0);
  const [cluePage, setCluePage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [clueLoading, setClueLoading] = useState(false);
  const [clueTab, setClueTab] = useState("list");
  const [editTarget, setEditTarget] = useState(null);
  const [filterCat, setFilterCat] = useState("");
  const [filterDiff, setFilterDiff] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [savingClue, setSavingClue] = useState(false);

  const [players, setPlayers] = useState([]);
  const [detailPlayerId, setDetailPlayerId] = useState(null);
  const [playerTotal, setPlayerTotal] = useState(0);
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerFilter, setPlayerFilter] = useState("");
  const [playerLoading, setPlayerLoading] = useState(false);
  const [banTarget, setBanTarget] = useState(null);
  const [giftTarget, setGiftTarget] = useState(null);

  const [logs, setLogs] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);

  useEffect(() => {
    if (player && !player.isAdmin) navigate("/lobby");
  }, [player]);

  const fetchDash = async () => {
    setDashLoading(true);
    try {
      const d = await apiJSON("/admin/dashboard");
      setDash(d);
    } catch (_) {
    } finally {
      setDashLoading(false);
    }
  };

  const fetchClueStats = async () => {
    setClueStatsLoading(true);
    try {
      const d = await apiJSON("/clues/stats");
      const s = { total: 0, active: 0, inactive: 0, byCategory: {} };
      (d.stats || []).forEach((x) => {
        s.total += x.count;
        if (x._id.isActive) s.active += x.count;
        else s.inactive += x.count;
        s.byCategory[x._id.category] =
          (s.byCategory[x._id.category] || 0) + x.count;
      });
      setClueStats(s);
    } catch (_) {
    } finally {
      setClueStatsLoading(false);
    }
  };

  const fetchClues = useCallback(
    async (reset = false) => {
      const p = reset ? 1 : cluePage;
      if (reset) setCluePage(1);
      setClueLoading(true);
      try {
        const params = new URLSearchParams({
          page: p,
          limit: PAGE,
          ...(filterCat && { category: filterCat }),
          ...(filterDiff && { difficulty: filterDiff }),
          ...(search && { search }),
          ...(showInactive && { includeInactive: "1" }),
        });
        const d = await apiJSON(`/clues?${params}`);
        if (reset) setClues(d.clues || []);
        else
          setClues((prev) =>
            p === 1 ? d.clues || [] : [...prev, ...(d.clues || [])],
          );
        setClueTotal(d.total || 0);
        setHasMore((d.page || 1) < (d.pages || 1));
      } catch (_) {
      } finally {
        setClueLoading(false);
      }
    },
    [filterCat, filterDiff, search, showInactive, cluePage],
  );

  const fetchPlayers = useCallback(async () => {
    setPlayerLoading(true);
    try {
      const params = new URLSearchParams({
        page: 1,
        limit: PAGE,
        ...(playerSearch && { search: playerSearch }),
        ...(playerFilter && { filter: playerFilter }),
      });
      const d = await apiJSON(`/admin/players?${params}`);
      setPlayers(d.players || []);
      setPlayerTotal(d.total || 0);
    } catch (_) {
    } finally {
      setPlayerLoading(false);
    }
  }, [playerSearch, playerFilter]);

  const fetchLogs = async (reset = false) => {
    setLogLoading(true);
    const p = reset ? 1 : logPage;
    if (reset) setLogPage(1);
    try {
      const d = await apiJSON(`/admin/audit-logs?page=${p}&limit=50`);
      if (reset) setLogs(d.logs || []);
      else setLogs((prev) => [...prev, ...(d.logs || [])]);
      setLogTotal(d.total || 0);
    } catch (_) {
    } finally {
      setLogLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "dashboard") {
      fetchDash();
      fetchClueStats();
    }
    if (tab === "clues") {
      fetchClueStats();
      fetchClues(true);
    }
    if (tab === "players") fetchPlayers();
    if (tab === "audit") fetchLogs(true);
  }, [tab]);
  useEffect(() => {
    if (tab === "clues") fetchClues(true);
  }, [filterCat, filterDiff, search, showInactive]);
  useEffect(() => {
    if (tab === "players") fetchPlayers();
  }, [playerSearch, playerFilter]);

  const showMsg = (m) => {
    setActionMsg(m);
    setTimeout(() => setActionMsg(""), 4000);
  };

  const saveClue = async (form) => {
    setSavingClue(true);
    try {
      if (editTarget?._id)
        await apiJSON(`/clues/${editTarget._id}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      else
        await apiJSON("/clues", { method: "POST", body: JSON.stringify(form) });
      setClueTab("list");
      setEditTarget(null);
      fetchClueStats();
      fetchClues(true);
      showMsg(editTarget?._id ? "✅ Clue updated" : "✅ Clue created");
    } catch (err) {
      showMsg(`❌ ${err.message}`);
    } finally {
      setSavingClue(false);
    }
  };

  const toggleClue = async (clue) => {
    try {
      const d = await apiJSON(`/clues/${clue._id}/toggle`, { method: "PATCH" });
      setClues((prev) => prev.map((c) => (c._id === clue._id ? d.clue : c)));
      fetchClueStats();
    } catch (err) {
      showMsg(`❌ ${err.message}`);
    }
  };

  const deleteClue = async (clue) => {
    if (!window.confirm(`Delete "${clue.template.slice(0, 60)}…"?`)) return;
    try {
      await apiJSON(`/clues/${clue._id}`, { method: "DELETE" });
      setClues((prev) => prev.filter((c) => c._id !== clue._id));
      setClueTotal((t) => t - 1);
      fetchClueStats();
      showMsg("✅ Clue deleted");
    } catch (err) {
      showMsg(`❌ ${err.message}`);
    }
  };

  const unbanPlayer = async (p) => {
    try {
      await apiJSON(`/admin/players/${p._id}/unban`, { method: "POST" });
      fetchPlayers();
      showMsg(`✅ ${p.username} unbanned`);
    } catch (err) {
      showMsg(`❌ ${err.message}`);
    }
  };

  const toggleVerified = async (p) => {
    try {
      await apiJSON(`/admin/players/${p._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isVerified: !p.isVerified }),
      });
      fetchPlayers();
      showMsg(`✅ ${p.username} ${!p.isVerified ? "verified" : "unverified"}`);
    } catch (err) {
      showMsg(`❌ ${err.message}`);
    }
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "clues", label: "Clues" },
    { id: "players", label: "Players" },
    { id: "settings", label: "⚙ Settings" },
    { id: "beta", label: "🧪 Beta Requests" },
    { id: "payments", label: "💳 Payments" },
    { id: "clans", label: "🛡️ Clans" },
    { id: "audit", label: "Audit Log" },
    { id: "matches", label: "Matches", icon: "🎮" },
    { id: "clanBattles", label: "Clan Battles", icon: "⚔" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2 text-gray-700 font-mono text-xs mb-2">
            <button
              onClick={() => navigate("/lobby")}
              className="hover:text-green-400"
            >
              ← LOBBY
            </button>
            <span>/</span>
            <span className="text-gray-500">ADMIN</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-green-400 tracking-wider uppercase">
            Admin Panel
          </h1>
          <p className="font-mono text-sm text-gray-500 mt-1">
            Signed in as{" "}
            <span className="text-green-400">{player?.username}</span>
            <span className="ml-2 text-xs text-yellow-400 border border-yellow-700 px-1 rounded">
              ADMIN
            </span>
          </p>
        </div>

        {actionMsg && (
          <p
            className={`font-mono text-sm ${actionMsg.startsWith("✅") ? "text-green-400" : "text-red-400"} bg-gray-900 border border-gray-800 px-4 py-2 rounded`}
          >
            {actionMsg}
          </p>
        )}

        <div className="flex gap-2 flex-wrap overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`font-mono text-sm px-3 sm:px-4 py-2 rounded border transition-colors whitespace-nowrap ${tab === t.id ? "bg-green-900/30 border-green-700 text-green-400" : "border-gray-800 text-gray-600 hover:text-gray-400"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Total Players"
                value={dash?.totalPlayers}
                color="text-green-400"
                loading={dashLoading}
              />
              <StatCard
                label="Online Now"
                value={dash?.activePlayers}
                color="text-blue-400"
                loading={dashLoading}
              />
              <StatCard
                label="DAU (24h)"
                value={dash?.dau}
                color="text-purple-400"
                loading={dashLoading}
              />
              <StatCard
                label="Active Games"
                value={dash?.activeMatches}
                color="text-yellow-400"
                loading={dashLoading}
              />
              <StatCard
                label="Total Clues"
                value={dash?.totalClues}
                color="text-green-400"
                loading={dashLoading}
              />
              <StatCard
                label="Active Clues"
                value={dash?.activeClues}
                color="text-green-400"
                loading={dashLoading}
              />
              <StatCard
                label="Banned"
                value={dash?.bannedPlayers}
                color="text-red-400"
                loading={dashLoading}
              />
              <StatCard
                label="Verified"
                value={dash?.verifiedPlayers}
                color="text-yellow-400"
                loading={dashLoading}
              />
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 sm:gap-3">
              {ALL_CATEGORIES.map((cat) => (
                <div key={cat} className="glass-card p-2 sm:p-3 text-center">
                  <p
                    className={`font-display text-lg sm:text-xl font-bold ${clueStats?.byCategory?.[cat] > 0 ? "text-blue-400" : "text-gray-700"}`}
                  >
                    {clueStatsLoading ? "—" : clueStats?.byCategory?.[cat] || 0}
                  </p>
                  <p className="font-mono text-[8px] sm:text-[9px] text-gray-600 uppercase mt-1 truncate">
                    {cat}
                  </p>
                </div>
              ))}
            </div>
            {!clueStatsLoading && (clueStats?.total || 0) < 100 && (
              <div className="bg-yellow-950/40 border border-yellow-800 rounded-lg p-4">
                <p className="font-mono text-xs text-yellow-400 font-bold">
                  ⚠ Only {clueStats?.total || 0} clues in database!
                </p>
                <p className="font-mono text-xs text-yellow-700 mt-1">
                  Run{" "}
                  <code className="text-yellow-400 bg-black/30 px-1 rounded">
                    npm run seed
                  </code>{" "}
                  on the server to load 2,870 clues across all difficulty
                  levels.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === "settings" && <SettingsTab />}

        {tab === "beta" && <BetaRequestsSection />}

        {tab === "payments" && <PaymentsSection />}

        {tab === "clans" && <ClansSection />}

        {tab === "clues" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label="Total"
                value={clueStats?.total}
                loading={clueStatsLoading}
              />
              <StatCard
                label="Active"
                value={clueStats?.active}
                loading={clueStatsLoading}
              />
              <StatCard
                label="Inactive"
                value={clueStats?.inactive}
                color="text-red-400"
                loading={clueStatsLoading}
              />
            </div>
            <div className="flex gap-3 flex-wrap">
              {["list", "create", "bulk"].map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setClueTab(t);
                    setEditTarget(null);
                  }}
                  className={`font-mono text-sm px-4 py-2 rounded border transition-colors ${clueTab === t ? "bg-green-900/30 border-green-700 text-green-400" : "border-gray-800 text-gray-600 hover:text-gray-400"}`}
                >
                  {t === "list"
                    ? `CLUES (${clueTotal})`
                    : t === "create"
                      ? "+ CREATE"
                      : "⬆ BULK IMPORT"}
                </button>
              ))}
            </div>
            {clueTab === "bulk" && (
              <div className="glass-card p-6">
                <BulkImport
                  onDone={() => {
                    fetchClueStats();
                    fetchClues(true);
                  }}
                />
              </div>
            )}
            {(clueTab === "create" || editTarget) && (
              <div className="glass-card p-6">
                <h2 className="font-display text-lg font-bold text-white mb-4">
                  {editTarget ? "EDIT CLUE" : "CREATE NEW CLUE"}
                </h2>
                <ClueForm
                  initial={editTarget || EMPTY_CLUE}
                  onSave={saveClue}
                  onCancel={() => {
                    setClueTab("list");
                    setEditTarget(null);
                  }}
                  saving={savingClue}
                />
              </div>
            )}
            {clueTab === "list" && !editTarget && (
              <div className="space-y-3">
                <div className="glass-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
                      Search
                    </label>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search…"
                      className="input-field text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
                      Category
                    </label>
                    <select
                      value={filterCat}
                      onChange={(e) => setFilterCat(e.target.value)}
                      className="input-field text-sm w-full"
                    >
                      <option value="">All</option>
                      {ALL_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
                      Difficulty
                    </label>
                    <select
                      value={filterDiff}
                      onChange={(e) => setFilterDiff(e.target.value)}
                      className="input-field text-sm w-full"
                    >
                      <option value="">All</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((d) => (
                        <option key={d} value={d}>
                          D{d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="inactive"
                      checked={showInactive}
                      onChange={(e) => setShowInactive(e.target.checked)}
                      className="accent-green-500"
                    />
                    <label
                      htmlFor="inactive"
                      className="font-mono text-xs text-gray-500"
                    >
                      Show inactive
                    </label>
                    <button
                      onClick={() => {
                        setSearch("");
                        setFilterCat("");
                        setFilterDiff("");
                        setShowInactive(true);
                      }}
                      className="font-mono text-xs text-gray-700 hover:text-gray-400 ml-auto"
                    >
                      RESET
                    </button>
                  </div>
                </div>
                {clueLoading && clues.length === 0 ? (
                  <p className="font-mono text-xs text-gray-700 text-center py-8">
                    Loading…
                  </p>
                ) : clues.length === 0 ? (
                  <p className="font-mono text-xs text-gray-700 text-center py-8">
                    No clues found.
                  </p>
                ) : (
                  <>
                    {clues.map((clue) => (
                      <div
                        key={clue._id}
                        className="glass-card p-4 flex flex-col sm:flex-row items-start gap-4"
                      >
                        <div className="flex-shrink-0 sm:w-24">
                          <span className="font-mono text-[10px] text-gray-600 uppercase">
                            {clue.category}
                          </span>
                          <div className="flex gap-0.5 mt-1">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((d) => (
                              <div
                                key={d}
                                className={`h-1 w-2 rounded-sm ${d <= clue.difficulty ? "bg-green-500/60" : "bg-gray-800"}`}
                              />
                            ))}
                          </div>
                          <span
                            className={`font-mono text-[9px] mt-1 block ${clue.isActive ? "text-green-500" : "text-gray-700"}`}
                          >
                            ● {clue.isActive ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-sm text-white leading-snug">
                            {clue.template.length > 90
                              ? clue.template.slice(0, 90) + "…"
                              : clue.template}
                          </p>
                          <p className="font-mono text-[10px] text-gray-600 mt-1">
                            Rule:{" "}
                            <span className="text-gray-500">
                              {clue.answerRule.slice(0, 50)}
                            </span>
                          </p>
                          {clue.hints?.length > 0 && (
                            <p className="font-mono text-[10px] text-yellow-700 mt-0.5">
                              💡 {clue.hints.length} hint
                              {clue.hints.length > 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => {
                              setEditTarget(clue);
                              setClueTab("create");
                            }}
                            className="font-mono text-xs border border-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded"
                          >
                            EDIT
                          </button>
                          <button
                            onClick={() => toggleClue(clue)}
                            className={`font-mono text-xs border px-3 py-1.5 rounded ${clue.isActive ? "border-red-900/60 text-red-500" : "border-green-900/60 text-green-500"}`}
                          >
                            {clue.isActive ? "DISABLE" : "ENABLE"}
                          </button>
                          <button
                            onClick={() => deleteClue(clue)}
                            className="font-mono text-xs text-red-800 hover:text-red-500 px-2 py-1.5"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="text-center pt-2">
                      <p className="font-mono text-xs text-gray-600 mb-3">
                        Showing {clues.length} of {clueTotal} clues
                      </p>
                      {hasMore && (
                        <button
                          onClick={() => {
                            setCluePage((p) => p + 1);
                            fetchClues(false);
                          }}
                          disabled={clueLoading}
                          className="btn-secondary text-sm disabled:opacity-50"
                        >
                          {clueLoading ? "Loading…" : "Load More"}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "players" && (
          <div className="space-y-4">
            <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-48">
                <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
                  Search
                </label>
                <input
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  placeholder="Username or email…"
                  className="input-field text-sm w-full"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">
                  Filter
                </label>
                <select
                  value={playerFilter}
                  onChange={(e) => setPlayerFilter(e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="">All players</option>
                  <option value="banned">Banned</option>
                  <option value="verified">Verified</option>
                  <option value="online">Online</option>
                </select>
              </div>
              <span className="font-mono text-xs text-gray-600">
                {playerTotal} players
              </span>
            </div>
            {playerLoading && players.length === 0 ? (
              <p className="font-mono text-xs text-gray-700 text-center py-8">
                Loading…
              </p>
            ) : players.length === 0 ? (
              <p className="font-mono text-xs text-gray-700 text-center py-8">
                No players found.
              </p>
            ) : (
              <div className="space-y-2">
                {players.map((p) => (
                  <div
                    key={p._id}
                    className="glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* <span className="font-mono text-sm font-bold text-white">
                          {p.username}
                        </span> */}
                        <button
                          onClick={() => setDetailPlayerId(p._id)}
                          className="font-mono text-xs text-cyan-400 hover:underline"
                        >
                          {p.username}
                        </button>
                        {p.isVerified && (
                          <span className="font-mono text-[10px] text-yellow-400 border border-yellow-700 px-1 rounded">
                            ✓ VERIFIED
                          </span>
                        )}
                        {p.isBanned && (
                          <span className="font-mono text-[10px] text-red-400 border border-red-700 px-1 rounded">
                            BANNED
                          </span>
                        )}
                        {p.isOnline && (
                          <span className="font-mono text-[10px] text-green-400 border border-green-800 px-1 rounded">
                            ● ONLINE
                          </span>
                        )}
                        {p.hasBetaAccess && (
                          <span className="font-mono text-[10px] text-blue-400 border border-blue-800 px-1 rounded">
                            🧪 BETA
                          </span>
                        )}
                        {p.subscription?.plan !== "free" && (
                          <span className="font-mono text-[10px] text-purple-400 border border-purple-700 px-1 rounded uppercase">
                            {p.subscription.plan}
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-gray-500 mt-0.5">
                        {p.email}
                      </p>
                      <p className="font-mono text-[10px] text-gray-700 mt-0.5">
                        Games: {p.stats?.gamesPlayed || 0} · Wins:{" "}
                        {p.stats?.wins || 0} · Joined:{" "}
                        {new Date(p.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                      <button
                        onClick={() => toggleVerified(p)}
                        className={`font-mono text-xs border px-2 py-1.5 rounded transition-colors ${p.isVerified ? "border-gray-700 text-gray-500 hover:border-red-800 hover:text-red-400" : "border-yellow-800 text-yellow-500 hover:bg-yellow-950/30"}`}
                      >
                        {p.isVerified ? "Unverify" : "Verify"}
                      </button>
                      <button
                        onClick={() => setGiftTarget(p)}
                        className="font-mono text-xs border border-purple-800 text-purple-400 hover:bg-purple-950/30 px-2 py-1.5 rounded"
                      >
                        🎁 Gift
                      </button>
                      {p.isBanned ? (
                        <button
                          onClick={() => unbanPlayer(p)}
                          className="font-mono text-xs border border-green-800 text-green-400 hover:bg-green-950/30 px-2 py-1.5 rounded"
                        >
                          Unban
                        </button>
                      ) : (
                        <button
                          onClick={() => setBanTarget(p)}
                          className="font-mono text-xs border border-red-900 text-red-500 hover:bg-red-950/30 px-2 py-1.5 rounded"
                        >
                          Ban
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "audit" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs text-gray-600">
                {logTotal} log entries
              </p>
              <button
                onClick={() => fetchLogs(true)}
                className="font-mono text-xs text-gray-600 hover:text-green-400"
              >
                ↻ REFRESH
              </button>
            </div>
            {logLoading && logs.length === 0 ? (
              <p className="font-mono text-xs text-gray-700 text-center py-8">
                Loading…
              </p>
            ) : logs.length === 0 ? (
              <p className="font-mono text-xs text-gray-700 text-center py-8">
                No audit logs yet.
              </p>
            ) : (
              <div className="space-y-2">
                {logs.map((log, i) => (
                  <div
                    key={log._id || i}
                    className="glass-card px-4 py-3 flex flex-col sm:flex-row items-start gap-2 sm:gap-4"
                  >
                    <div className="flex-shrink-0 sm:text-right sm:w-32">
                      <p className="font-mono text-[10px] text-gray-600">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </p>
                      <p className="font-mono text-[10px] text-gray-700">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-green-400">
                          {log.adminName || log.adminId}
                        </span>
                        <span className="font-mono text-xs text-yellow-500 border border-yellow-800 px-1.5 rounded break-words">
                          {log.action}
                        </span>
                      </div>
                      {log.target && (
                        <p className="font-mono text-[10px] text-gray-600 mt-0.5 break-words">
                          {log.target}
                        </p>
                      )}
                      {log.details && (
                        <p className="font-mono text-[10px] text-gray-700 mt-0.5 truncate">
                          {JSON.stringify(log.details).slice(0, 80)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {logTotal > logs.length && (
                  <div className="text-center pt-2">
                    <button
                      onClick={() => {
                        setLogPage((p) => p + 1);
                        fetchLogs(false);
                      }}
                      disabled={logLoading}
                      className="btn-secondary text-sm disabled:opacity-50"
                    >
                      {logLoading ? "Loading…" : "Load More"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "matches" && <MatchesTab />}

        {tab === "clanBattles" && <ClanBattlesTab />}
      </div>

      {banTarget && (
        <BanModal
          player={banTarget}
          onClose={() => setBanTarget(null)}
          onDone={fetchPlayers}
        />
      )}
      {giftTarget && (
        <GiftModal
          player={giftTarget}
          onClose={() => setGiftTarget(null)}
          onDone={fetchPlayers}
        />
      )}

      {detailPlayerId && (
        <PlayerDetailModal
          playerId={detailPlayerId}
          onClose={() => setDetailPlayerId(null)}
          onAction={(action, player) => {
            if (action === "verify") handleVerify(player); // your existing handler
            if (action === "ban") handleBan(player); // your existing handler
            if (action === "gift") handleGift(player); // your existing handler
          }}
        />
      )}
    </div>
  );
}
