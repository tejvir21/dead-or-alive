# Dead or Alive: Logic Escape

Dead or Alive is a real-time multiplayer survival puzzle game. Players meet in a room, work through a sequence of logic clues, then choose whether to go through the **LIVE** or **DIE** door. The server resolves each round, updates the room, and records the match.

The repository contains a React web client, an Express and Socket.IO server, and a MongoDB data store. It also includes optional beta access, clans and clan battles, player notifications, subscriptions and payments, support tickets, and admin tools.

![Players](https://img.shields.io/badge/Players-3--8-green)
![Stack](https://img.shields.io/badge/Stack-React%20%2B%20Node%20%2B%20Socket.io-blue)
![Database](https://img.shields.io/badge/Database-MongoDB-green)

## Contents

- [Features](#features)
- [How a match works](#how-a-match-works)
- [Technology](#technology)
- [Repository layout](#repository-layout)
- [Requirements](#requirements)
- [Run locally](#run-locally)
- [Environment configuration](#environment-configuration)
- [Run with Docker Compose](#run-with-docker-compose)
- [HTTP API overview](#http-api-overview)
- [Real-time events](#real-time-events)
- [Admin access](#admin-access)
- [Clue data](#clue-data)
- [Available scripts](#available-scripts)
- [Deployment and security notes](#deployment-and-security-notes)
- [Contributing](#contributing)
- [License](#license)

## Features

### Multiplayer game

- Create or join a room and wait for other players.
- Play a multi-room sequence of generated logic clues.
- Choose a door before the round resolves; the server validates choices and determines survival or elimination.
- Follow room, player, countdown, round, and match updates in real time using Socket.IO.
- Reconnect to an active session during the configured grace period.
- View the public leaderboard and signed-in players’ match history and tier information.

### Accounts and player experience

- Register and sign in with JWT-based authentication and refresh tokens.
- Manage a player profile and password.
- Use email OTP delivery when SMTP is configured; SMS and WhatsApp delivery are available through the optional Twilio integration.
- Receive in-app notifications and, when configured, browser push notifications.
- View subscription options and use the Razorpay payment flow when payment credentials are configured.

### Community and operations

- Create and manage clans, request to join, and take part in clan challenges and battles.
- Request beta access and gate the beta client.
- Submit support tickets and follow their status; admins can respond and manage tickets.
- Use admin pages and protected endpoints for player, game, clue, payment, clan, support, and settings workflows.
- Configure maintenance mode, game features, and related settings centrally.

Integrations that require external services (email, Twilio, Razorpay, and Web Push) are optional for local development. Their related features need valid provider configuration to work. The server mailer loads Twilio dynamically, but the Twilio SDK is not currently listed in `server/package.json`; install and deploy that dependency before enabling SMS or WhatsApp delivery.

## How a match works

The general player flow is:

```text
Register / sign in
        ↓
Lobby → create or join a room
        ↓
Waiting room → ready up → countdown
        ↓
Read the clue → choose LIVE or DIE
        ↓
Server resolves the round → continue or get eliminated
        ↓
Match result → history / leaderboard
```

The game server owns the authoritative room and round state. Clients send player actions and render server updates; they do not decide the correct outcome. Room availability, player count, and game configuration are controlled by the server.

## Technology

| Area | Technologies |
| --- | --- |
| Web client | React 18, Vite, React Router, Zustand, Tailwind CSS, Framer Motion |
| API and game server | Node.js, Express, Socket.IO |
| Persistence | MongoDB, Mongoose |
| Authentication and validation | JWT, bcryptjs, express-validator |
| Security and operations | Helmet, CORS, rate limiting, Winston |
| Optional integrations | Nodemailer/SMTP, Twilio, Razorpay, Web Push |
| Deployment | Docker Compose, Nginx |

## Repository layout

```text
dead-or-alive/
├── client/                 # React/Vite application
│   ├── public/             # Static assets and service worker
│   └── src/
│       ├── api/            # HTTP client
│       ├── components/     # Shared, game, lobby, clan, and admin UI
│       ├── pages/          # Route-level screens
│       ├── socket/         # Socket.IO client and event bindings
│       ├── store/          # Auth, game, and notification state
│       └── utils/          # JWT, push, and checkout helpers
├── server/                 # Express/Socket.IO application
│   ├── middleware/         # Authentication and security middleware
│   ├── models/             # Mongoose models
│   ├── routes/             # HTTP API route modules
│   ├── socket/             # Realtime game and clan handlers
│   └── utils/              # Seeding, migrations, notifications, and jobs
├── docker-compose.yml
├── setup.sh                # First-run setup for Bash environments
└── README.md
```

## Requirements

For local development:

- Node.js 20 or later and npm.
- MongoDB 7 or a MongoDB Atlas connection string.
- Git.
- Bash to use `setup.sh` (on Windows, use WSL or Git Bash); alternatively, follow the manual setup below.

Docker development/deployment uses Docker Engine with the Docker Compose plugin.

## Run locally

### 1. Get the source

```bash
git clone https://github.com/tejvir21/dead-or-alive.git
cd dead-or-alive
```

### 2. Configure the environment

Create `server/.env` from `server/.env.example` and `client/.env` from `client/.env.example`. Set at least a MongoDB URI and two strong, distinct JWT secrets in the server environment:

```env
MONGODB_URI=mongodb://localhost:27017/dead-or-alive
JWT_SECRET=<long-random-secret>
JWT_REFRESH_SECRET=<different-long-random-secret>
CLIENT_URL=http://localhost:5173
```

See [Environment configuration](#environment-configuration) for all supported options. Never commit real `.env` files, credentials, or production secrets.

### 3. Install dependencies

```bash
cd server
npm install
cd ../client
npm install
cd ..
```

### 4. Start MongoDB and seed clues

Start your local MongoDB service, then seed the clue collection:

```bash
cd server
npm run seed
```

The default seed mode replaces the existing clue collection. To add missing generated clues without deleting existing ones, use `npm run seed:append`. Details are in [Clue data](#clue-data).

### 5. Start the server and client

Run each command in a separate terminal from the repository root:

```bash
cd server
npm run dev
```

```bash
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API listens on port `3001` by default; its health endpoint is [http://localhost:3001/health](http://localhost:3001/health).

### First-run helper

On a Bash-compatible terminal, `bash setup.sh` installs both packages, creates missing environment files, generates server JWT secrets, and attempts to seed clues. MongoDB must be running for clue seeding to succeed. The script skips environment files that already exist.

## Environment configuration

### Server (`server/.env`)

| Variable | Purpose | Default / notes |
| --- | --- | --- |
| `PORT` | HTTP and Socket.IO server port | `3001` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/dead-or-alive` |
| `JWT_SECRET` | Signs access tokens | Required; use a long, random secret |
| `JWT_REFRESH_SECRET` | Signs refresh tokens | Required; use a different long, random secret |
| `JWT_EXPIRES_IN` | Access-token lifetime | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh-token lifetime | `7d` |
| `CLIENT_URL` | Allowed CORS client origin(s) | `http://localhost:5173,http://localhost:5174`; separate multiple origins with commas |
| `NODE_ENV` | Runtime mode and error/log behavior | Set to `production` for deployments |
| `ADMIN_IDS` | Comma-separated player MongoDB IDs granted admin access | Empty by default |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | SMTP settings for email delivery | Configure all required credentials to enable email |
| `FROM_EMAIL` | Sender address for outgoing email | Falls back to `SMTP_USER` |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Twilio credentials for phone messaging | Optional |
| `TWILIO_WHATSAPP_FROM`, `TWILIO_SMS_FROM` | Twilio WhatsApp/SMS sender identifiers | Optional |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay checkout credentials | Use test credentials for development |
| `RAZORPAY_WEBHOOK_SECRET` | Verifies Razorpay webhook signatures | Configure with the webhook secret from Razorpay |
| `OTP_EXPIRES_MINUTES` | OTP validity period | `10` |
| `OTP_MAX_ATTEMPTS` | Maximum OTP verification attempts | `3` |
| `OTP_LOCKOUT_MINUTES` | OTP lockout duration | `30` |
| `ACCOUNT_LOCKOUT_ATTEMPTS` | Failed login attempts before account lockout | `5` |
| `ACCOUNT_LOCKOUT_MINUTES` | Account lockout duration | `30` |
| `RECONNECT_GRACE_SECONDS_NORMAL` | Reconnection window for standard accounts | `30` |
| `RECONNECT_GRACE_SECONDS_VERIFIED` | Reconnection window for verified accounts | `60` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web Push application server keys | Optional; generate your own key pair |
| `VAPID_SUBJECT` | Web Push contact URI, such as a `mailto:` address | Set to an address you control |

Generate a VAPID key pair with:

```bash
npx web-push generate-vapid-keys
```

Keep the private key and all provider secrets on the server. Do not put secrets in `client/.env` or expose them as `VITE_*` variables.

### Client (`client/.env`)

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_API_URL` | Base URL for HTTP requests | `/api` in the client; `.env.example` uses `http://localhost:3001/api` |
| `VITE_SOCKET_URL` | Socket.IO server URL | Current page origin in the client; `.env.example` uses `http://localhost:3001` |
| `VITE_BETA_VERSION` | Enables the beta access gate when set to `true` | `false` |
| `VITE_MAIN_APP_URL` | Main-app link shown by the beta gate | `/` in the client; `.env.example` uses `http://localhost:5173` |

Vite variables are embedded in the browser bundle at build time. In Docker, set these as Compose environment variables/build arguments and rebuild the client image after changing them.

## Run with Docker Compose

From the repository root:

Create a `.env` file in the repository root before starting Compose. At minimum, set distinct random JWT secrets:

```env
JWT_SECRET=<long-random-secret>
JWT_REFRESH_SECRET=<different-long-random-secret>
```

Optional integrations (SMTP, Twilio, Razorpay, and Web Push) can also be configured in this root `.env` file; Compose passes those values to the server. Do not commit this file.

```bash
docker compose up --build
```

The Compose stack contains:

| Service | Container port | Host port | Purpose |
| --- | ---: | ---: | --- |
| `mongo` | `27017` | `127.0.0.1:27017` | MongoDB, persisted in the `mongo_data` named volume |
| `server` | `3001` | `127.0.0.1:3001` | Express API and Socket.IO |
| `client` | `80` | `80` | Nginx-hosted client |

For a local Docker run, configure the client origin to match the browser URL (the client is exposed on port 80). You can add these values to the same root `.env` file:

```env
JWT_SECRET=<long-random-secret>
JWT_REFRESH_SECRET=<different-long-random-secret>
CLIENT_URL=http://localhost
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
VITE_MAIN_APP_URL=http://localhost
```

Set real random secrets rather than the Compose fallback values. For a deployed domain, replace `localhost` with the appropriate HTTPS origin and API/socket URLs.

After the server and database are available, seed the clue collection:

```bash
docker compose exec server node utils/seedClues.js
```

The default Compose values are for local use. Before deployment, provide strong `JWT_SECRET` and `JWT_REFRESH_SECRET` values and set the client/API URLs and `CLIENT_URL` to match your deployment. The client URL variables are build arguments, so recreate/rebuild the client after changing them:

```bash
docker compose up -d --build
```

For production, place the services behind HTTPS, restrict database/network access, use managed secrets rather than committed files, and configure external integrations with production credentials.

## HTTP API overview

All API routes are mounted under `/api`. Most player routes require a bearer access token; admin routes additionally require admin access. This is a route-group overview, not a complete request/response schema.

| Base path | Purpose and representative routes |
| --- | --- |
| `/api/auth` | Register and sign in (`POST /register`, `POST /login`); refresh and end sessions (`POST /refresh`, `POST /logout`); current player (`GET /me`); profile/password updates (`PATCH /profile`, `PATCH /password`); send and verify OTP (`POST /otp/send`, `POST /otp/verify`) |
| `/api/game` | Lobby list (`GET /lobbies`), room details (`GET /room/:roomCode`), match history (`GET /history`), daily usage (`GET /daily-usage`), and player tier (`GET /my-tier`) |
| `/api/clues` | Admin clue listing, detail, creation, bulk import, update, enable/disable, and delete |
| `/api/settings` | Read game settings and manage protected feature flags, limits, beta access, plans, curves, and beta requests |
| `/api/stats` | Public leaderboard (`GET /leaderboard`) and signed-in player stats (`GET /me`) |
| `/api/admin` | Protected admin dashboard, player and game operations, exports, and administrative management |
| `/api/beta` | Beta-access check (`GET /check`) |
| `/api/clans` | List/create clans, membership and join requests, challenges, battles, and admin clan settings |
| `/api/notifications` | List notifications, retrieve unread count, mark notifications read, and delete notifications |
| `/api/payments` | Create an order (`POST /orders`), verify checkout (`POST /verify`), receive Razorpay webhooks (`POST /webhook`), payment history/receipts, and cancellation |
| `/api/push` | Get the VAPID public key and manage a player’s push subscription |
| `/api/support` | Submit a ticket (`POST /`), view the signed-in player’s tickets (`GET /mine`), and protected admin ticket management |

The server also exposes `GET /health`, which returns a basic status and uptime response.

## Real-time events

The client connects to Socket.IO using the configured socket URL and authenticates with its JWT. The connection supports WebSocket and polling transports and automatic reconnection.

Common client-to-server actions include:

- `createRoom`, `joinRoom`, `leaveRoom`
- `playerReady`, `startGame`
- `playerChooseDoor`, `playerSkipToDoor`
- `chatMessage`
- Clan matchmaking and battle actions handled by the server’s clan socket handlers

The server broadcasts room membership, connection/reconnection, host, countdown, game-start, round-result, elimination, and match-end updates. Event payloads are implementation details; when integrating another client, use `client/src/socket/socketClient.js` and `server/socket/socketHandlers.js` as the source of truth.

## Admin access

The standard setup is to grant admin access through `ADMIN_IDS`:

1. Register a player account.
2. Find the player’s MongoDB `_id` in the `players` collection.
3. Add the ID to `server/.env`. Multiple IDs may be comma-separated:

   ```env
   ADMIN_IDS=player_id_1,player_id_2
   ```

4. Restart the server.

Admin access can also be represented by the player’s database role where supported by the authorization middleware. Treat admin accounts and IDs as privileged credentials. Admin-only routes and admin UI access should only be enabled for trusted operators.

## Clue data

The clue seed utility generates the project’s large clue set and stores clues in MongoDB:

```bash
cd server
npm run seed
```

The default mode is **fresh**: it removes existing clue documents before inserting the generated set. To preserve existing clues and append only templates that are not already present:

```bash
npm run seed:append
```

Back up the database before using fresh seeding against data you need to keep. Admins can also manage clues through the protected clue API and admin interface.

## Available scripts

| Location | Command | Purpose |
| --- | --- | --- |
| Repository root | `bash setup.sh` | Install dependencies, create missing environment files, generate JWT secrets, and attempt initial clue seeding |
| `server/` | `npm run dev` | Start the API/game server with Nodemon |
| `server/` | `npm start` | Start the server with Node.js |
| `server/` | `npm run seed` | Replace clue data with the generated clue set |
| `server/` | `npm run seed:append` | Append generated clue templates that are not present yet |
| `server/` | `npm run generate` | Run the clue-generation utility |
| `server/` | `npm run migrate` | Run the project migration utility |
| `client/` | `npm run dev` | Start the Vite development server |
| `client/` | `npm run build` | Build the production client into `client/dist` |
| `client/` | `npm run preview` | Preview the built client locally |

Migration and repair utilities under `server/utils` are operational scripts, not part of normal startup. Review the specific script and back up the database before running one.

## Deployment and security notes

- Use unique, randomly generated JWT secrets; never use the sample Compose defaults in a deployed environment.
- Keep `.env` files, payment credentials, SMTP/Twilio credentials, VAPID private keys, and database credentials out of source control.
- Set `CLIENT_URL` to the exact browser origins that should be allowed by CORS.
- Configure Razorpay webhook signing with the same webhook secret on both sides.
- Use HTTPS and restrict MongoDB access in production; do not expose the database port publicly unless needed.
- `helmet`, request rate limiting, authentication middleware, and server-side game validation are part of the server protections; they do not replace deployment-level controls or operational monitoring.
- The Socket.IO protocol and API paths may evolve with the application. Check the current route and event handlers before building external integrations.

## Contributing

1. Create a focused branch for your change.
2. Keep player-facing and server-side behavior consistent, especially for game rules and authorization.
3. Add or update tests when introducing them for the affected behavior, and run the relevant build or checks.
4. Update this README when setup, environment variables, API paths, or operational scripts change.
5. Open an issue for a bug or feature discussion, then submit a pull request with a concise description.

## License

This project is licensed under the MIT License. See the repository’s license terms for details.
