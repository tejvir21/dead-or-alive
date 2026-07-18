/**
 * RegisterPage.jsx — Updated with all extra fields
 * Fields: username, email, password, displayName, phone, country, dateOfBirth, gender
 * All new fields are optional except username/email/password
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore';

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bangladesh',
  'Belgium','Brazil','Canada','Chile','China','Colombia','Croatia','Czech Republic',
  'Denmark','Egypt','Ethiopia','Finland','France','Germany','Ghana','Greece',
  'Hungary','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan',
  'Jordan','Kenya','Malaysia','Mexico','Morocco','Myanmar','Netherlands','New Zealand',
  'Nigeria','Norway','Pakistan','Peru','Philippines','Poland','Portugal','Romania',
  'Russia','Saudi Arabia','Serbia','Singapore','South Africa','South Korea','Spain',
  'Sri Lanka','Sweden','Switzerland','Taiwan','Tanzania','Thailand','Turkey','Uganda',
  'Ukraine','United Arab Emirates','United Kingdom','United States','Vietnam','Zimbabwe',
];

const GENDERS = [
  { value: 'male',              label: 'Male' },
  { value: 'female',            label: 'Female' },
  { value: 'non-binary',        label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();

  const [step, setStep] = useState(1); // 1 = required, 2 = optional
  const [form, setForm] = useState({
    username: '', email: '', password: '', confirmPassword: '',
    displayName: '', phone: '', country: '', dateOfBirth: '', gender: '',
  });
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const set = (k, v) => {
    clearError?.();
    setLocalError('');
    setForm(f => ({ ...f, [k]: v }));
  };

  // ── Password strength ────────────────────────────────────────────────────────
  const strength = (() => {
    const p = form.password;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^a-zA-Z0-9]/.test(p)) score++;
    return score; // 0-4
  })();

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['', 'bg-red-500', 'bg-yellow-500', 'bg-blue-400', 'bg-green-500'][strength];

  // ── Step 1 validation ────────────────────────────────────────────────────────
  const validateStep1 = () => {
    if (!form.username.trim()) return 'Username is required';
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username)) return 'Username: 3-20 chars, letters/numbers/underscores only';
    if (!form.email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Valid email required';
    if (!form.password) return 'Password is required';
    if (form.password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(form.password)) return 'Password needs an uppercase letter';
    if (!/[0-9]/.test(form.password)) return 'Password needs a number';
    if (!/[^a-zA-Z0-9]/.test(form.password)) return 'Password needs a special character';
    if (form.password !== form.confirmPassword) return 'Passwords do not match';
    return null;
  };

  const handleNext = () => {
    const err = validateStep1();
    if (err) { setLocalError(err); return; }
    setStep(2);
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      username:    form.username.trim(),
      email:       form.email.trim().toLowerCase(),
      password:    form.password,
      displayName: form.displayName.trim() || form.username.trim(),
      phone:       form.phone.trim() || undefined,
      country:     form.country || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      gender:      form.gender || undefined,
    };

    const result = await register(payload);
    if (result.success) {
      navigate('/lobby');
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div>
          <button onClick={() => navigate('/')}
            className="font-mono text-xs text-gray-700 hover:text-green-400 transition-colors mb-4 block">
            ← BACK
          </button>
          <h1 className="font-display text-3xl font-bold text-green-400 tracking-wider uppercase">
            {step === 1 ? 'Create Account' : 'Complete Profile'}
          </h1>
          <p className="font-mono text-xs text-gray-600 mt-1">
            {step === 1 ? 'Enter your credentials to access the escape' : 'Optional — you can update these later in your profile'}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2">
          {[1, 2].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-green-500' : 'bg-gray-800'}`} />
          ))}
        </div>

        {/* Error */}
        {displayError && (
          <div className="bg-red-950/50 border border-red-800 text-red-400 font-mono text-sm px-4 py-3 rounded">
            ⚠ {displayError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Step 1: Required fields ──────────────────────────────────── */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">

              <div>
                <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.username}
                  onChange={e => set('username', e.target.value)}
                  placeholder="survivor_7"
                  maxLength={20}
                  className="input-field w-full"
                  autoFocus
                />
                <p className="font-mono text-[10px] text-gray-700 mt-1">
                  3-20 characters, letters/numbers/underscores
                </p>
              </div>

              <div>
                <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="you@example.com"
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder="Min 8 chars, 1 uppercase, 1 number, 1 symbol"
                    className="input-field w-full pr-16"
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-gray-600 hover:text-gray-400">
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
                {form.password && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex gap-1 flex-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full ${i <= strength ? strengthColor : 'bg-gray-800'}`} />
                      ))}
                    </div>
                    <span className={`font-mono text-[10px] ${strengthColor.replace('bg-','text-')}`}>
                      {strengthLabel}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={e => set('confirmPassword', e.target.value)}
                  placeholder="Repeat your password"
                  className="input-field w-full"
                />
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="font-mono text-[10px] text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>

              <button type="button" onClick={handleNext}
                className="btn-primary w-full py-3 text-lg mt-2">
                NEXT →
              </button>
            </motion.div>
          )}

          {/* ── Step 2: Optional profile fields ──────────────────────────── */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">

              <div>
                <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
                  Display Name <span className="text-gray-700 normal-case">optional</span>
                </label>
                <input
                  value={form.displayName}
                  onChange={e => set('displayName', e.target.value)}
                  placeholder={form.username || 'Your display name'}
                  maxLength={30}
                  className="input-field w-full"
                />
                <p className="font-mono text-[10px] text-gray-700 mt-1">
                  Shown in game. Defaults to your username.
                </p>
              </div>

              <div>
                <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
                  Phone Number <span className="text-gray-700 normal-case">optional</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                  className="input-field w-full"
                />
                <p className="font-mono text-[10px] text-gray-700 mt-1">
                  Used for WhatsApp OTP verification (optional)
                </p>
              </div>

              <div>
                <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
                  Country <span className="text-gray-700 normal-case">optional</span>
                </label>
                <select value={form.country} onChange={e => set('country', e.target.value)}
                  className="input-field w-full">
                  <option value="">Select country…</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
                    Date of Birth <span className="text-gray-700 normal-case">optional</span>
                  </label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={e => set('dateOfBirth', e.target.value)}
                    max={new Date(Date.now() - 13 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    className="input-field w-full"
                  />
                </div>

                <div>
                  <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">
                    Gender <span className="text-gray-700 normal-case">optional</span>
                  </label>
                  <select value={form.gender} onChange={e => set('gender', e.target.value)}
                    className="input-field w-full">
                    <option value="">Select…</option>
                    {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Summary of required fields */}
              <div className="bg-gray-900 border border-gray-800 rounded p-3 space-y-1">
                <p className="font-mono text-[10px] text-gray-600 uppercase">Registering as</p>
                <p className="font-mono text-sm text-green-400">{form.username}</p>
                <p className="font-mono text-xs text-gray-500">{form.email}</p>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)}
                  className="btn-secondary px-6">
                  ← BACK
                </button>
                <button type="submit" disabled={isLoading}
                  className="btn-primary flex-1 py-3 disabled:opacity-50">
                  {isLoading ? 'CREATING ACCOUNT…' : 'ENTER THE BUILDING'}
                </button>
              </div>

              <p className="font-mono text-[10px] text-gray-700 text-center">
                You can skip the optional fields — update them later in your profile
              </p>
            </motion.div>
          )}

        </form>

        <p className="font-mono text-xs text-gray-600 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-green-400 hover:text-green-300 transition-colors">
            Sign in
          </Link>
        </p>

      </div>
    </div>
  );
}
