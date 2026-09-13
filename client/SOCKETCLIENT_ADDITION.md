# Addition to socket/socketClient.js

Add this listener to your existing `connectSocket()` function in `src/socket/socketClient.js`, anywhere alongside your other `socket.on(...)` registrations.

```js
import useNotificationStore from '../store/notificationStore';

// ── Real-time notification delivery (bell icon) ──────────────────────────────
socket.on('notification', (notification) => {
  useNotificationStore.getState().receiveRealtimeNotification(notification);
});
```

That's it — this fires whenever the server calls `notify(io, playerId, {...})` for this
player while they're connected, and the bell icon's unread count updates instantly
without needing a page refresh or poll.

If you want a toast to also pop up for high-priority notification types, you can
extend it like this:

```js
socket.on('notification', (notification) => {
  useNotificationStore.getState().receiveRealtimeNotification(notification);

  // Also show a toast for important types
  const importantTypes = ['admin_banned', 'admin_unbanned', 'kicked_you', 'beta_approved'];
  if (importantTypes.includes(notification.type)) {
    useGameStore.getState().showNotification?.(notification.message, 'info');
  }
});
```
