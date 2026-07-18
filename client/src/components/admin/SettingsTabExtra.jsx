/**
 * SettingsTabExtra.jsx
 * Additional settings sections: Daily Limits, Auto-Start Timer, Kick System, Beta Access
 * Import and render inside your existing AdminPage SettingsTab, after the
 * Difficulty Curves section.
 *
 * Usage in AdminPage.jsx:
 *   import SettingsTabExtra from '../components/admin/SettingsTabExtra';
 *   ...
 *   <SettingsTab />
 *   <SettingsTabExtra />   ← add this line right after <SettingsTab/>
 */
import React, { useState, useEffect } from 'react';
import { apiJSON } from '../../api/apiClient';

function Toggle({ label, value, onChange, hint }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`flex items-center justify-between px-3 py-2.5 rounded border text-left transition-colors w-full ${value ? 'border-green-800 bg-green-950/20' : 'border-gray-800 bg-gray-900/50'}`}>
      <div>
        <span className="font-mono text-xs text-gray-300 block">{label}</span>
        {hint && <span className="font-mono text-[10px] text-gray-600 block mt-0.5">{hint}</span>}
      </div>
      <span className={`font-mono text-[10px] font-bold flex-shrink-0 ml-2 ${value ? 'text-green-400' : 'text-gray-600'}`}>{value ? 'ON' : 'OFF'}</span>
    </button>
  );
}

function NumberField({ label, value, onChange, min, max, suffix = '' }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div>
      <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">{label}</label>
      <div className="flex gap-2">
        <input type="number" value={local} min={min} max={max}
          onChange={e => setLocal(e.target.value)}
          className="input-field text-sm flex-1"/>
        <button onClick={() => onChange(parseInt(local))}
          className="font-mono text-xs border border-green-800 text-green-500 hover:bg-green-950/30 px-2 rounded">✓</button>
      </div>
    </div>
  );
}

