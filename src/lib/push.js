import { supabase } from "./supabaseClient";

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

function base64urlToUint8Array(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  const str = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

// Must be called directly from a button's onClick - Notification.requestPermission()
// requires a real user gesture on iOS, same as the Face ID calls.
export async function enablePush(userId) {
  if (!pushSupported()) throw new Error("Push isn't supported in this browser");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permission was not granted");

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) throw new Error("Push isn't configured yet");

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64urlToUint8Array(vapidPublicKey),
  });

  const json = subscription.toJSON();
  const res = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: "endpoint" }
  );
  if (res.error) throw new Error(res.error.message);

  return true;
}

export async function disablePush(userId) {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = registration && (await registration.pushManager.getSubscription());
  if (subscription) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint).eq("user_id", userId);
    await subscription.unsubscribe();
  }
}
