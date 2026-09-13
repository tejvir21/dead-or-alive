/**
 * TeamChat.jsx — Team-only chat panel (co-op / vs modes)
 * Separate channel from room-wide chat — only teammates see these messages.
 */
import React, { useState, useEffect, useRef } from 'react';
import { connectSocket } from '../../socket/socketClient';

export default function TeamChat({ roomCode, teamId, currentUsername }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;
    const onMsg = (msg) => setMessages(prev => [...prev.slice(-99), msg]);
    socket.on('teamChatMessage', onMsg);
    return () => socket.off('teamChatMessage', onMsg);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    connectSocket()?.emit('teamChatMessage', { roomCode, message: input.trim() });
    setInput('');
  };

  if (!teamId) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-30 bg-gray-950 border border-cyan-900 rounded-lg shadow-xl transition-all ${collapsed ? 'w-40' : 'w-72'}`}>
      <button onClick={() => setCollapsed(c => !c)} className="w-full px-3 py-2 flex items-center justify-between border-b border-cyan-900/50">
        <span className="font-mono text-[10px] text-cyan-400 uppercase tracking-wider">🤝 Team {teamId} Chat</span>
        <span className="text-gray-600 text-xs">{collapsed ? '▲' : '▼'}</span>
      </button>
      {!collapsed && (
        <>
          <div ref={scrollRef} className="h-40 overflow-y-auto px-3 py-2 space-y-1.5">
            {messages.length === 0 ? (
              <p className="font-mono text-[10px] text-gray-700">No messages yet — say hi to your team!</p>
            ) : messages.map((m, i) => (
              <div key={i}>
                <span className={`font-mono text-[10px] ${m.username === currentUsername ? 'text-cyan-400' : 'text-gray-400'}`}>{m.username}:</span>
                <span className="font-mono text-[10px] text-gray-300 ml-1 break-words">{m.message}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-1 p-2 border-t border-cyan-900/50">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Message team…" maxLength={200} className="input-field text-[10px] flex-1 py-1.5"/>
            <button onClick={send} className="font-mono text-[10px] text-cyan-400 border border-cyan-800 px-2 rounded">→</button>
          </div>
        </>
      )}
    </div>
  );
}
