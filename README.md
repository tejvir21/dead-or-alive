# 💀 Dead or Alive: Logic Escape

> Real-time multiplayer survival puzzle game — 3–8 players, procedural rooms, two doors, one escape.

![Players](https://img.shields.io/badge/Players-1--8-green) ![Stack](https://img.shields.io/badge/Stack-React%20%2B%20Node%20%2B%20Socket.io-blue) ![DB](https://img.shields.io/badge/DB-MongoDB-green)

---

## Quick Start

```bash
# Clone and run setup (installs deps, creates .env, seeds DB)
git clone https://github.com/tejvir21/dead-or-alive.git dead-or-alive && cd dead-or-alive
bash setup.sh

# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
# → http://localhost:5173
```

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Environment Variables](#environment-variables)
5. [Admin System](#admin-system)
6. [API Reference](#api-reference)
7. [Socket Events](#socket-events)
8. [Game Architecture](#game-architecture)
9. [Clue System](#clue-system)
10. [Docker Deployment](#docker-deployment)
11. [Anti-Cheat Design](#anti-cheat-design)

---

## Overview

Players join a lobby, enter a procedurally generated building, and navigate through puzzle rooms. Each room shows a logic clue. Two doors stand before you: **LIVE** and **DIE**. Only one is correct. Choose wrong — eliminated. Survive all rooms to escape.

```
Login → Lobby → Create/Join Room → Waiting Room → Countdown →
[Puzzle (30s) → Door Selection (30s) → Reveal → Next Room] × N
→ Game End → Leaderboard
```

---

## Tech Stack

| Layer    | Technology                                  |
| -------- | ------------------------------------------- |
| Frontend | React 18 + Vite, TailwindCSS, Framer Motion |
| State    | Zustand (persisted auth, ephemeral game)    |
| Realtime | Socket.io client + server                   |
| Backend  | Node.js + Express.js                        |
| Database | MongoDB + Mongoose                          |
| Auth     | JWT (bcrypt passwords, env-based admin IDs) |
| Deploy   | Docker Compose + Nginx                      |

---

## Project Structure

```
dead-or-alive/
├── setup.sh                          ← One-command first-run setup
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
    │   └── admin.js                  ← /api/admin
    ├── socket/socketHandlers.js      ← Full game engine
    └── utils/
        ├── roomGenerator.js          ← Procedural room generation
        └── seedClues.js              ← DB seed (30+ clues)
```

---

## Environment Variables

### `server/.env`

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/dead-or-alive
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
NODE_ENV=development

# ── Admin System ──────────────────────────────────────────────────────────────
# Comma-separated MongoDB player _id values granted admin access.
# These IDs are checked on every authenticated request — no DB migration needed.
# Either this env var OR having role:'admin' in DB grants admin access.
#
# Example:
# ADMIN_IDS=64abc123def456789abc1234,64abc999def000111abc5678
ADMIN_IDS=
```

### `client/.env`

```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

---

## Admin System

### How to become an admin

**Method 1 — Env var (recommended, no DB access needed):**

1. Register an account normally via the UI
2. Find your player ID:

   ```bash
   # Using mongosh
   mongosh dead-or-alive --eval "db.players.find({},{_id:1,username:1}).pretty()"

   # Or via curl (must be logged in)
   curl http://localhost:3001/api/auth/me \
     -H "Authorization: Bearer <your-jwt-token>"
   ```

3. Add to `server/.env`:
   ```env
   ADMIN_IDS=64abc123def456789abc1234
   ```
4. Restart the server — no DB changes needed

**Method 2 — DB role field:**

```js
// mongosh
use dead-or-alive
db.players.updateOne({ username: "YourUsername" }, { $set: { role: "admin" } })
```

Both methods work simultaneously. `ADMIN_IDS` takes priority.

---

### Admin Panel UI

Once you're admin, a **⚙ ADMIN** button appears in:

- The Lobby header
- The Home page (when logged in)
- Your Profile page

The Admin Panel (`/admin`) provides:

| Section         | What you can do                                               |
| --------------- | ------------------------------------------------------------- |
| **Stats bar**   | Total clues, active/inactive counts, per-category breakdown   |
| **Clue list**   | Filter by category/difficulty/search, view all clue details   |
| **Inline edit** | Edit any clue's template, answer rule, flavor text, variables |
| **Toggle**      | Enable or disable individual clues without deleting           |
| **Delete**      | Permanently remove a clue (with confirmation prompt)          |
| **Create**      | Full clue creation form with variable editor                  |
| **Bulk import** | Paste JSON to import many clues at once                       |

---

### Clue API (Admin only)

All endpoints require `Authorization: Bearer <token>` where the player is admin.

#### `GET /api/clues`

List clues with optional filtering.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `category` | string | Filter by category |
| `difficulty` | number | Filter by difficulty (1-5) |
| `search` | string | Search template text |
| `includeInactive` | any | Include disabled clues |

**Response:**

```json
{
  "clues": [ ...clue objects ],
  "total": 32
}
```

#### `GET /api/clues/:id`

Get a single clue by MongoDB ID.

#### `POST /api/clues`

Create one clue.

**Body:**

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

#### `POST /api/clues/bulk`

Import multiple clues at once.

**Body:**

```json
{
  "clues": [
    { ...clue1 },
    { ...clue2 }
  ]
}
```

**Response:**

```json
{ "inserted": 5 }
```

#### `PUT /api/clues/:id`

Update an existing clue (all fields except `clueId`).

#### `PATCH /api/clues/:id/toggle`

Toggle `isActive` on/off.

**Response:**

```json
{ "clue": { ...updated clue, "isActive": false } }
```

#### `DELETE /api/clues/:id`

Permanently delete a clue.

---

### Clue Template Reference

Templates use `{VARIABLE_NAME}` placeholders resolved at game runtime:

```
"Numbers divisible by {X} survive. The code is {Y}."
         ↑ replaced with random int               ↑ replaced with random int
```

**Variable types:**
| Type | Description | Config |
|------|-------------|--------|
| `number` | Random integer | `min`, `max` |
| `letter` | Random A-Z | (none) |
| `choice` | Random item from list | `options: ["RED","BLUE",...]` |
| `symbol` | Random from ★▲●■◆✦⬟⬡ | (none) |

**Answer rule patterns:**
| Pattern | Meaning |
|---------|---------|
| `even` | Number is even |
| `odd` | Number is odd |
| `divisible_by:{X}:{Y}` | Y divisible by X |
| `greater_than:{X}:{Y}` | Y > X |
| `contains_letter:{L}:{W}` | Word W contains letter L |
| `palindrome:{W}` | W reads same forwards/backwards |
| `is_prime:{X}` | X is prime |
| `fibonacci:{X}` | X is in the Fibonacci sequence |

---

## API Reference

### Auth (`/api/auth`)

| Method | Path        | Auth   | Description                    |
| ------ | ----------- | ------ | ------------------------------ |
| `POST` | `/register` | —      | Create account                 |
| `POST` | `/login`    | —      | Login, returns JWT + `isAdmin` |
| `GET`  | `/me`       | ✅ JWT | Get profile + `isAdmin` flag   |
| `POST` | `/logout`   | ✅ JWT | Set offline                    |

### Game (`/api/game`)

| Method | Path          | Auth   | Description              |
| ------ | ------------- | ------ | ------------------------ |
| `GET`  | `/lobbies`    | ✅ JWT | List open rooms          |
| `GET`  | `/room/:code` | ✅ JWT | Room details (sanitised) |
| `GET`  | `/history`    | ✅ JWT | My last 10 matches       |

### Stats (`/api/stats`)

| Method | Path           | Auth   | Description   |
| ------ | -------------- | ------ | ------------- |
| `GET`  | `/leaderboard` | —      | Top 50 global |
| `GET`  | `/me`          | ✅ JWT | My full stats |

### Clues (`/api/clues`) — Admin only

| Method   | Path          | Auth     | Description                 |
| -------- | ------------- | -------- | --------------------------- |
| `GET`    | `/`           | ✅ Admin | List all clues (filterable) |
| `GET`    | `/:id`        | ✅ Admin | Get single clue             |
| `POST`   | `/`           | ✅ Admin | Create one clue             |
| `POST`   | `/bulk`       | ✅ Admin | Bulk import JSON array      |
| `PUT`    | `/:id`        | ✅ Admin | Update clue                 |
| `PATCH`  | `/:id/toggle` | ✅ Admin | Enable/disable              |
| `DELETE` | `/:id`        | ✅ Admin | Delete permanently          |

---

## Socket Events

### Client → Server

| Event              | Payload                      | Description         |
| ------------------ | ---------------------------- | ------------------- |
| `createRoom`       | `{ maxPlayers, minPlayers }` | Create lobby        |
| `joinRoom`         | `{ roomCode, spectate? }`    | Join or spectate    |
| `leaveRoom`        | `{ roomCode }`               | Leave room          |
| `playerReady`      | `{ roomCode }`               | Mark ready          |
| `startGame`        | `{ roomCode }`               | Host force-start    |
| `playerChooseDoor` | `{ roomCode, door }`         | `'LIVE'` or `'DIE'` |
| `chatMessage`      | `{ roomCode, message }`      | Lobby chat          |

### Server → Client

| Event                  | Payload                                                 | Description                 |
| ---------------------- | ------------------------------------------------------- | --------------------------- |
| `roomCreated`          | `{ roomCode, session }`                                 | Room ready                  |
| `joinedRoom`           | `{ session }`                                           | Joined successfully         |
| `playerJoined/Left`    | `{ username, session }`                                 | Roster change               |
| `hostTransferred`      | `{ newHost }`                                           | New host assigned           |
| `countdownStarted`     | `{ seconds: 5 }`                                        | Pre-game countdown          |
| `countdownTick`        | `{ seconds }`                                           | Countdown tick              |
| `gameStarted`          | `{ totalRooms, session }`                               | Navigate to game            |
| `roomStarted`          | `{ roomNumber, clueText, environment, ... }`            | New room (no `correctDoor`) |
| `doorSelectionStarted` | `{ timerSeconds }`                                      | Choose now                  |
| `choiceUpdate`         | `{ chosenCount, totalAlive }`                           | Progress update             |
| `roundResult`          | `{ correctDoor, results[], survivors[], eliminated[] }` | Reveal                      |
| `playerEliminated`     | `{ username }`                                          | Elimination toast           |
| `nextRoom`             | `{ nextRoomNumber, alivePlayers }`                      | Transition                  |
| `gameEnd`              | `{ winners[], allPlayers[], totalRooms }`               | Game over                   |

---

## Game Architecture

### Server-Side GameSession

All game state lives in memory (`activeSessions: Map<roomCode, GameSession>`), persisted to MongoDB at key moments (room completion, game end).

```
GameSession {
  status:       'waiting' | 'countdown' | 'in_progress' | 'completed'
  roundPhase:   'idle' | 'puzzle' | 'door_selection' | 'reveal' | 'transition'
  players:      Map<socketId, PlayerState>
  rooms:        GeneratedRoom[]   ← correctDoor NEVER sent to clients until reveal
  choices:      Map<socketId, { door, chosenAt }>
}
```

### Phase Timing

| Phase          | Duration  | Notes                        |
| -------------- | --------- | ---------------------------- |
| Countdown      | 5s        | Visual only                  |
| Puzzle         | 30s       | Players read clue            |
| Door Selection | 30s       | Choose LIVE or DIE           |
| Auto-select    | On expiry | Random door for non-choosers |
| Reveal delay   | 1s        | Anti-timing-attack           |
| Reveal display | 6s        | Results shown                |
| Transition     | 3s        | Next room loading            |

---

## Anti-Cheat Design

| Mechanism              | Implementation                                                   |
| ---------------------- | ---------------------------------------------------------------- |
| Server-side validation | `correctDoor` computed server-side, never transmitted early      |
| Seeded randomness      | `clueSeed` and `resolvedVars` stay server-side                   |
| Reveal delay           | 1s server delay before broadcasting `roundResult`                |
| Choice deduplication   | Second `playerChooseDoor` events ignored                         |
| Alive check            | Eliminated players' choices discarded                            |
| Auto-assignment        | Random door server-side when timer expires                       |
| JWT on socket          | All connections require valid token in handshake                 |
| Admin ID verification  | ADMIN_IDS checked on every admin request, not cached client-side |

---

## Docker Deployment

```bash
# Development
docker compose up --build

# Production — create .env first
cat > .env << EOF
JWT_SECRET=$(openssl rand -hex 48)
CLIENT_URL=https://yourdomain.com
VITE_API_URL=https://api.yourdomain.com/api
VITE_SOCKET_URL=https://api.yourdomain.com
ADMIN_IDS=your_player_id_here
EOF

docker compose up -d --build

# Seed after first boot
docker exec doa-server node utils/seedClues.js
```

---

## Scripts

| Command         | Where     | Description                  |
| --------------- | --------- | ---------------------------- |
| `bash setup.sh` | root      | Full first-run setup         |
| `npm run dev`   | `server/` | Start server with hot reload |
| `npm start`     | `server/` | Start server (production)    |
| `npm run seed`  | `server/` | Seed clue database           |
| `npm run dev`   | `client/` | Start Vite dev server        |
| `npm run build` | `client/` | Build for production         |

---

## License

MIT
