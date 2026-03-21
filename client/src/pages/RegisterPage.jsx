import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore';

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const { register, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handle = (e) => {
    clearError();
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const result = await register(form);
    if (result.success) navigate('/lobby');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-void-900 px-4">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(rgba(229,62,62,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(229,62,62,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative z-10 glass-card p-8 w-full max-w-md"
      >
        <Link to="/" className="font-mono text-xs text-green-500/60 hover:text-green-400 mb-6 block">
          ← BACK
        </Link>
        <h1 className="font-display text-4xl tracking-wider neon-text mb-1">REGISTER</h1>
        <p className="font-body text-gray-500 text-sm mb-8">Create your survivor profile</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">Username</label>
            <input name="username" value={form.username} onChange={handle}
              className="input-field" placeholder="YourCallsign" required minLength={3} maxLength={20} />
          </div>
          <div>
            <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">Email</label>
            <input name="email" type="email" value={form.email} onChange={handle}
              className="input-field" placeholder="you@escape.io" required />
          </div>
          <div>
            <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-1">Password</label>
            <input name="password" type="password" value={form.password} onChange={handle}
              className="input-field" placeholder="Min 6 characters" required minLength={6} />
          </div>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-red-900/30 border border-red-700/50 rounded px-4 py-2 text-red-400 text-sm">
              {error}
            </motion.div>
          )}

          <button type="submit" disabled={isLoading} className="btn-primary w-full mt-2">
            {isLoading ? 'CREATING…' : 'CREATE SURVIVOR'}
          </button>
        </form>

        <p className="text-center text-gray-600 text-sm font-body mt-6">
          Already registered?{' '}
          <Link to="/login" className="text-green-500 hover:text-green-400">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
