# Addition to App.jsx

Add notification fetching to your app's boot sequence, alongside your
existing auth resume logic.

```jsx
import useNotificationStore from './store/notificationStore';

// Inside your App component, in the existing useEffect that runs on
// accessToken change (where you call resumeSession/fetchProfile):
useEffect(() => {
  if (accessToken) {
    resumeSession();
    fetchProfile();
    useNotificationStore.getState().fetchUnreadCount();   // ← ADD THIS
  }
}, [accessToken]);
```

This ensures the notification bell shows the correct unread count immediately
on page load / reload, not just after the first 30-second poll interval.
