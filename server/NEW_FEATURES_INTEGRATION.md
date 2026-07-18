# New Features — Integration Guide

## 1. Server setup (do this first)

```bash
cd server
```

### Files to ADD (new files):
```
models/GameSettings.js       ← REPLACE existing
models/BetaRequest.js        ← NEW
routes/settings.js           ← REPLACE existing
routes/beta.js                ← NEW
socket/socketHandlers.js     ← REPLACE existing
utils/migrate_v2.js          ← NEW
```

### Files to EDIT manually:
```
models/Player.js             ← Add fields, see PLAYER_MODEL_ADDITIONS.md
routes/game.js                ← Add /daily-usage route, see GAME_ROUTE_ADDITION.md
index.js                      ← Add: app.use('/api/beta', require('./routes/beta'));
```

### Run the migration once:
```bash
node utils/migrate_v2.js
```
This adds `roomsCreatedAt`, `roomsJoinedAt`, `hasBetaAccess` fields to all existing players (safe defaults, non-destructive) and auto-grants beta access to existing Elite subscribers.

### Restart the server.

---

## 2. Client setup — MAIN app

```
src/pages/WaitingRoomPage.jsx           ← REPLACE (ready status, auto-start timer, kick voting)
src/pages/GamePage.jsx                  ← REPLACE (eliminated overlay, spectate, kick handling)
src/pages/LobbyPage.jsx                 ← REPLACE (auto-start duration selector, daily limits)
src/components/game/EliminatedOverlay.jsx ← NEW
src/components/ui/BetaAccessSection.jsx  ← NEW
src/components/admin/SettingsTabExtra.jsx ← NEW
src/components/admin/BetaRequestsTab.jsx  ← NEW
```

### Wire BetaAccessSection into ProfilePage.jsx

In your `ProfilePage.jsx`, import and render it in the Profile tab:

```jsx
import BetaAccessSection from '../components/ui/BetaAccessSection';

// Inside the 'profile' tab JSX, after the Verification section:
<BetaAccessSection player={player} />
```

### Wire SettingsTabExtra + BetaRequestsTab into AdminPage.jsx

In your `AdminPage.jsx`:

```jsx
import SettingsTabExtra from '../components/admin/SettingsTabExtra';
import BetaRequestsTab  from '../components/admin/BetaRequestsTab';

// Add 'beta' to your tabs array:
const tabs = [
  { id:'dashboard', label:'Dashboard' },
  { id:'clues',     label:'Clues' },
  { id:'players',   label:'Players' },
  { id:'settings',  label:'⚙ Settings' },
  { id:'beta',      label:'🧪 Beta Requests' },   // ← ADD THIS
  { id:'audit',     label:'Audit Log' },
];

// In the settings tab render:
{tab==='settings' && (
  <>
    <SettingsTab />
    <SettingsTabExtra />   {/* ← ADD THIS after the existing SettingsTab */}
  </>
)}

// Add the new beta tab render:
{tab==='beta' && <BetaRequestsTab />}
```

---

## 3. Client setup — BETA app (separate deployment only)

Only do this in the **beta** frontend's codebase (different hosted URL).

```
src/components/BetaGate.jsx   ← NEW
```

Wrap your App.jsx:

```jsx
import BetaGate from './components/BetaGate';

export default function App() {
  return (
    <BetaGate>
      <BrowserRouter>
        {/* ... all your existing routes ... */}
      </BrowserRouter>
    </BetaGate>
  );
}
```

Add to the beta app's `.env`:
```
VITE_MAIN_APP_URL=https://dead-or-alive.io    # link back to main version
```

---

## 4. Admin: initial configuration checklist

After deploying, go to **Admin → Settings → Beta Access** and set:
1. `Beta URL` to your actual beta deployment URL (e.g. `https://beta.dead-or-alive.io`)
2. Toggle `Beta gating enabled` ON
3. Confirm `Elite = automatic beta access` is ON
4. Confirm `Pro can request beta access` is ON (or OFF if you want admin-only grants)

Go to **Admin → Settings → Daily Limits** and adjust the default numbers (3/10/20/unlimited) if needed.

Go to **Admin → Settings → Auto-Start** and confirm the default 180s and tier ranges match what you want.

Go to **Admin → Settings → Kick System** and confirm minimum 3 players / 50% threshold / 30s vote timeout.

---

## 5. New socket events reference

| Event (client emits) | Payload | Purpose |
|---|---|---|
| `setAutoStartDuration` | `{roomCode, duration}` | Host adjusts waiting-room timer |
| `initiateKickVote` | `{roomCode, targetPlayerId}` | Start a kick vote (or direct kick if <3 players + host) |
| `castKickVote` | `{roomCode, targetPlayerId, vote}` | Vote yes/no on active kick |
| `spectateAfterElimination` | `{roomCode}` | Eliminated player chooses to keep watching |

| Event (server emits) | Payload | Purpose |
|---|---|---|
| `autoStartTimerBegun` | `{duration, expiresAt}` | Timer started |
| `autoStartCancelled` | `{reason}` | Not enough ready players when timer expired |
| `autoStarting` | `{readyCount}` | Timer expired, starting with ready players |
| `playerRemovedAutoStart` | `{username}` | Player removed for not being ready |
| `kickVoteStarted` / `kickVoteUpdate` / `kickVoteFailed` / `kickVoteExpired` | vote state | Kick vote lifecycle |
| `playerKicked` | `{username, reason, session}` | Someone was kicked |
| `youWereKicked` | `{reason}` | You specifically were kicked |
| `youWereEliminated` | `{correctDoor, chosenDoor}` | You were eliminated this round — triggers overlay |
| `spectatingAsEliminated` | `{session}` | Confirmed spectate mode active |
| `spectatorRoomStarted` | room data, no clueText | Room data for eliminated spectators |
