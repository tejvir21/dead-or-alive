/**
 * LobbyPage.jsx — Fixed navigation flow
 *
 * Bug: was navigating to /game/:roomCode directly after room creation.
 * roomStarted fires ~2s after gameStarted (server generates rooms async).
 * If GamePage isn't mounted yet when roomStarted fires, the event is lost
 * and the page stays on "LOADING ROOM..." forever.
 *
 * Fix: navigate to /waiting/:roomCode instead. WaitingRoomPage handles
 * the lobby/waiting state, then navigates to /game/:roomCode only after
 * the game actually starts — guaranteeing GamePage is mounted before
 * roomStarted fires.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { connectSocket, emit } from '../socket/socketClient';
import useGameStore from '../store/gameStore';
import useAuthStore from '../store/authStore';
import { apiJSON } from '../api/apiClient';

export default function LobbyPage() {
  const navigate = useNavigate();
  const { player } = useAuthStore();
  const { setRoomCode, updateSession } = useGameStore();

  const [lobbies, setLobbies]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [joinCode, setJoinCode]       = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [creating, setCreating]       = useState(false);
  const [maxPlayers, setMaxPlayers]   = useState(8);
  const [minPlayers, setMinPlayers]   = useState(1);
  const [curve, setCurve]             = useState('stepped');

  const intervalRef = useRef(null);
  const joinCodeRef = useRef(joinCode);
  useEffect(() => { joinCodeRef.current = joinCode; }, [joinCode]);

  const fetchLobbies = async () => {
    try {
      const data = await apiJSON('/game/lobbies');
      setLobbies(data.lobbies || []);
      setError('');
    } catch (err) {
      if (!/fetch|network/i.test(err.message)) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLobbies();
    intervalRef.current = setInterval(fetchLobbies, 10000);
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const onRoomCreated = ({ roomCode, session }) => {
      clearInterval(intervalRef.current);
      setRoomCode(roomCode);
      updateSession(session);
      // ✅ Navigate to WAITING room first, not game directly
      navigate(`/waiting/${roomCode}`);
    };

    const onJoinedRoom = ({ session }) => {
      clearInterval(intervalRef.current);
      const code = joinCodeRef.current.toUpperCase();
      setRoomCode(code);
      updateSession(session);
      // ✅ Navigate to WAITING room first, not game directly
      navigate(`/waiting/${code}`);
    };

    const onError = ({ message }) => {
      setError(message);
      setJoinLoading(false);
      setCreating(false);
    };

    socket.on('roomCreated', onRoomCreated);
    socket.on('joinedRoom',  onJoinedRoom);
    socket.on('error',       onError);
    return () => {
      socket.off('roomCreated', onRoomCreated);
      socket.off('joinedRoom',  onJoinedRoom);
      socket.off('error',       onError);
    };
  }, []);

  const handleCreateRoom = () => {
    setCreating(true); setError('');
    emit.createRoom({ maxPlayers: parseInt(maxPlayers), minPlayers: parseInt(minPlayers), difficultyCurve: curve });
  };

  const handleJoinRoom = () => {
    if (!joinCode.trim()) return;
    setJoinLoading(true); setError('');
    emit.joinRoom(joinCode.trim().toUpperCase());
  };

  const handleJoinFromList = (roomCode) => {
    setJoinCode(roomCode);
    joinCodeRef.current = roomCode;
    setJoinLoading(true); setError('');
    emit.joinRoom(roomCode);
  };

  const isVerifiedOrPro = player?.isVerified || (player?.subscription?.plan && player.subscription.plan !== 'free');

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <button
              onClick={() => navigate('/')}
              className="font-mono text-xs text-gray-700 hover:text-green-400 transition-colors flex items-center gap-1 mb-2"
            >
              ← HOME
            </button>
            <h1 className="font-display text-3xl font-bold text-green-400 tracking-wider uppercase">
              Game Lobby
            </h1>
            <p className="font-mono text-sm text-gray-500 mt-1">
              Signed in as <span className="text-green-400">{player?.username}</span>
              {player?.isVerified && (
                <span className="ml-2 text-xs text-yellow-400 border border-yellow-700 px-1.5 py-0.5 rounded">✓ VERIFIED</span>
              )}
              {player?.subscription?.plan === 'pro' && (
                <span className="ml-2 text-xs text-purple-400 border border-purple-700 px-1.5 py-0.5 rounded">✨ PRO</span>
              )}
              {player?.subscription?.plan === 'elite' && (
                <span className="ml-2 text-xs text-yellow-300 border border-yellow-600 px-1.5 py-0.5 rounded">⭐ ELITE</span>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            {player?.isAdmin && (
              <button onClick={() => navigate('/admin')}
                className="font-mono text-xs text-yellow-600 hover:text-yellow-400 border border-yellow-900 hover:border-yellow-700 px-3 py-1.5 rounded transition-colors">
                ⚙ ADMIN
              </button>
            )}
            <button
              onClick={() => useAuthStore.getState().logout().then(() => navigate('/'))}
              className="font-mono text-xs text-gray-600 hover:text-red-400 transition-colors">
              SIGN OUT
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-800 text-red-400 font-mono text-sm px-4 py-3 rounded">
            ⚠ {error}
          </div>
        )}

        {/* Create room */}
        <div className="glass-card p-6 space-y-5">
          <h2 className="font-mono text-sm text-gray-400 uppercase tracking-widest">Create Room</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="font-mono text-xs text-gray-600 uppercase block mb-1">Max Players</label>
              <select value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} className="input-field text-sm w-full">
                {[2,4,6,8,10,12,14,16].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="font-mono text-xs text-gray-600 uppercase block mb-1">Min Players</label>
              <select value={minPlayers} onChange={e => setMinPlayers(e.target.value)} className="input-field text-sm w-full">
                {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="font-mono text-xs text-gray-600 uppercase block mb-1">Difficulty Curve</label>
              <select value={curve} onChange={e => setCurve(e.target.value)} className="input-field text-sm w-full">
                <option value="gentle">Gentle</option>
                <option value="balanced">Balanced</option>
                <option value="stepped">Stepped (default)</option>
                <option value="ascending_fast">Ascending Fast</option>
                {isVerifiedOrPro && <>
                  <option value="spike">Spike</option>
                  <option value="nightmare">Nightmare</option>
                  <option value="expert">Expert</option>
                  <option value="random">Random</option>
                </>}
              </select>
            </div>
          </div>
          <button onClick={handleCreateRoom} disabled={creating}
            className="btn-primary w-full disabled:opacity-50">
            {creating ? 'CREATING…' : '+ CREATE ROOM'}
          </button>
        </div>

        {/* Join by code */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="font-mono text-sm text-gray-400 uppercase tracking-widest">Join by Code</h2>
          <div className="flex gap-3">
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
              placeholder="Enter room code…"
              maxLength={6}
              className="input-field flex-1 font-mono text-lg tracking-widest uppercase"
            />
            <button onClick={handleJoinRoom} disabled={!joinCode.trim() || joinLoading}
              className="btn-primary px-8 disabled:opacity-50">
              {joinLoading ? '…' : 'JOIN'}
            </button>
          </div>
        </div>

        {/* Open lobbies */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm text-gray-400 uppercase tracking-widest">Open Lobbies</h2>
            <button onClick={fetchLobbies}
              className="font-mono text-xs text-gray-600 hover:text-green-400 transition-colors">
              ↻ REFRESH
            </button>
          </div>

          {loading ? (
            <p className="font-mono text-xs text-gray-700 text-center py-8">Loading…</p>
          ) : lobbies.length === 0 ? (
            <p className="font-mono text-xs text-gray-700 text-center py-8">No open rooms — create one!</p>
          ) : lobbies.map(lobby => (
            <motion.div key={lobby._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-green-400 text-lg font-bold tracking-widest">
                    {lobby.roomCode}
                  </span>
                  <span className="font-mono text-xs text-gray-600 border border-gray-800 px-2 py-0.5 rounded">
                    {lobby.mode || 'solo'}
                  </span>
                  <span className="font-mono text-xs text-gray-600">
                    {lobby.difficultyCurve || 'stepped'}
                  </span>
                </div>
                <p className="font-mono text-xs text-gray-600 mt-1">
                  Host: <span className="text-gray-400">{lobby.createdBy?.username || '—'}</span>
                  {' · '}
                  {lobby.players?.length || 0}/{lobby.maxPlayers} players
                </p>
              </div>
              <button onClick={() => handleJoinFromList(lobby.roomCode)}
                className="btn-secondary text-sm">
                JOIN →
              </button>
            </motion.div>
          ))}
        </div>

      </div>
    </div>
  );
}
