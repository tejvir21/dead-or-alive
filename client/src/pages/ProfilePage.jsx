/**
 * ProfilePage.jsx
 * View + edit profile, change password, trigger OTP verification
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import useAuthStore from "../store/authStore";
import { apiJSON } from "../api/apiClient";
import OTPModal from "../components/ui/OTPModal";
import BetaAccessSection from "../components/ui/BetaAccessSection";
import SubscriptionSection from "../components/ui/SubscriptionSection";

const COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Argentina",
  "Australia",
  "Austria",
  "Bangladesh",
  "Belgium",
  "Brazil",
  "Canada",
  "Chile",
  "China",
  "Colombia",
  "Croatia",
  "Czech Republic",
  "Denmark",
  "Egypt",
  "Ethiopia",
  "Finland",
  "France",
  "Germany",
  "Ghana",
  "Greece",
  "Hungary",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Japan",
  "Jordan",
  "Kenya",
  "Malaysia",
  "Mexico",
  "Morocco",
  "Myanmar",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Norway",
  "Pakistan",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Romania",
  "Russia",
  "Saudi Arabia",
  "Serbia",
  "Singapore",
  "South Africa",
  "South Korea",
  "Spain",
  "Sri Lanka",
  "Sweden",
  "Switzerland",
  "Taiwan",
  "Tanzania",
  "Thailand",
  "Turkey",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Vietnam",
  "Zimbabwe",
];

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non-binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const AVATARS = [
  "survivor",
  "ghost",
  "skull",
  "shield",
  "lightning",
  "star",
  "flame",
  "ice",
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { player, fetchProfile } = useAuthStore();

  const [tab, setTab] = useState("profile"); // profile | security | stats
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  // Profile form
  const [form, setForm] = useState({
    displayName: "",
    bio: "",
    country: "",
    gender: "",
    avatar: "survivor",
  });

  // Password form
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });

  // OTP modal
  const [otpModal, setOtpModal] = useState(null); // null | { type: 'email'|'phone', channel: 'email'|'whatsapp'|'sms' }

  // Stats
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (player) {
      setForm({
        displayName: player.displayName || "",
        bio: player.bio || "",
        country: player.country || "",
        gender: player.gender || "",
        avatar: player.avatar || "survivor",
      });
    }
  }, [player]);

  useEffect(() => {
    if (tab === "stats") fetchHistory();
  }, [tab]);

  const fetchHistory = async () => {
    try {
      const data = await apiJSON("/game/history");
      setHistory(data.matches || []);
    } catch (_) {}
  };

  const showMsg = (m, isError = false) => {
    if (isError) setError(m);
    else setMsg(m);
    setTimeout(() => {
      setMsg("");
      setError("");
    }, 4000);
  };

  // ── Save profile ─────────────────────────────────────────────────────────────
  const saveProfile = async () => {
    setSaving(true);
    try {
      await apiJSON("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: form.displayName,
          bio: form.bio,
          country: form.country,
          gender: form.gender,
          avatar: form.avatar,
        }),
      });
      await fetchProfile();
      showMsg("✅ Profile saved");
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setSaving(false);
    }
  };

  // ── Change password ───────────────────────────────────────────────────────────
  const changePassword = async () => {
    if (!pwForm.current) return showMsg("Current password required", true);
    if (pwForm.next.length < 8)
      return showMsg("New password must be at least 8 characters", true);
    if (pwForm.next !== pwForm.confirm)
      return showMsg("Passwords do not match", true);
    setSaving(true);
    try {
      await apiJSON("/auth/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: pwForm.current,
          newPassword: pwForm.next,
        }),
      });
      setPwForm({ current: "", next: "", confirm: "" });
      showMsg("✅ Password updated");
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setSaving(false);
    }
  };

  if (!player) return null;

  const stats = player.stats || {};
  const survivalRate = stats.gamesPlayed
    ? ((stats.wins / stats.gamesPlayed) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => navigate("/lobby")}
            className="font-mono text-xs text-gray-700 hover:text-green-400 mb-2 block transition-colors"
          >
            ← LOBBY
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-green-900/50 border border-green-700 flex items-center justify-center text-2xl">
              {player.avatar === "skull"
                ? "💀"
                : player.avatar === "ghost"
                  ? "👻"
                  : player.avatar === "shield"
                    ? "🛡️"
                    : player.avatar === "lightning"
                      ? "⚡"
                      : player.avatar === "star"
                        ? "⭐"
                        : player.avatar === "flame"
                          ? "🔥"
                          : player.avatar === "ice"
                            ? "❄️"
                            : "🎮"}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-white">
                {player.displayName || player.username}
              </h1>
              <p className="font-mono text-sm text-gray-500">
                @{player.username}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {player.isEmailVerified ? (
                  <span className="font-mono text-[10px] text-green-500 border border-green-800 px-1.5 py-0.5 rounded">
                    ✓ Email
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-gray-600 border border-gray-800 px-1.5 py-0.5 rounded">
                    ✗ Email
                  </span>
                )}
                {player.isPhoneVerified ? (
                  <span className="font-mono text-[10px] text-green-500 border border-green-800 px-1.5 py-0.5 rounded">
                    ✓ Phone
                  </span>
                ) : player.phone ? (
                  <span className="font-mono text-[10px] text-gray-600 border border-gray-800 px-1.5 py-0.5 rounded">
                    ✗ Phone
                  </span>
                ) : null}
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
              </div>
            </div>
          </div>
        </div>

        {/* Feedback messages */}
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

        {/* Tabs */}
        <div className="flex gap-2">
          {["profile", "security", "stats", "billing"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`font-mono text-xs px-4 py-2 rounded border uppercase tracking-wider transition-colors ${
                tab === t
                  ? "bg-green-900/30 border-green-700 text-green-400"
                  : "border-gray-800 text-gray-600 hover:text-gray-400"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Profile Tab ─────────────────────────────────────────────────── */}
        {tab === "profile" && (
          <div className="space-y-5">
            {/* Avatar picker */}
            <div className="glass-card p-5 space-y-3">
              <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block">
                Avatar
              </label>
              <div className="flex gap-3 flex-wrap">
                {[
                  ["survivor", "🎮"],
                  ["ghost", "👻"],
                  ["skull", "💀"],
                  ["shield", "🛡️"],
                  ["lightning", "⚡"],
                  ["star", "⭐"],
                  ["flame", "🔥"],
                  ["ice", "❄️"],
                ].map(([val, emoji]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, avatar: val }))}
                    className={`w-12 h-12 rounded-lg text-2xl border-2 transition-all ${
                      form.avatar === val
                        ? "border-green-500 bg-green-900/30 scale-110"
                        : "border-gray-800 hover:border-gray-600"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Profile fields */}
            <div className="glass-card p-5 space-y-4">
              <div>
                <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
                  Display Name
                </label>
                <input
                  value={form.displayName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, displayName: e.target.value }))
                  }
                  placeholder={player.username}
                  maxLength={30}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
                  Bio
                </label>
                <textarea
                  value={form.bio}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bio: e.target.value }))
                  }
                  placeholder="Tell other players about yourself…"
                  maxLength={200}
                  rows={3}
                  className="input-field w-full resize-none"
                />
                <p className="font-mono text-[10px] text-gray-700 mt-1">
                  {form.bio.length}/200
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
                    Country
                  </label>
                  <select
                    value={form.country}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, country: e.target.value }))
                    }
                    className="input-field w-full"
                  >
                    <option value="">Select…</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
                    Gender
                  </label>
                  <select
                    value={form.gender}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, gender: e.target.value }))
                    }
                    className="input-field w-full"
                  >
                    <option value="">Select…</option>
                    {GENDERS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={saveProfile}
                disabled={saving}
                className="btn-primary w-full disabled:opacity-50"
              >
                {saving ? "SAVING…" : "SAVE CHANGES"}
              </button>
            </div>

            {/* Verification section */}
            <div className="glass-card p-5 space-y-4">
              <h2 className="font-mono text-xs text-gray-500 uppercase tracking-wider">
                Verification
              </h2>

              {/* Email verification */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm text-white">{player.email}</p>
                  <p className="font-mono text-[10px] text-gray-600">Email</p>
                </div>
                {player.isEmailVerified ? (
                  <span className="font-mono text-xs text-green-500 border border-green-800 px-2 py-1 rounded">
                    ✓ Verified
                  </span>
                ) : (
                  <button
                    onClick={() =>
                      setOtpModal({ type: "email", channel: "email" })
                    }
                    className="font-mono text-xs text-yellow-400 border border-yellow-800 px-3 py-1.5 rounded hover:bg-yellow-950/30 transition-colors"
                  >
                    Verify Email
                  </button>
                )}
              </div>

              {/* Phone verification */}
              {player.phone && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm text-white">
                      {player.phone}
                    </p>
                    <p className="font-mono text-[10px] text-gray-600">Phone</p>
                  </div>
                  {player.isPhoneVerified ? (
                    <span className="font-mono text-xs text-green-500 border border-green-800 px-2 py-1 rounded">
                      ✓ Verified
                    </span>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setOtpModal({ type: "phone", channel: "whatsapp" })
                        }
                        className="font-mono text-xs text-green-400 border border-green-800 px-2 py-1.5 rounded hover:bg-green-950/30"
                      >
                        WhatsApp OTP
                      </button>
                      <button
                        onClick={() =>
                          setOtpModal({ type: "phone", channel: "sms" })
                        }
                        className="font-mono text-xs text-blue-400 border border-blue-800 px-2 py-1.5 rounded hover:bg-blue-950/30"
                      >
                        SMS OTP
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!player.isEmailVerified && (
                <p className="font-mono text-[10px] text-gray-700">
                  Verify email + phone to become a verified user and unlock
                  extended features.
                </p>
              )}
            </div>

            {/* Beta access */}
            <BetaAccessSection player={player} />
          </div>
        )}

        {/* ── Security Tab ────────────────────────────────────────────────── */}
        {tab === "security" && (
          <div className="glass-card p-5 space-y-4">
            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-wider">
              Change Password
            </h2>

            <div>
              <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={pwForm.current}
                onChange={(e) =>
                  setPwForm((f) => ({ ...f, current: e.target.value }))
                }
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
                New Password
              </label>
              <input
                type="password"
                value={pwForm.next}
                onChange={(e) =>
                  setPwForm((f) => ({ ...f, next: e.target.value }))
                }
                placeholder="Min 8 chars, uppercase, number, symbol"
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={pwForm.confirm}
                onChange={(e) =>
                  setPwForm((f) => ({ ...f, confirm: e.target.value }))
                }
                className="input-field w-full"
              />
              {pwForm.confirm && pwForm.next !== pwForm.confirm && (
                <p className="font-mono text-[10px] text-red-500 mt-1">
                  Passwords do not match
                </p>
              )}
            </div>
            <button
              onClick={changePassword}
              disabled={saving}
              className="btn-primary w-full disabled:opacity-50"
            >
              {saving ? "UPDATING…" : "UPDATE PASSWORD"}
            </button>

            <div className="pt-4 border-t border-gray-800 space-y-2">
              <h3 className="font-mono text-xs text-gray-500 uppercase tracking-wider">
                Account Info
              </h3>
              <div className="space-y-1 font-mono text-xs text-gray-600">
                <p>
                  Username:{" "}
                  <span className="text-gray-400">{player.username}</span>
                </p>
                <p>
                  Email: <span className="text-gray-400">{player.email}</span>
                </p>
                {player.phone && (
                  <p>
                    Phone: <span className="text-gray-400">{player.phone}</span>
                  </p>
                )}
                {player.country && (
                  <p>
                    Country:{" "}
                    <span className="text-gray-400">{player.country}</span>
                  </p>
                )}
                {player.dateOfBirth && (
                  <p>
                    DOB:{" "}
                    <span className="text-gray-400">
                      {new Date(player.dateOfBirth).toLocaleDateString()}
                    </span>
                  </p>
                )}
                <p>
                  Member since:{" "}
                  <span className="text-gray-400">
                    {new Date(
                      player.createdAt || Date.now(),
                    ).toLocaleDateString()}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Stats Tab ────────────────────────────────────────────────────── */}
        {tab === "stats" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ["Games", stats.gamesPlayed || 0, "text-blue-400"],
                ["Wins", stats.wins || 0, "text-green-400"],
                ["Survival Rate", survivalRate + "%", "text-yellow-400"],
                [
                  "Rooms Survived",
                  stats.totalRoomsSurvived || 0,
                  "text-purple-400",
                ],
              ].map(([label, val, color]) => (
                <div key={label} className="glass-card p-4 text-center">
                  <p className={`font-display text-2xl font-bold ${color}`}>
                    {val}
                  </p>
                  <p className="font-mono text-[10px] text-gray-600 uppercase mt-1">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="glass-card p-5 space-y-3">
              <h2 className="font-mono text-xs text-gray-500 uppercase tracking-wider">
                Match History
              </h2>
              {history.length === 0 ? (
                <p className="font-mono text-xs text-gray-700">
                  No matches yet — start playing!
                </p>
              ) : (
                history.map((m, i) => {
                  const me = m.players?.find(
                    (p) => p.username === player.username,
                  );
                  return (
                    <div
                      key={m._id || i}
                      className="flex items-center justify-between border-b border-gray-800 pb-2 last:border-0"
                    >
                      <div>
                        <p className="font-mono text-xs text-white">
                          {m.roomCode}
                        </p>
                        <p className="font-mono text-[10px] text-gray-600">
                          {new Date(
                            m.endedAt || m.createdAt,
                          ).toLocaleDateString()}
                          {" · "}
                          {m.players?.length || 0} players
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-mono text-xs font-bold ${me?.isWinner ? "text-green-400" : "text-red-500"}`}
                        >
                          {me?.isWinner ? "WON" : "ELIMINATED"}
                        </p>
                        <p className="font-mono text-[10px] text-gray-600">
                          {me?.doorChoices?.filter((d) => d.survived)?.length ||
                            0}
                          /{m.totalRooms || 0} rooms
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Billing / Subscription Tab */}
      {tab === "billing" && (
        <div className="space-y-4 py-6 max-w-2xl mx-auto">
          <SubscriptionSection player={player} onUpdate={fetchProfile} />
        </div>
      )}

      {/* OTP Modal */}
      {otpModal && (
        <OTPModal
          type={otpModal.type}
          channel={otpModal.channel}
          onClose={() => setOtpModal(null)}
          onVerified={async () => {
            setOtpModal(null);
            await fetchProfile();
            showMsg("✅ Verification successful! You are now a verified user.");
          }}
        />
      )}
    </div>
  );
}
