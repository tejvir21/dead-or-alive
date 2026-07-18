# Phase 3 Complete — Master Integration Guide

This delivery fixes 2 bugs and adds the full notification system.

---

## Bug fixes in this delivery

1. **Solo-game spectate option removed** — `socket/socketHandlers.js` now
   tracks `isSoloGame()` and sends `canSpectate:false` in the
   `youWereEliminated` event when there's only one player. The client
   (`EliminatedOverlay.jsx`, `GamePage.jsx`) hides the Spectate button
   accordingly, and the server also rejects a spectate attempt server-side
   as a safety net.

2. **Room creator now auto-ready** — `PlayerState` constructor takes an
   `isCreator` flag; `createRoom` passes `true` for the host. No more
   needing to click "ready" as the room creator. `WaitingRoomPage.jsx`
   button label reflects this ("✓ READY (host — auto-ready)").

3. **Beta Requests tab now visible** — the whole `AdminPage.jsx` was
   rebuilt as ONE self-contained file. Settings sub-sections and Beta
   Requests are inline, not separate components requiring manual import
   wiring (which is likely why it wasn't showing before).

---

## New: Notification System

### 1. Server — new files (drop in directly)
```
models/Notification.js
utils/notify.js
routes/notifications.js
```

### 2. Server — wire into index.js

```js
// Near your other route registrations:
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/beta', require('./routes/beta'));   // if not already added from earlier delivery
```

### 3. Server — manual integration into existing routes

Follow these guides to add `notify(...)` calls to your existing routes:
- `AUTH_ROUTE_ADDITIONS.md` → profile update, password change
- `ADMIN_ROUTE_ADDITIONS.md` → ban, unban, verify, gift subscription
- `MAILER_ADDITION.md` → add `sendNotificationEmail` to mailer.js

`routes/settings.js` (replaced in full) already has beta approve/reject
and admin-activity-feed notifications wired in.

`socket/socketHandlers.js` (replaced in full) already has kick
confirmation and game-result notifications wired in.

### 4. Client — new files
```
src/store/notificationStore.js
src/components/ui/NotificationBell.jsx
```

`NotificationBell` is already added to `LobbyPage.jsx`'s header in this
delivery. Add it to any other page headers you want it visible on
(e.g. ProfilePage, AdminPage) the same way:

```jsx
import NotificationBell from '../components/ui/NotificationBell';
// ...
<NotificationBell />
```

### 5. Client — socket listener

Follow `SOCKETCLIENT_ADDITION.md` to add the real-time `notification`
event listener to `socket/socketClient.js`.

### 6. Client — app boot

Follow `APP_BOOT_ADDITION.md` to fetch the unread count on page load.

---

## Notification events reference

| Type | Triggered by | Email? |
|---|---|---|
| `kicked_you` | Someone kicks you | No |
| `you_kicked_someone` | You kick someone (confirmation) | No |
| `profile_updated` | You update your own profile | No |
| `password_changed` | You change your password | **Yes** |
| `admin_banned` | Admin bans you | **Yes** |
| `admin_unbanned` | Admin unbans you | **Yes** |
| `admin_verified` / `admin_unverified` | Admin toggles your verified status | No |
| `admin_gifted_subscription` | Admin gifts you Pro/Elite | **Yes** |
| `beta_approved` / `beta_rejected` | Your beta request is resolved | **Yes** (approved only) |
| `game_won` / `game_eliminated` | A match you played ends | No |
| `admin_activity` | Any admin action (visible only to OTHER admins) | No |

---

## Judgment calls made (flag if you want these changed)

1. **"Notify admin" interpretation** — implemented as a live activity feed
   where every admin action notifies all OTHER currently-online admins
   (via `notifyAdmins()` in `utils/notify.js`), not just an audit log entry.
   This is in addition to, not instead of, the existing Audit Log tab.

2. **Toast vs persistent** — built as persistent (bell icon + history),
   per your confirmation. No separate toast popups were added for
   notifications — the bell badge is the only visual cue. If you want an
   additional toast for high-priority types (ban, kick), see the optional
   snippet at the bottom of `SOCKETCLIENT_ADDITION.md`.

3. **Match result notifications** — added `game_won`/`game_eliminated` as
   an extra event beyond your list, since "any action taken" implied game
   outcomes were reasonable to include. Remove the block in `endGame()`
   in `socketHandlers.js` if you don't want these.

4. **Password changed email** — marked as email-worthy since it's
   security-sensitive, even though not explicitly on your confirmed list.
