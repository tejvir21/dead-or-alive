/**
 * GamePage.jsx — Updated
 * FIX: canSpectate flag threaded from server through to EliminatedOverlay
 * so solo-player games don't offer a meaningless "spectate" option.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { connectSocket, emit } from '../socket/socketClient';
import useGameStore from '../store/gameStore';
import useAuthStore from '../store/authStore';

import PuzzleRoomPhase    from '../components/game/PuzzleRoomPhase';
import DoorSelectionPhase from '../components/game/DoorSelectionPhase';
import ResultRevealPhase  from '../components/game/ResultRevealPhase';
import GameEndScreen      from '../components/game/GameEndScreen';
import PlayerStatusBar    from '../components/game/PlayerStatusBar';
import RoomProgressBar    from '../components/game/RoomProgressBar';
import TransitionPhase    from '../components/game/TransitionPhase';
import EliminatedOverlay  from '../components/game/EliminatedOverlay';

export default function GamePage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  const { player } = useAuthStore();
  const session          = useGameStore(s => s.session);
  const currentRoom      = useGameStore(s => s.currentRoom);
  const roundPhase       = useGameStore(s => s.roundPhase);
  const timerSeconds     = useGameStore(s => s.timerSeconds);
  const totalRooms       = useGameStore(s => s.totalRooms);
  const currentRoomIndex = useGameStore(s => s.currentRoomIndex);
  const roundResults     = useGameStore(s => s.roundResults);
  const gameEndData      = useGameStore(s => s.gameEndData);
  const chosenCount      = useGameStore(s => s.chosenCount);
  const totalAlive       = useGameStore(s => s.totalAlive);

  const code = (roomCode || '').toUpperCase();
  const hasJoinedRef = useRef(false);
  const [loading, setLoading] = useState(false);

  const [eliminationData, setEliminationData] = useState(null); // { correctDoor, chosenDoor, canSpectate }
  const [isSpectating, setIsSpectating] = useState(false);
  const [kickedInfo, setKickedInfo] = useState(null);

  useEffect(() => {
    if (!code || hasJoinedRef.current) return;
    hasJoinedRef.current = true;
    useGameStore.getState().setRoomCode?.(code);
    const hasSession = !!useGameStore.getState().session;
    if (hasSession) { setLoading(false); return; }
    setLoading(true);
    const socket = connectSocket();
    if (!socket) return;
    const doJoin = () => emit.joinRoom(code);
    if (socket.connected) doJoin();
    else socket.once('connect', doJoin);
  }, [code]);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const onJoined = ({ session: s }) => { if (s) useGameStore.getState().updateSession?.(s); setLoading(false); };
    const onReconnected = ({ session: s }) => { if (s) useGameStore.getState().updateSession?.(s); setLoading(false); };

    const onRoomStarted = (roomData) => {
      setLoading(false);
      useGameStore.getState().clearRoundState?.();
      useGameStore.getState().stopTimer?.();
      useGameStore.setState({
        currentRoom: roomData, roundPhase: 'puzzle',
        currentRoomIndex: (roomData.roomNumber || 1) - 1,
        totalRooms: roomData.totalRooms || totalRooms,
        chosenCount: 0, totalAlive: 0,
      });
      useGameStore.getState().startTimer?.(roomData.timerSeconds || 30);
    };

    const onSpectatorRoomStarted = (roomData) => {
      useGameStore.getState().stopTimer?.();
      useGameStore.setState({ currentRoom: roomData, roundPhase: 'puzzle', chosenCount: 0, totalAlive: 0 });
      useGameStore.getState().startTimer?.(roomData.timerSeconds || 30);
    };

    const onDoorSelection = ({ timerSeconds: t }) => {
      useGameStore.getState().stopTimer?.();
      useGameStore.setState({ roundPhase: 'door_selection', chosenCount: 0 });
      useGameStore.getState().startTimer?.(t || 30);
    };

    const onPlayerSkipped = ({ username }) => {
      useGameStore.getState().showNotification?.(`${username} is ready to choose`, 'info');
    };

    const onChoiceUpdate = ({ chosenCount: cc, totalAlive: ta }) => {
      useGameStore.setState({ chosenCount: cc, totalAlive: ta });
    };

    const onTimerReduced = ({ reduction, by }) => {
      useGameStore.setState(s => ({ timerSeconds: Math.max(1, (s.timerSeconds || 30) - reduction) }));
      useGameStore.getState().showNotification?.(`⚡ ${by} chose early — ${reduction}s removed!`, 'warning');
    };

    const onRoundResult = (data) => {
      useGameStore.getState().stopTimer?.();
      if (data.session) useGameStore.getState().updateSession?.(data.session);
      useGameStore.setState({ roundPhase: 'reveal' });
      useGameStore.getState().setRoundResults?.(data);
    };

    // ── FIX: capture canSpectate from server and pass through to overlay ────────
    const onYouWereEliminated = ({ correctDoor, chosenDoor, canSpectate }) => {
      setEliminationData({ correctDoor, chosenDoor, canSpectate: canSpectate !== false });
    };

    const onPlayerEliminated = ({ username }) => {
      useGameStore.getState().showNotification?.(`💀 ${username} was eliminated!`, 'error');
    };

    const onNextRoom = () => { useGameStore.setState({ roundPhase: 'transition' }); };

    const onGameEnd = (data) => {
      useGameStore.getState().stopTimer?.();
      useGameStore.getState().setGameEndData?.(data);
      useGameStore.setState({ roundPhase: 'game_end' });
      setEliminationData(null);
    };

    const onYouWereKicked = ({ reason }) => { setKickedInfo({ reason }); };
    const onPlayerKicked = ({ session: s }) => { if (s) useGameStore.getState().updateSession?.(s); };

    const onSpectatingAsEliminated = ({ session: s }) => {
      if (s) useGameStore.getState().updateSession?.(s);
      setIsSpectating(true);
      setEliminationData(null);
    };

    // If server rejects a solo-game spectate attempt, just go to lobby
    const onError = ({ message }) => {
      useGameStore.getState().showNotification?.(message, 'error');
      if (/solo game/i.test(message || '')) navigateRef.current('/lobby');
    };

    socket.on('joinedRoom', onJoined);
    socket.on('joinedAsSpectator', onJoined);
    socket.on('reconnected', onReconnected);
    socket.on('roomStarted', onRoomStarted);
    socket.on('spectatorRoomStarted', onSpectatorRoomStarted);
    socket.on('doorSelectionStarted', onDoorSelection);
    socket.on('playerSkippedToDoor', onPlayerSkipped);
    socket.on('choiceUpdate', onChoiceUpdate);
    socket.on('timerReduced', onTimerReduced);
    socket.on('roundResult', onRoundResult);
    socket.on('youWereEliminated', onYouWereEliminated);
    socket.on('playerEliminated', onPlayerEliminated);
    socket.on('nextRoom', onNextRoom);
    socket.on('gameEnd', onGameEnd);
    socket.on('youWereKicked', onYouWereKicked);
    socket.on('playerKicked', onPlayerKicked);
    socket.on('spectatingAsEliminated', onSpectatingAsEliminated);
    socket.on('error', onError);

    if (currentRoom) setLoading(false);

    return () => {
      socket.off('joinedRoom', onJoined);
      socket.off('joinedAsSpectator', onJoined);
      socket.off('reconnected', onReconnected);
      socket.off('roomStarted', onRoomStarted);
      socket.off('spectatorRoomStarted', onSpectatorRoomStarted);
      socket.off('doorSelectionStarted', onDoorSelection);
      socket.off('playerSkippedToDoor', onPlayerSkipped);
      socket.off('choiceUpdate', onChoiceUpdate);
      socket.off('timerReduced', onTimerReduced);
      socket.off('roundResult', onRoundResult);
      socket.off('youWereEliminated', onYouWereEliminated);
      socket.off('playerEliminated', onPlayerEliminated);
      socket.off('nextRoom', onNextRoom);
      socket.off('gameEnd', onGameEnd);
      socket.off('youWereKicked', onYouWereKicked);
      socket.off('playerKicked', onPlayerKicked);
      socket.off('spectatingAsEliminated', onSpectatingAsEliminated);
      socket.off('error', onError);
    };
  }, [code, player?.username]);

  const handleChooseDoor = (door) => emit.chooseDoor(code, door);
  const handleSkipToDoor = () => emit.skipToDoor(code);
  const handleSpectate = () => connectSocket()?.emit('spectateAfterElimination', { roomCode: code });
  const handleGoToLobby = () => navigate('/lobby');

  if (kickedInfo) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-sm">
          <div className="text-6xl">🚪</div>
          <h1 className="font-display text-3xl font-bold text-red-400">Removed from Room</h1>
          <p className="font-mono text-sm text-gray-500">{kickedInfo.reason}</p>
          <button onClick={() => navigate('/lobby')} className="btn-primary px-8 py-3">← Back to Lobby</button>
        </div>
      </div>
    );
  }

  if (roundPhase === 'game_end' && gameEndData) {
    return <GameEndScreen data={gameEndData} player={player} onLobby={() => navigate('/lobby')} />;
  }

  const players = session?.players || [];
  const aliveCount = players.filter(p => p.alive !== false).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      <AnimatePresence>
        {eliminationData && (
          <EliminatedOverlay
            correctDoor={eliminationData.correctDoor}
            chosenDoor={eliminationData.chosenDoor}
            canSpectate={eliminationData.canSpectate}
            onSpectate={handleSpectate}
            onLobby={handleGoToLobby}
          />
        )}
      </AnimatePresence>

      {isSpectating && (
        <div className="bg-purple-950/50 border-b border-purple-800 px-4 py-2 text-center">
          <p className="font-mono text-xs text-purple-300">👁 SPECTATING — you were eliminated. Clue details are hidden.</p>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-green-400 font-bold tracking-widest">{code}</span>
          <div className="flex gap-1.5">
            {players.map(p => (
              <span key={p.id || p.username}
                className={`w-2.5 h-2.5 rounded-full ${p.alive !== false ? 'bg-green-500' : 'bg-red-800'}`}
                title={p.username}/>
            ))}
          </div>
        </div>
        <RoomProgressBar current={currentRoomIndex + 1} total={totalRooms || session?.totalRooms || 0} />
      </div>

      <PlayerStatusBar players={players} currentUsername={player?.username} />

      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {(loading || (!currentRoom && !['reveal','game_end','transition'].includes(roundPhase))) && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              <p className="font-mono text-xs text-gray-600 uppercase tracking-wider">Loading room…</p>
            </motion.div>
          )}

          {!loading && currentRoom && roundPhase === 'puzzle' && (
            <motion.div key="puzzle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
              <PuzzleRoomPhase room={currentRoom} timerSeconds={timerSeconds} />
              {!isSpectating && (
                <div className="flex justify-center pb-6">
                  <button onClick={handleSkipToDoor}
                    className="font-mono text-xs text-gray-600 hover:text-green-400 border border-gray-800 hover:border-green-800 px-4 py-2 rounded transition-colors">
                    I've decided → Skip to door selection
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {!loading && currentRoom && roundPhase === 'door_selection' && (
            <motion.div key="door" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
              {isSpectating ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="font-mono text-sm text-gray-600">Waiting for players to choose…</p>
                </div>
              ) : (
                <DoorSelectionPhase
                  room={currentRoom} timerSeconds={timerSeconds} onChoose={handleChooseDoor}
                  chosenCount={chosenCount} totalAlive={totalAlive || aliveCount}
                />
              )}
            </motion.div>
          )}

          {roundPhase === 'reveal' && roundResults && (
            <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
              <ResultRevealPhase results={roundResults} player={player} />
            </motion.div>
          )}

          {roundPhase === 'transition' && (
            <motion.div key="transition" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center">
              <TransitionPhase nextRoom={currentRoomIndex + 2} alivePlayers={aliveCount} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
