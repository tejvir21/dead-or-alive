# 💀 Dead or Alive: Logic Escape (Updated)

> Real-time multiplayer survival puzzle — 3–8 players, procedural rooms, two doors, one escape.

![Players](https://img.shields.io/badge/Players-1--8-green) ![Stack](https://img.shields.io/badge/Stack-React%20%2B%20Node%20%2B%20Socket.io-blue) ![DB](https://img.shields.io/badge/DB-MongoDB-green)

---

Latest update: 2026-07-18 — documentation refresh, clarified admin setup, anti-cheat notes, and quick changelog.

---

## Quick Start

Clone, install dependencies, create env files, and seed DB:

```bash
git clone https://github.com/tejvir21/dead-or-alive.git dead-or-alive
cd dead-or-alive
bash setup.sh
```

Run the server and client in two terminals:

Terminal 1 — server (development)
```bash
cd server
npm run dev
```

Terminal 2 — client (Vite)
```bash
cd client
npm run dev
# → http://localhost:5173
```

Docker (dev/prod)
```bash
# Development
docker compose up --build

# Production (create .env first)
docker compose up -d --build

# Seed after first boot
docker exec doa-server node utils/seedClues.js
```

---

## Table of Contents

- Overview
- Tech Stack
- Project Structure
- Environment Variables
- Admin System
- API Reference
- Socket Events
- Game Architecture
- Clue System
- Docker Deployment
- Anti-Cheat Design
- Changelog
- License

---

## Overview

Players join a lobby, enter a procedurally generated building, and navigate puzzle rooms. Each room shows a logic clue. Two doors: LIVE and DIE. Only one is correct. Wrong choice = elimination. Survive all rooms to escape.

Flow:
Login → Lobby → Create/Join Room → Waiting Room → Countdown →
[Puzzle (30s) → Door Selection (30s) → Reveal → Next Room] × N → Game End → Leaderboard

---

## Tech Stack

- Frontend: React 18 + Vite, TailwindCSS, Framer Motion  
- State: Zustand (persisted auth, ephemeral game)  
- Realtime: Socket.io (client + server)  
- Backend: Node.js + Express.js  
- Database: MongoDB + Mongoose  
- Auth: JWT (bcrypt), env-based admin IDs  
- Deploy: Docker Compose + Nginx

---

## Project Structure

Top-level layout (abridged):

```
dead-or-alive/
├── setup.sh
├── docker-compose.yml
│
├── client/                           ← React (Vite) frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── LoginPage.jsx / RegisterPage.jsx
│   │   │   ├── LobbyPage.jsx         ← Create / join / browse rooms
│   │   │   ├── WaitingRoomPage.jsx   ← Pre-game lobby + ready system
│   │   │   ├── GamePage.jsx          ← Phase orchestrator
│   │   │   ├── ProfilePage.jsx       ← Stats + match history
│   │   │   ├── LeaderboardPage.jsx
│   │   │   ├── AdminPage.jsx         ← Clue management (admin only)
│   │   │   └── NotFoundPage.jsx
│   │   ├── components/
│   │   │   ├── game/
│   │   │   │   ├── PuzzleRoomPhase.jsx    ← Clue display
│   │   │   │   ├── DoorSelectionPhase.jsx ← LIVE/DIE choice
│   │   │   │   ├── ResultRevealPhase.jsx  ← Per-player results
│   │   │   │   ├── GameEndScreen.jsx      ← Final standings
│   │   │   │   ├── TransitionPhase.jsx
│   │   │   │   ├── PlayerStatusBar.jsx
│   │   │   │   └── RoomProgressBar.jsx
│   │   │   ├── lobby/
│   │   │   │   └── Chat.jsx               ← Real-time lobby chat
│   │   │   └── ui/
│   │   │       ├── Timer.jsx              ← Circular countdown
│   │   │       └── Notification.jsx       ← Toast system
│   │   ├── socket/socketClient.js    ← Singleton + all event handlers
│   │   ├── store/
│   │   │   ├── authStore.js          ← Zustand (persisted)
│   │   │   └── gameStore.js          ← Zustand (ephemeral)
│   │   └── App.jsx
│   └── ...config files
│
└── server/                           ← Node.js backend
    ├── index.js                      ← Express + Socket.io entry
    ├── middleware/auth.js            ← JWT + ADMIN_IDS guard
    ├── models/
    │   ├── Player.js                 ← Auth, stats, clue memory
    │   ├── Clue.js                   ← Template-based clue pool
    │   └── Match.js                  ← Full match history
    ├── routes/
    │   ├── auth.js                   ← /api/auth
    │   ├── game.js                   ← /api/game
    │   ├── clues.js                  ← /api/clues (admin)
    │   ├── stats.js                  ← /api/stats
    │   │   └── admin.js               ← /api/admin
    ├── socket/socketHandlers.js      ← Full game engine
    └── utils/
        ├── roomGenerator.js          ← Procedural room generation
        └── seedClues.js              ← DB seed (30+ clues)
```

---

## Environment Variables

server/.env (example)
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/dead-or-alive
JWT_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
NODE_ENV=development

# Admin IDs: comma-separated MongoDB player _id values
ADMIN_IDS=
```

client/.env (example)
```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

Notes:
- `ADMIN_IDS` is the recommended quickest way to grant admin access; values are MongoDB ObjectId strings.
- Restart the server after changing server/.env for env-based admin grants to take effect.

---

## Admin System

How to become an admin:

Method 1 — Env var (recommended)
1. Register via UI.
2. Get your player _id (via mongosh or `GET /api/auth/me`).
3. Add to `server/.env`:
   ```env
   ADMIN_IDS=64abc123def456789abc1234
   ```
4. Restart the server.

Method 2 — DB role:
```js
use dead-or-alive
db.players.updateOne({ username: "YourUsername" }, { $set: { role: "admin" } })
```

Admin panel highlights:
- Stats bar, clue list, inline edit, enable/disable, delete, create, bulk import.

Clue admin API (requires admin auth): `GET/POST/PUT/PATCH/DELETE /api/clues` and `POST /api/clues/bulk`.

---

## Clue Template & Variables

Templates use `{VARIABLE}` placeholders resolved server-side. Variable types: `number`, `letter`, `choice`, `symbol`. Answer rules support patterns like `even`, `odd`, `divisible_by:{X}:{Y}`, `contains_letter:{L}:{W}`, `palindrome:{W}`, `is_prime:{X}`, `fibonacci:{X}`.

Example clue body:
```json
{
  "category": "number",
  "template": "Numbers divisible by {X} survive. The code is {Y}.",
  "answerRule": "divisible_by:{X}:{Y}",
  "flavorText": "Mathematical equations cover the walls.",
  "difficulty": 2,
  "variables": [
    { "name": "X", "type": "number", "min": 2, "max": 9 },
    { "name": "Y", "type": "number", "min": 10, "max": 99 }
  ]
}
```

---

## API Reference (summary)

Auth: `/api/auth` — register, login, me, logout  
Game: `/api/game` — lobbies, room details, history  
Stats: `/api/stats` — leaderboard, my stats  
Clues (admin): `/api/clues` — CRUD + bulk import

Refer to the full route docs in `server/routes/` for request/response details.

---

## Socket Events (summary)

Client → Server: `createRoom`, `joinRoom`, `leaveRoom`, `playerReady`, `startGame`, `playerChooseDoor`, `chatMessage`  
Server → Client: `roomCreated`, `joinedRoom`, `playerJoined/Left`, `countdownStarted/tick`, `gameStarted`, `roomStarted`, `doorSelectionStarted`, `choiceUpdate`, `roundResult`, `playerEliminated`, `nextRoom`, `gameEnd`

All socket connections require a valid JWT in the handshake.

---

## Game Architecture

- In-memory `GameSession` objects tracked in `activeSessions: Map<roomCode, GameSession>`.  
- Server persists final results and key state transitions to MongoDB at round/completion points.  
- `correctDoor` is computed server-side and never transmitted to players until reveal.

Phase timings:
- Countdown: 5s
- Puzzle: 30s
- Door Selection: 30s
- Auto-select on expiry
- Reveal delay: 1s (anti-timing)
- Reveal display: 6s
- Transition: 3s

---

## Anti-Cheat Design

- Server-side validation: `correctDoor` never sent before reveal.
- Seeded randomness: `clueSeed` and `resolvedVars` kept server-side.
- Reveal delay: 1s server-side delay before `roundResult`.
- Choice deduplication: second choices ignored.
- Alive check: eliminated players’ choices discarded.
- Auto-assignment: random door when timer expires.
- JWT on socket: required in handshake.
- Admin verification: `ADMIN_IDS` checked on each admin request.

---

## Docker Deployment

Development:
```bash
docker compose up --build
```

Production:
- Create `.env` with production values (JWT_SECRET, CLIENT_URL, VITE_API_URL, VITE_SOCKET_URL, ADMIN_IDS)
```bash
# After first boot:
docker exec doa-server node utils/seedClues.js
```

---

## Scripts

- `bash setup.sh` — full first-run setup
- `server: npm run dev` — dev server with hot reload
- `server: npm start` — production server
- `server: npm run seed` — seed clues
- `client: npm run dev` — Vite dev server
- `client: npm run build` — build frontend

---

## Changelog (selected)

- 2026-07-18 — Documentation refresh: clarified admin env workflow, emphasized server-side anti-cheat, added quick changelog.
- (Previous) — Seed script (`utils/seedClues.js`) and admin bulk-import endpoints added; socket event timings refined; auto-assign non-choosers.

---

## Contributing

- Open issues for bugs or feature requests.
- PRs should include changelog entry and, when applicable, tests for server logic (especially answer rule validation).

---

## License

MIT
