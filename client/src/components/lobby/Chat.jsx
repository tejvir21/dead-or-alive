/**
 * Chat — Real-time lobby chat using socket events
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useGameStore from '../../store/gameStore';
import useAuthStore from '../../store/authStore';
import { emit } from '../../socket/socketClient';

export default function Chat({ roomCode }) {
  const { chatMessages } = useGameStore();
  const { player } = useAuthStore();
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const send = () => {
    const msg = input.trim();
    if (!msg || !roomCode) return;
    emit.sendChat(roomCode, msg);
    setInput('');
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass-card flex flex-col h-80 lg:h-full min-h-[300px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <h3 className="font-display text-sm tracking-wider text-white">LOBBY CHAT</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
        {chatMessages.length === 0 && (
          <p className="font-mono text-xs text-gray-700 text-center mt-4">
            No messages yet. Say hello!
          </p>
        )}
        <AnimatePresence initial={false}>
          {chatMessages.map((msg, i) => (
            <motion.div
              key={`${msg.timestamp}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.username === player?.username ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <span className={`font-mono text-xs ${
                  msg.username === player?.username ? 'text-green-500/70' : 'text-gray-600'
                }`}>
                  {msg.username === player?.username ? 'You' : msg.username}
                </span>
                <span className="font-mono text-[10px] text-gray-700">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
              <div className={`px-3 py-1.5 rounded-lg text-sm font-body max-w-[80%] break-words ${
                msg.username === player?.username
                  ? 'bg-green-900/40 border border-green-800/50 text-green-100'
                  : 'bg-white/5 border border-white/5 text-gray-300'
              }`}>
                {msg.message}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-white/5 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          className="flex-1 bg-void-700 border border-white/10 focus:border-green-500/40
            text-white placeholder-gray-700 rounded px-3 py-2 text-sm font-body
            outline-none transition-colors"
          placeholder="Message…"
          maxLength={200}
        />
        <button
          onClick={send}
          disabled={!input.trim()}
          className="px-3 py-2 bg-green-800/50 border border-green-700/50 rounded
            text-green-300 text-sm font-mono hover:bg-green-700/50 transition-colors
            disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