export default function SettingsTabExtra() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [msg, setMsg]           = useState('');
  const [error, setError]       = useState('');
  const [section, setSection]   = useState('limits'); // limits | autostart | kick | beta

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    try { const d = await apiJSON('/settings'); setSettings(d.settings); }
    catch (_) {} finally { setLoading(false); }
  };

  const showMsg = (m, isErr = false) => { if (isErr) setError(m); else setMsg(m); setTimeout(() => { setMsg(''); setError(''); }, 3000); };

  const saveDailyLimit = async (tier, field, value) => {
    try {
      await apiJSON('/settings/daily-limits', { method: 'PATCH', body: JSON.stringify({ tier, [field]: value }) });
      await load(); showMsg(`✅ ${tier} ${field} limit updated`);
    } catch (err) { showMsg(err.message, true); }
  };

  const saveAutoStart = async (updates) => {
    try { await apiJSON('/settings/auto-start', { method: 'PATCH', body: JSON.stringify(updates) }); await load(); showMsg('✅ Auto-start settings updated'); }
    catch (err) { showMsg(err.message, true); }
  };

  const saveKickSystem = async (updates) => {
    try { await apiJSON('/settings/kick-system', { method: 'PATCH', body: JSON.stringify(updates) }); await load(); showMsg('✅ Kick system updated'); }
    catch (err) { showMsg(err.message, true); }
  };

  const saveBetaAccess = async (updates) => {
    try { await apiJSON('/settings/beta-access', { method: 'PATCH', body: JSON.stringify(updates) }); await load(); showMsg('✅ Beta access settings updated'); }
    catch (err) { showMsg(err.message, true); }
  };

  if (loading || !settings) return <p className="font-mono text-xs text-gray-700 text-center py-8">Loading extended settings…</p>;

  const dl = settings.dailyLimits || {};
  const at = settings.autoStartTimer || {};
  const ks = settings.kickSystem || {};
  const ba = settings.betaAccess || {};

  const sections = [
    { id: 'limits',    label: 'Daily Limits' },
    { id: 'autostart', label: 'Auto-Start' },
    { id: 'kick',      label: 'Kick System' },
    { id: 'beta',      label: 'Beta Access' },
  ];

  return (
    <div className="space-y-4">
      {msg   && <p className="font-mono text-sm text-green-400 bg-green-950/30 border border-green-800 px-4 py-2 rounded">{msg}</p>}
      {error && <p className="font-mono text-sm text-red-400 bg-red-950/30 border border-red-800 px-4 py-2 rounded">⚠ {error}</p>}

      {/* Sub-nav */}
      <div className="flex gap-2 flex-wrap">
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`font-mono text-xs px-3 py-1.5 rounded border transition-colors ${section===s.id?'bg-blue-900/30 border-blue-700 text-blue-400':'border-gray-800 text-gray-600 hover:text-gray-400'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── DAILY LIMITS ─────────────────────────────────────────────────── */}
      {section === 'limits' && (
        <div className="glass-card p-5 space-y-4">
          <div>
            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">📅 Daily Room Limits</h2>
            <p className="font-mono text-[10px] text-gray-700 mt-1">Set -1 for unlimited. Resets 24h after each player's first action (rolling window, not calendar day).</p>
          </div>
          {['free','verified','pro','elite'].map(tier => (
            <div key={tier} className="border border-gray-800 rounded-lg p-3">
              <p className="font-mono text-xs text-white uppercase mb-2 flex items-center gap-2">
                {tier}
                {tier==='elite'&&<span className="font-mono text-[9px] text-yellow-500 border border-yellow-800 px-1 rounded">recommend unlimited</span>}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Create/day" value={dl[tier]?.create ?? 0} min={-1} onChange={v => saveDailyLimit(tier,'create',v)}/>
                <NumberField label="Join/day"   value={dl[tier]?.join   ?? 0} min={-1} onChange={v => saveDailyLimit(tier,'join',v)}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── AUTO-START TIMER ─────────────────────────────────────────────── */}
      {section === 'autostart' && (
        <div className="glass-card p-5 space-y-4">
          <div>
            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">⏱ Auto-Start Timer</h2>
            <p className="font-mono text-[10px] text-gray-700 mt-1">When the timer expires, ready players start automatically. Not-ready players are removed. If below minPlayers ready, room is cancelled.</p>
          </div>
          <Toggle label="Auto-start enabled" value={at.enabled} onChange={v => saveAutoStart({ enabled: v })} hint="Master switch for this feature"/>
          <NumberField label="Default duration (seconds)" value={at.defaultDuration||180} min={10} max={1800} onChange={v => saveAutoStart({ defaultDuration: v })}/>

          <p className="font-mono text-[10px] text-gray-600 uppercase pt-2">Per-tier adjustable range (room creator can pick within this)</p>
          {['free','verified','pro','elite'].map(tier => (
            <div key={tier} className="border border-gray-800 rounded-lg p-3">
              <p className="font-mono text-xs text-white uppercase mb-2">{tier}</p>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Min (sec)" value={at.tierLimits?.[tier]?.min||0} min={10} onChange={v => saveAutoStart({ tierLimits: { [tier]: { min: v } } })}/>
                <NumberField label="Max (sec)" value={at.tierLimits?.[tier]?.max||0} min={10} onChange={v => saveAutoStart({ tierLimits: { [tier]: { max: v } } })}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── KICK SYSTEM ──────────────────────────────────────────────────── */}
      {section === 'kick' && (
        <div className="glass-card p-5 space-y-4">
          <div>
            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">🚫 Kick System</h2>
            <p className="font-mono text-[10px] text-gray-700 mt-1">Waiting room: host-only kick (or vote). In-game: any player can initiate a vote. Requires minimum player count.</p>
          </div>
          <Toggle label="Kick system enabled" value={ks.enabled} onChange={v => saveKickSystem({ enabled: v })}/>
          <Toggle label="Host can kick unilaterally (waiting room)" value={ks.creatorCanKick} onChange={v => saveKickSystem({ creatorCanKick: v })} hint="If room has fewer players than minimum below"/>
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Min players to vote" value={ks.minimumPlayers||3} min={2} max={20} onChange={v => saveKickSystem({ minimumPlayers: v })}/>
            <NumberField label="Threshold %" value={ks.thresholdPercent||50} min={1} max={100} onChange={v => saveKickSystem({ thresholdPercent: v })}/>
            <NumberField label="Vote timeout (sec)" value={ks.voteTimeoutSeconds||30} min={5} max={300} onChange={v => saveKickSystem({ voteTimeoutSeconds: v })}/>
          </div>
          <p className="font-mono text-[10px] text-gray-700 bg-gray-900/50 border border-gray-800 rounded p-2">
            💡 Suggestion: threshold of 50% means &gt;50% of <em>other</em> players (excluding the target) must vote yes.
          </p>
        </div>
      )}

      {/* ── BETA ACCESS ──────────────────────────────────────────────────── */}
      {section === 'beta' && (
        <div className="glass-card p-5 space-y-4">
          <div>
            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">🧪 Beta Access</h2>
            <p className="font-mono text-[10px] text-gray-700 mt-1">Controls who can access the separate beta-version frontend URL.</p>
          </div>
          <Toggle label="Beta gating enabled" value={ba.enabled} onChange={v => saveBetaAccess({ enabled: v })} hint="If off, everyone can access the beta URL freely"/>
          <div>
            <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">Beta URL</label>
            <div className="flex gap-2">
              <input type="text" defaultValue={ba.betaUrl} id="beta-url-input" placeholder="https://beta.dead-or-alive.io" className="input-field text-sm flex-1"/>
              <button onClick={() => saveBetaAccess({ betaUrl: document.getElementById('beta-url-input').value })}
                className="font-mono text-xs border border-green-800 text-green-500 hover:bg-green-950/30 px-2 rounded">✓</button>
            </div>
            <p className="font-mono text-[10px] text-gray-700 mt-1">Shown to approved beta testers in their profile page.</p>
          </div>
          <Toggle label="Elite = automatic beta access" value={ba.allowElite} onChange={v => saveBetaAccess({ allowElite: v })}/>
          <Toggle label="Pro can request beta access" value={ba.allowPro} onChange={v => saveBetaAccess({ allowPro: v })} hint="Requests go to the Beta Requests tab for approval"/>
          <div>
            <label className="font-mono text-[10px] text-gray-600 uppercase block mb-1">Locked screen message (non-beta users)</label>
            <textarea defaultValue={ba.lockedMessage} id="beta-msg-input" rows={2} className="input-field w-full text-sm resize-none"/>
            <button onClick={() => saveBetaAccess({ lockedMessage: document.getElementById('beta-msg-input').value })}
              className="font-mono text-xs border border-green-800 text-green-500 hover:bg-green-950/30 px-3 py-1 rounded mt-2">Save Message</button>
          </div>
          <p className="font-mono text-[10px] text-gray-700 bg-gray-900/50 border border-gray-800 rounded p-2">
            💡 To grant beta access to any specific player directly (bypassing requests), use the Players tab → find player → "Grant Beta" action, or approve their request in the Beta Requests tab.
          </p>
        </div>
      )}
    </div>
  );
}
