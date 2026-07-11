# Dead or Alive: Logic Escape — Phase 1 Delivery

## ✅ What's in this package

### 1. Mega Clue System — 2,870 unique clues
- **14 categories**: number, word, symbol, environment, logic, pattern, sound, math, binary, cipher, spatial, time, color, riddle
- **10 difficulty levels** (1=easiest, 10=nightmare), distributed 25→16 clues per level (sums to 205/category)
- **Progressive hints**: D1-3 get 2 hints, D4-6 get 1 hint, D7-10 get 0 hints (sink or swim)
- **Zero duplicate templates** — verified via automated dedup + Mongoose unique index
- **615/615 validation trials passed** — every variable-based clue tested for: no errors, valid door output, no unresolved placeholders, full determinism (same seed → same result)
- **All 2,870 clues pass Mongoose schema validation** with zero errors

Generate fresh: `npm run generate > clues.json`
Seed into MongoDB: `npm run seed` (fresh) or `npm run seed -- --append` (skip duplicates)

### 2. Backend Infrastructure (Server)

| File | Purpose |
|------|---------|
| `models/Player.js` | Auth, verification (email/phone/OTP), subscription, clan ref, security lockout fields |
| `models/Clue.js` | 14-category enum, 1-10 difficulty, unique template index, hints array |
| `models/Match.js` | Match history with mode (solo/co-op/vs-teams), password protection, difficulty curve ref |
| `models/GameSettings.js` | **Single source of truth** for all admin-controlled settings: max players, timers, 8 built-in difficulty curves, subscription plans, feature flags |
| `models/AuditLog.js` | Every admin action logged with target, details, IP, user agent |
| `middleware/auth.js` | JWT access+refresh tokens, `ADMIN_IDS` env-based admin check, ban enforcement |
| `middleware/security.js` | Rate limiters (auth/OTP/api), express-validator rules for registration (password complexity, phone, DOB, etc.) |
| `routes/auth.js` | Register, login (with account lockout), refresh, logout, profile update, **OTP send/verify** (email + WhatsApp/SMS placeholders), password change |
| `routes/clues.js` | Full CRUD + **bulk import with automatic deduplication** (skips existing templates, reports what was skipped) |
| `routes/settings.js` | Admin endpoints to update timers, difficulty curves (add/edit), subscription plans, rooms-per-player-count map |
| `routes/statsAdmin.js` | Leaderboard, dashboard stats (DAU, active matches, banned/verified counts), player list/ban/unban/gift-subscription, audit log viewer, match management |
| `socket/socketHandlers.js` | Full game engine — see below |

### 3. Socket Engine — New Capabilities

| Feature | How it works |
|---------|--------------|
| **Door skip** | `playerSkipToDoor` event — player can individually leave puzzle phase early. If ALL alive players skip, door selection starts immediately for everyone |
| **Timer reduction** | When a player picks the **correct** door early, remaining time shrinks for everyone still deciding. Formula: `reduction = remainingTime × (correctPickers/totalAlive) × speedFactor × adminFactor` — faster + more-agreed-upon picks reduce more. `timerReductionFactor` is admin-adjustable via Settings |
| **Reconnection grace period** | Disconnect during gameplay → 30s grace (60s for verified users) before elimination. Reconnecting within the window seamlessly resumes — current room, phase, and timer state are resent |
| **Verified player perks** | Higher max players (32 vs 16, admin-configurable), longer reconnect grace, access to `verified`-tier difficulty curves |
| **Admin-controlled difficulty curves** | 8 built-in curves (`gentle`, `balanced`, `stepped`, `spike`, `nightmare`, `random`, `ascending_fast`, `expert`) stored in `GameSettings`, selectable per-room at creation, curve levels auto-scale to match actual room count for that player count |
| **Maintenance mode** | Toggling `features.maintenanceMode` blocks all non-auth API calls and new room creation server-wide |

### 4. Bug Fixes Carried Forward From Earlier Sessions
- Door correctness always matches clue logic (the `evaluateAnswerRule` engine — now supports **70+ rule patterns** across all 14 categories)
- `even`/`odd` bare-rule auto-embedding fixed (no more "even survives, code is 733 → LIVE" bugs)
- Digit-sum-parity clues now correctly evaluate the digit sum, not the raw number
- Countdown → game-start race condition fixed
- Lobby stale-closure navigation bugs fixed
- `minPlayers` allows solo testing (was hardcoded min 3)

---

## ⏳ What's NOT in this package (Phases 2-5, as previously scoped)

| Phase | Contents |
|-------|----------|
| **Phase 2** | Client-side: signup form with new fields, OTP verification UI, profile page updates, support form, security UI polish |
| **Phase 3** | Razorpay integration (order creation + server-side verification), subscription purchase flow, verified-user perk UI |
| **Phase 4** | Teams/clans: co-op shared-lives mode, vs-teams win conditions, team chat, clan management UI |
| **Phase 5** | Full admin DB panel UI: ban/broadcast/CSV-export/analytics-dashboard/feature-flags/audit-log viewer (backend routes for most of this **are already built** in `statsAdmin.js` — just needs frontend) |

---

## Setup Instructions

```bash
cd server
npm install
cp .env.example .env
# Edit .env: set JWT_SECRET, JWT_REFRESH_SECRET, MONGODB_URI, ADMIN_IDS

npm run seed        # loads 2,870 clues into MongoDB
npm run dev         # starts server on :3001
```

### Environment variables you must set
```env
JWT_SECRET=<random 48+ char string>
JWT_REFRESH_SECRET=<different random 48+ char string>
MONGODB_URI=mongodb://localhost:27017/dead-or-alive
ADMIN_IDS=<your player _id after first registration>
```

WhatsApp/SMS OTP (`TWILIO_*` vars) and email OTP (`SMTP_*` vars) are wired with **placeholder send functions** in `routes/auth.js` (`sendEmailOTP`, `sendWhatsAppOTP`, `sendSMSOTP`) — they currently log to console. Wire in real `nodemailer`/`twilio` clients when you have credentials.

---

## Validation Summary (run yourself)

```bash
cd server
npm install
node utils/generateMegaClues.js > /tmp/clues.json 2> /tmp/log.txt
cat /tmp/log.txt   # should show 205 ✅ for all 14 categories, TOTAL 2870
```
