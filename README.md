# 💀 Dead or Alive: Logic Escape

> Real-time multiplayer survival puzzle with rooms, logic clues, live lobby flow, clans, beta access, subscriptions, and admin tooling.

![Players](https://img.shields.io/badge/Players-1--8-green) ![Stack](https://img.shields.io/badge/Stack-React%20%2B%20Node%20%2B%20Socket.io-blue) ![DB](https://img.shields.io/badge/DB-MongoDB-green) ![Payments](https://img.shields.io/badge/Payments-Razorpay-orange)

---

Latest update: 2026-09-14 — README refreshed to match the current codebase, including live multiplayer flow, beta gating, admin controls, payments, clans, OTP/security features, and the current setup files.

---

## Quick Start

Clone and bootstrap the project:

```bash
git clone https://github.com/tejvir21/dead-or-alive.git dead-or-alive
cd dead-or-alive
bash setup.sh
```

Start the app in two terminals:

Terminal 1 — server
```bash
cd server
npm run dev
```

Terminal 2 — client
```bash
cd client
npm run dev
# → http://localhost:5173
```

Docker:
```bash
# Development
docker compose up --build

# Production
docker compose up -d --build
```

---

## Overview

Dead or Alive: Logic Escape is a realtime survival-themed multiplayer puzzle game where players join a lobby, solve logic clues, and choose between two doors: LIVE or DIE. The server validates the correct outcome and resolves eliminations safely on the backend.

The current project includes:
- live lobby and game flow
- clue-based puzzle rounds and survivability logic
- admin controls for clue management and settings
- beta access flow and gated frontend access
- clan creation, join requests, and challenge mechanics
- notifications, pricing, and checkout integration
- OTP/security features and server-side maintenance protections

Flow:
Login → Register → Lobby → Create/Join Room → Waiting Room → Countdown → Puzzle → Door Selection → Reveal → Next Room → Match End → Leaderboard

---

## Features

### Core game loop
- 3–8 player lobbies
- procedural room progression and round-based logic puzzles
- LIVE / DIE door selection
- elimination, survival, leaderboard, and match history tracking
- real-time updates via Socket.io

### User and security features
- JWT authentication with refresh-token flow
- OTP verification via email and WhatsApp/SMS options
- account lockout and retry protections
- maintenance mode toggle via settings
- secure HTTP headers and request rate limiting

### Admin and moderation tools
- admin env-based grants via `ADMIN_IDS`
- admin dashboard for stats and clue management
- settings management endpoints
- clue CRUD and bulk clue import
- audit-friendly game configuration and feature toggles

### Community and monetization
- beta access gate for early access
- clan system with join requests and battle/challenge flow
- notifications to players
- pricing page and Razorpay subscription/checkout flow

---

## Tech Stack

Frontend:
- React 18
- Vite
- TailwindCSS
- Framer Motion
- Zustand
- React Router
- Socket.io Client

Backend:
- Node.js
- Express.js
- Socket.io
- MongoDB + Mongoose
- JWT + bcryptjs
- Nodemailer + Twilio + Razorpay integrations
- Helmet + CORS + rate limits

Infrastructure:
- Docker Compose
- Nginx for frontend deployment
- MongoDB Atlas or local MongoDB instance

---

## Project Structure

```text
dead-or-alive/
├── setup.sh
├── docker-compose.yml
├── README.md
├── client/
│   ├── .env
│   ├── .env.example
│   ├── Dockerfile
│   ├── index.html
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api/
│   │   │   └── apiClient.js
│   │   ├── components/
│   │   │   ├── BetaGate.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── pages/
│   │   │   ├── AdminPage.jsx
│   │   │   ├── ClansPage.jsx
│   │   │   ├── GamePage.jsx
│   │   │   ├── HomePage.jsx
│   │   │   ├── LeaderboardPage.jsx
│   │   │   ├── LobbyPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── NotFoundPage.jsx
│   │   │   ├── NotificationBell.jsx
│   │   │   ├── PricingPage.jsx
│   │   │   ├── ProfilePage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   └── WaitingRoomPage.jsx
│   │   ├── socket/
│   │   │   └── socketClient.js
│   │   ├── store/
│   │   │   ├── authStore.js
│   │   │   ├── gameStore.js
│   │   │   └── notificationStore.js
│   │   ├── utils/
│   │   │   ├── jwt.js
│   │   │   └── razorpayCheckout.js
│   │   └── main.jsx
│   └── ...
│
└── server/
    ├── .env
    ├── .env.example
    ├── Dockerfile
    ├── clues_mega_2870.json
    ├── index.js
    ├── mailer.js
    ├── package.json
    ├── middleware/
    │   ├── auth.js
    │   └── security.js
    ├── models/
    │   ├── AuditLog.js
    │   ├── BetaRequest.js
    │   ├── Clan.js
    │   ├── ClanBattle.js
    │   ├── ClanChallenge.js
    │   ├── ClanJoinRequest.js
    │   ├── Clue.js
    │   ├── GameSettings.js
    │   ├── Match.js
    │   ├── Notification.js
    │   ├── Payment.js
    │   ├── Player.js
    │   └── ...
    ├── routes/
    │   ├── admin.js
    │   ├── auth.js
    │   ├── beta.js
    │   ├── clans.js
    │   ├── clues.js
    │   ├── game.js
    │   ├── notifications.js
    │   ├── payments.js
    │   ├── settings.js
    │   ├── stats.js
    │   └── statsAdmin.js
    ├── socket/
    │   └── socketHandlers.js
    ├── utils/
    │   ├── clanBattleExpiry.js
    │   ├── clanPeriodReset.js
    │   ├── fixSubscriptionPlans.js
    │   ├── generateMegaClues.js
    │   ├── logger.js
    │   ├── migrate.js
    │   ├── migrate_v2.js
    │   ├── notify.js
    │   ├── receiptGenerator.js
    │   ├── roomGenerator.js
    │   ├── seedClues.js
    │   ├── subscriptionExpiry.js
    │   └── ...
    └── ...
```

---

## Environment Variables

### server/.env.example
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/dead-or-alive
JWT_SECRET=change-this-to-a-long-random-string
JWT_REFRESH_SECRET=change-this-to-another-long-random-string
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
NODE_ENV=development

# Admin
ADMIN_IDS=
ADMIN_OTP_EMAIL=admin@yourdomain.com
ADMIN_OTP_EMAIL_PASSWORD=your-email-app-password

# Email OTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@dead-or-alive.io

# WhatsApp / SMS OTP (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_SMS_FROM=+1234567890

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here

# Support
SUPPORT_EMAIL=support@dead-or-alive.io

# Security
OTP_EXPIRES_MINUTES=10
OTP_MAX_ATTEMPTS=3
OTP_LOCKOUT_MINUTES=30
ACCOUNT_LOCKOUT_ATTEMPTS=5
ACCOUNT_LOCKOUT_MINUTES=30

# Reconnection
RECONNECT_GRACE_SECONDS_NORMAL=30
RECONNECT_GRACE_SECONDS_VERIFIED=60
```

### client/.env.example
```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

Notes:
- `ADMIN_IDS` accepts comma-separated MongoDB player `_id` values.
- Restart the server after changing admin env values.
- `JWT_REFRESH_SECRET` and the OTP/payment settings are required for full auth, email, and checkout flows.

---

## Admin System

### How to become an admin

Method 1 — environment variable:
1. Register a user in the UI.
2. Retrieve the player `_id` from MongoDB or from the auth endpoints.
3. Add it to `server/.env`:
   ```env
   ADMIN_IDS=64abc123def456789abc1234,64def456abc7890123456789
   ```
4. Restart the server.

Method 2 — database role update:
```js
use dead-or-alive
 db.players.updateOne({ username: "YourUsername" }, { $set: { role: "admin" } })
```

### Admin tools
- clue management and bulk import
- settings and maintenance controls
- game stats dashboard and admin analytics
- operator access for player/admin management workflows

---

## API Summary

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/verify-otp`
- `POST /api/auth/resend-otp`

### Game
- `GET /api/game/*` for lobbies and room data
- socket-based realtime room lifecycle and round resolution

### Clues
- `GET /api/clues`
- `POST /api/clues`
- `PUT /api/clues/:id`
- `PATCH /api/clues/:id`
- `DELETE /api/clues/:id`
- `POST /api/clues/bulk`

### Settings and admin
- `GET /api/settings`
- `PATCH /api/settings`
- `GET /api/admin/*`
- `GET /api/stats`
- `GET /api/stats/admin`

### Beta, clans, notifications, payments
- `GET /api/beta/*`
- `GET/POST /api/clans/*`
- `GET /api/notifications`
- `POST /api/payments/create-order`
- `POST /api/payments/verify`
- `POST /api/payments/webhook`

---

## Socket Events

The live game uses Socket.io for lobby and match synchronization.

Client → Server examples:
- `createRoom`
- `joinRoom`
- `leaveRoom`
- `playerReady`
- `startGame`
- `playerChooseDoor`
- `chatMessage`

Server → Client examples:
- `roomCreated`
- `joinedRoom`
- `playerJoined`
- `playerLeft`
- `countdownStarted`
- `gameStarted`
- `roomStarted`
- `doorSelectionStarted`
- `choiceUpdate`
- `roundResult`
- `playerEliminated`
- `nextRoom`
- `gameEnd`

All realtime connections require a valid JWT in the socket handshake.

---

## Security and Anti-Cheat Notes

- correct answer logic is computed server-side
- player choices are validated before being accepted
- eliminated players’ inputs are ignored
- timers auto-assign a random decision on expiry
- server-side reveal delay prevents timing abuse
- `ADMIN_IDS` checks are enforced on admin endpoints
- maintenance mode can be toggled centrally through settings
- OTP, lockout, and refresh-token protections reduce account abuse risk

---

## Docker Deployment

Development:
```bash
docker compose up --build
```

Production:
```bash
docker compose up -d --build
```

After first boot, seed clues if needed:
```bash
docker exec doa-server node utils/seedClues.js
```

---

## Scripts

- `bash setup.sh` — full first-run bootstrap
- `cd server && npm run dev` — server hot reload
- `cd server && npm start` — server production start
- `cd server && npm run seed` — seed clue database
- `cd client && npm run dev` — Vite development server
- `cd client && npm run build` — production client build

---

## Changelog

- 2026-09-14 — README updated to reflect current features: beta access, clans, notifications, pricing, maintenance mode, OTP auth, admin tooling, and the real project layout.
- 2026-07-28 — documentation refresh for Quick Start, Admin System, and anti-cheat notes.
- 2026-07-18 — updated admin env workflow and clarified server-side anti-cheat notes.

---

## Contributing

- Open issues for bugs or feature requests.
- Keep admin/security changes well documented.
- Add or update tests for server logic when changing game rules, clue validation, or auth flows.

---

## License

MIT
