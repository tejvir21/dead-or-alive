/**
 * GamePage — Main game screen, renders different phases
 */
import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import useGameStore from '../store/gameStore';
import useAuthStore from '../store/authStore';
import { getSocket, emit } from '../socket/socketClient';

import PuzzleRoomPhase from '../components/game/PuzzleRoomPhase';
import DoorSelectionPhase from '../components/game/DoorSelectionPhase';
import ResultRevealPhase from '../components/game/ResultRevealPhase';
import GameEndScreen from '../components/game/GameEndScreen';
import TransitionPhase from '../components/game/TransitionPhase';
import PlayerStatusBar from '../components/game/PlayerStatusBar';
import RoomProgressBar from '../components/game/RoomProgressBar';

export default function GamePage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { player } = useAuthStore();
  const {
    roundPhase, session, currentRoom, gameEndData, currentRoomIndex, totalRooms,
    resetGame, clearCountdown, startTimer, clearRoundState, stopTimer,
  } = useGameStore();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) { navigate('/lobby'); return; }

    // Clear countdown overlay now that we've navigated
    clearCountdown();

    // Only send joinRoom if we have no active session for this room
    // (avoids double-join when navigating from WaitingRoomPage which already joined)
    const currentRoomCode = useGameStore.getState().roomCode;
    if (!currentRoomCode || currentRoomCode !== roomCode.toUpperCase()) {
      emit.joinRoom(roomCode);
    }

    // Re-listen to roomStarted here too — catches events fired while navigating
    const onRoomStarted = (roomData) => {
      clearRoundState();
      stopTimer();
      useGameStore.setState({
        currentRoom: roomData,
        roundPhase: 'puzzle',
        currentRoomIndex: (roomData.roomNumber || 1) - 1,
        totalRooms: roomData.totalRooms || useGameStore.getState().totalRooms,
      });
      startTimer(roomData.timerSeconds || 30);
    };

    socket.on('roomStarted', onRoomStarted);
    return () => socket.off('roomStarted', onRoomStarted);
  }, [roomCode]);

  const handleGoLobby = () => {
    resetGame();
    navigate('/lobby');
  };

  const players = session?.players || [];
  const myPlayer = players.find(p => p.username === player?.username);
  const isEliminated = myPlayer && !myPlayer.alive;

  // Game over
  if (gameEndData) {
    return <GameEndScreen data={gameEndData} onLobby={handleGoLobby} playerUsername={player?.username} />;
  }

  return (
    <div className="min-h-screen bg-void-900 flex flex-col">
      <div
        className="fixed inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,255,136,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Room progress bar */}
      <RoomProgressBar current={currentRoomIndex + 1} total={totalRooms} roomCode={roomCode} />

      {/* Player status */}
      <PlayerStatusBar players={players} myUsername={player?.username} />

      {/* Eliminated overlay */}
      {isEliminated && roundPhase !== 'reveal' && roundPhase !== 'idle' && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className="absolute inset-0 border-4 border-red-600/60 animate-pulse-red" />
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-900/80 border border-red-600 rounded px-6 py-3">
            <p className="font-display text-lg tracking-wider text-red-300">YOU HAVE BEEN ELIMINATED</p>
            <p className="font-mono text-xs text-red-500 text-center">Spectating…</p>
          </div>
        </div>
      )}

      {/* Phase renderer */}
      <div className="relative z-10 flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {roundPhase === 'puzzle' && (
            <PuzzleRoomPhase key="puzzle" room={currentRoom} roomCode={roomCode} />
          )}
          {roundPhase === 'door_selection' && (
            <DoorSelectionPhase key="doors" room={currentRoom} roomCode={roomCode} />
          )}
          {roundPhase === 'reveal' && (
            <ResultRevealPhase key="reveal" roomCode={roomCode} />
          )}
          {roundPhase === 'transition' && (
            <TransitionPhase key="transition" nextRoom={currentRoomIndex + 2} />
          )}
          {roundPhase === 'idle' && !gameEndData && (
            <div key="idle" className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-10 h-10 border-2 border-green-500/50 border-t-green-500 rounded-full animate-spin mx-auto" />
                <div className="font-mono text-xs text-gray-600">LOADING ROOM…</div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

