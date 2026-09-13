/**
 * TeamScoreboard.jsx — Vs-mode team status bar (shown during gameplay)
 * Shows each team's alive count and elimination status at a glance.
 */
import React from 'react';

const TEAM_COLORS = {
  A: { bg: 'bg-blue-950/40',   border: 'border-blue-700',   text: 'text-blue-400' },
  B: { bg: 'bg-red-950/40',    border: 'border-red-700',    text: 'text-red-400' },
  C: { bg: 'bg-purple-950/40', border: 'border-purple-700', text: 'text-purple-400' },
  D: { bg: 'bg-yellow-950/40', border: 'border-yellow-700', text: 'text-yellow-400' },
};

export default function TeamScoreboard({ teams = [], myTeamId }) {
  if (!teams.length) return null;

  return (
    <div className="flex gap-2 px-4 py-2 overflow-x-auto border-b border-white/5">
      {teams.map(team => {
        const colors = TEAM_COLORS[team.id] || TEAM_COLORS.A;
        const isEliminated = team.eliminatedAt !== null && team.eliminatedAt !== undefined;
        const isMine = team.id === myTeamId;
        return (
          <div key={team.id}
            className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isEliminated ? 'border-gray-800 bg-gray-900/50 opacity-50' : `${colors.bg} ${colors.border}`} ${isMine ? 'ring-1 ring-white/30' : ''}`}>
            <span className={`font-mono text-xs font-bold ${isEliminated ? 'text-gray-600 line-through' : colors.text}`}>
              Team {team.id}{isMine && ' (you)'}
            </span>
            <span className="font-mono text-[10px] text-gray-400">
              {isEliminated ? '💀 OUT' : `${team.aliveCount} alive`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
