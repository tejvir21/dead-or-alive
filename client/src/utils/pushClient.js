/**
 * src/utils/pushClient.js — registers the service worker, requests
 * notification permission, and manages the Push subscription lifecycle.
 */
import { apiJSON } from '../api/apiClient';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function registerServiceWorker() {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.error('Service worker registration failed:', err);
    return null;
  }
}

export function getPermissionState() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/**
 * Full opt-in flow: register SW → request permission → subscribe →
 * send subscription to server. Call this from a user-initiated click
 * (a button), never automatically on page load — browsers require a
 * user gesture for the permission prompt, and popping it unprompted
 * trains people to reflexively deny it.
 */
export async function enablePushNotifications() {
  if (!isPushSupported()) throw new Error('Push notifications are not supported in this browser');

  const registration = await registerServiceWorker();
  if (!registration) throw new Error('Failed to register service worker');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted');

  const { publicKey } = await apiJSON('/push/vapid-public-key');

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const raw = subscription.toJSON();
  await apiJSON('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint: raw.endpoint, keys: raw.keys }),
  });

  return true;
}

export async function disablePushNotifications() {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await apiJSON('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: subscription.endpoint }) });
    await subscription.unsubscribe();
  }
}

export async function getPushStatus() {
  try { return await apiJSON('/push/status'); }
  catch (_) { return { subscribed: false, deviceCount: 0 }; }
}
