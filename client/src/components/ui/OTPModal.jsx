/**
 * OTPModal.jsx
 * Send + verify OTP for email or phone (WhatsApp / SMS)
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiJSON } from '../../api/apiClient';

export default function OTPModal({ type, channel, onClose, onVerified }) {
  const [step, setStep]       = useState('send');    // send | verify
  const [code, setCode]       = useState(['','','','','','']);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError]     = useState('');
  const inputRefs = useRef([]);

  const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : channel === 'sms' ? 'SMS' : 'Email';
  const typeLabel    = type === 'email' ? 'email address' : 'phone number';

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const sendOTP = async () => {
    setSending(true); setError('');
    try {
      await apiJSON('/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ type, channel }),
      });
      setStep('verify');
      setCountdown(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleDigit = (i, val) => {
    const digits = val.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[i] = digits;
    setCode(next);
    if (digits && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const verifyOTP = async () => {
    const otp = code.join('');
    if (otp.length < 6) { setError('Enter the complete 6-digit code'); return; }
    setVerifying(true); setError('');
    try {
      await apiJSON('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ code: otp, type }),
      });
      onVerified?.();
    } catch (err) {
      setError(err.message);
      setCode(['','','','','','']);
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative z-10 w-full max-w-sm glass-card p-6 space-y-5"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              Verify {type === 'email' ? 'Email' : 'Phone'}
            </h2>
            <p className="font-mono text-xs text-gray-500 mt-1">
              {step === 'send'
                ? `We'll send a code to your ${typeLabel} via ${channelLabel}`
                : `Enter the 6-digit code sent via ${channelLabel}`
              }
            </p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-xl leading-none">×</button>
        </div>

        {error && (
          <p className="font-mono text-xs text-red-400 bg-red-950/30 border border-red-800 px-3 py-2 rounded">
            ⚠ {error}
          </p>
        )}

        <AnimatePresence mode="wait">
          {step === 'send' ? (
            <motion.div key="send" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <button onClick={sendOTP} disabled={sending}
                className="btn-primary w-full disabled:opacity-50">
                {sending ? 'SENDING…' : `SEND ${channelLabel.toUpperCase()} CODE`}
              </button>
            </motion.div>
          ) : (
            <motion.div key="verify" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-4">

              {/* 6-digit input */}
              <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                {code.map((d, i) => (
                  <input
                    key={i}
                    ref={el => inputRefs.current[i] = el}
                    value={d}
                    onChange={e => handleDigit(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    maxLength={1}
                    inputMode="numeric"
                    className="w-11 h-14 text-center font-mono text-xl font-bold bg-gray-900 border-2 border-gray-700 focus:border-green-500 rounded-lg outline-none text-white transition-colors"
                  />
                ))}
              </div>

              <button onClick={verifyOTP}
                disabled={verifying || code.join('').length < 6}
                className="btn-primary w-full disabled:opacity-50">
                {verifying ? 'VERIFYING…' : 'VERIFY CODE'}
              </button>

              <div className="text-center">
                {countdown > 0 ? (
                  <p className="font-mono text-xs text-gray-600">
                    Resend in {countdown}s
                  </p>
                ) : (
                  <button onClick={() => { setCode(['','','','','','']); setStep('send'); }}
                    className="font-mono text-xs text-green-400 hover:text-green-300 transition-colors">
                    Resend code
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
