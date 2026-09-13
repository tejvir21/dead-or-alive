/**
 * GameEndScreen.jsx — Phase 4: team-aware results
 *
 * Shows team-based results for co-op/vs modes (which team won, per-team
 * scoreboard) alongside the existing solo-mode individual results.
 */
import React from "react";
import { motion } from "framer-motion";

const TEAM_COLORS = {
  A: { text: "text-blue-400", border: "border-blue-700" },
  B: { text: "text-red-400", border: "border-red-700" },
  C: { text: "text-purple-400", border: "border-purple-700" },
  D: { text: "text-yellow-400", border: "border-yellow-700" },
};

export default function GameEndScreen({ data = {}, player, onLobby }) {
  const winners = data.winners || [];
  const allPlayers = data.allPlayers || [];
  const totalRooms = data.totalRooms || 0;
  const mode = data.mode || "solo";
  const teams = data.teams || [];
  const winningTeamId = data.winningTeamId;
  const isTeamMode = mode === "coop" || mode === "vs";

  const isWinner = winners.some(
    (w) => w.toLowerCase() === (player?.username || "").toLowerCase(),
  );
  const myTeamId = allPlayers.find(
    (p) => p.username?.toLowerCase() === (player?.username || "").toLowerCase(),
  )?.teamId;
  const myTeamWon = isTeamMode && myTeamId === winningTeamId;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-8 text-center">
        {data.isClanBattleRun && (
          <div className="bg-orange-950/30 border border-orange-800 rounded-lg p-3 mb-4">
            <p className="font-mono text-xs text-orange-400">
              ⚔ This was a clan battle run — your score has been submitted to
              your clan's tally. The winner is decided once the battle window
              closes.
            </p>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
        >
          {(isTeamMode ? myTeamWon : isWinner) ? (
            <>
              <div className="text-7xl mb-4">🏆</div>
              <h1 className="font-display text-6xl font-black text-green-400 drop-shadow-[0_0_30px_rgba(74,222,128,0.6)]">
                {mode === "vs" ? "VICTORY" : "ESCAPED"}
              </h1>
              <p className="font-mono text-sm text-green-600 mt-2 uppercase tracking-widest">
                {mode === "vs"
                  ? `Team ${winningTeamId} wins!`
                  : mode === "coop"
                    ? "Your team escaped together!"
                    : `You survived all ${totalRooms} rooms!`}
              </p>
            </>
          ) : (
            <>
              <div className="text-7xl mb-4">💀</div>
              <h1 className="font-display text-6xl font-black text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.6)]">
                {mode === "vs" ? "DEFEATED" : "ELIMINATED"}
              </h1>
              <p className="font-mono text-sm text-gray-600 mt-2">
                {mode === "vs" && winningTeamId
                  ? `Team ${winningTeamId} won this match.`
                  : mode === "coop"
                    ? "Your team was eliminated."
                    : winners.length > 0
                      ? `${winners.length} player(s) escaped. Better luck next time.`
                      : "All players eliminated. Nobody escaped."}
              </p>
            </>
          )}
        </motion.div>

        {/* Vs-mode team scoreboard */}
        {mode === "vs" && teams.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-5 text-left space-y-3"
          >
            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">
              ⚔ Team Results
            </h2>
            <div className="space-y-2">
              {[...teams]
                .sort(
                  (a, b) =>
                    (b.id === winningTeamId ? 1 : 0) -
                    (a.id === winningTeamId ? 1 : 0),
                )
                .map((team) => {
                  const colors = TEAM_COLORS[team.id] || TEAM_COLORS.A;
                  const won = team.id === winningTeamId;
                  return (
                    <div
                      key={team.id}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg border ${won ? "bg-green-950/20 border-green-700" : "bg-gray-900/50 border-gray-800"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-sm font-bold ${colors.text}`}
                        >
                          Team {team.id}
                        </span>
                        {won && (
                          <span className="font-mono text-[10px] text-green-400 border border-green-700 px-1.5 rounded">
                            WINNER
                          </span>
                        )}
                        {team.eliminatedAt !== null &&
                          team.eliminatedAt !== undefined && (
                            <span className="font-mono text-[10px] text-red-500">
                              Eliminated at room {team.eliminatedAt + 1}
                            </span>
                          )}
                      </div>
                      <span className="font-mono text-xs text-gray-400">
                        Score: {team.roomsSurvivedScore}
                      </span>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}

        {/* Co-op / solo: survivors list */}
        {mode !== "vs" && winners.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-5 text-left space-y-3"
          >
            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest flex items-center gap-2">
              🏆 Survivors
            </h2>
            <div className="flex flex-wrap gap-2">
              {winners.map((name) => (
                <span
                  key={name}
                  className={`font-mono text-sm px-3 py-1.5 rounded border font-bold uppercase ${name.toLowerCase() === (player?.username || "").toLowerCase() ? "bg-green-900/50 border-green-500 text-green-300" : "bg-gray-900 border-gray-700 text-gray-300"}`}
                >
                  {name}
                  {name.toLowerCase() ===
                    (player?.username || "").toLowerCase() && " ← you"}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Final standings (individual) */}
        {allPlayers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card p-5 text-left space-y-3"
          >
            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">
              Final Standings
            </h2>
            <div className="space-y-2">
              {[...allPlayers]
                .sort((a, b) => b.roomsSurvived - a.roomsSurvived)
                .map((p, i) => {
                  const isMe =
                    p.username?.toLowerCase() ===
                    (player?.username || "").toLowerCase();
                  const survived = winners.some(
                    (w) => w.toLowerCase() === p.username?.toLowerCase(),
                  );
                  const colors = p.teamId
                    ? TEAM_COLORS[p.teamId] || TEAM_COLORS.A
                    : null;
                  return (
                    <div
                      key={p.username}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg border ${isMe ? "bg-green-950/30 border-green-800" : "bg-gray-900/50 border-gray-800"}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-gray-600 w-6">
                          #{i + 1}
                        </span>
                        <span
                          className={`font-mono text-sm font-bold ${isMe ? "text-green-400" : "text-white"}`}
                        >
                          {p.username}
                        </span>
                        {p.teamId && (
                          <span
                            className={`font-mono text-[10px] ${colors.text}`}
                          >
                            T{p.teamId}
                          </span>
                        )}
                        {survived && (
                          <span className="font-mono text-[10px] text-green-500 border border-green-800 px-1.5 rounded">
                            SURVIVED
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-display text-lg font-bold text-white">
                          {p.roomsSurvived}
                        </span>
                        <span className="font-mono text-xs text-gray-600 ml-1">
                          / {totalRooms} rooms
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex gap-4 justify-center"
        >
          <button onClick={onLobby} className="btn-primary px-8 py-3">
            ← Back to Lobby
          </button>
        </motion.div>
      </div>
    </div>
  );
}
