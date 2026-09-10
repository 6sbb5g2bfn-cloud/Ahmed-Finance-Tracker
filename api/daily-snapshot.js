import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function pushToUser(supabase, subscriptions, title, body) {
  let anySucceeded = false;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body })
      );
      anySucceeded = true;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }
  return anySucceeded;
}

export default async function handler(req, res) {
  const authHeader = req.headers["authorization"] === `Bearer ${process.env.CRON_SECRET}`;
  const queryParam = req.query && req.query.secret === process.env.CRON_SECRET;
  if (!authHeader && !queryParam) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (!process.env.VITE_SUPABASE_URL) throw new Error("VITE_SUPABASE_URL is not set for this environment");
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set for this environment");
    if (!process.env.VAPID_PRIVATE_KEY) throw new Error("VAPID_PRIVATE_KEY is not set for this environment");
    if (!process.env.VITE_VAPID_PUBLIC_KEY) throw new Error("VITE_VAPID_PUBLIC_KEY is not set for this environment");

    webpush.setVapidDetails("mailto:noreply@example.com", process.env.VITE_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const today = todayISO();

    const settingsRes = await supabase.from("user_settings").select("user_id, currency").eq("push_enabled", true);
    if (settingsRes.error) throw new Error("Reading user_settings failed: " + settingsRes.error.message);

    const userIds = (settingsRes.data || []).map((r) => r.user_id);
    if (userIds.length === 0) return res.status(200).json({ sent: 0, note: "no users opted in" });

    const [txRes, subsRes] = await Promise.all([
      supabase.from("transactions").select("user_id, amount, type").eq("date", today).eq("type", "expense").in("user_id", userIds),
      supabase.from("push_subscriptions").select("user_id, endpoint, p256dh, auth").in("user_id", userIds),
    ]);
    if (txRes.error) throw new Error("Reading transactions failed: " + txRes.error.message);
    if (subsRes.error) throw new Error("Reading push_subscriptions failed: " + subsRes.error.message);

    const currencyByUser = {};
    for (const r of settingsRes.data || []) currencyByUser[r.user_id] = r.currency || "";

    const totals = {};
    for (const tx of txRes.data || []) {
      const t = totals[tx.user_id] || { sum: 0, count: 0 };
      t.sum += Number(tx.amount);
      t.count += 1;
      totals[tx.user_id] = t;
    }

    const subscriptionsByUser = {};
    for (const s of subsRes.data || []) {
      (subscriptionsByUser[s.user_id] = subscriptionsByUser[s.user_id] || []).push(s);
    }

    let sent = 0;
    const skipped = [];
    for (const userId of Object.keys(totals)) {
      const t = totals[userId];
      if (t.sum <= 0) continue;
      const subs = subscriptionsByUser[userId] || [];
      if (subs.length === 0) { skipped.push({ userId, reason: "no active subscription" }); continue; }

      const currency = currencyByUser[userId] || "";
      const title = "Today's spending";
      const body = t.sum.toLocaleString() + " " + currency + " across " + t.count + " transaction" + (t.count > 1 ? "s" : "");
      const ok = await pushToUser(supabase, subs, title, body);
      if (ok) sent++;
      else skipped.push({ userId, reason: "all sends failed" });
    }

    return res.status(200).json({ sent, skipped });
  } catch (e) {
    console.error("daily-snapshot failed:", e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}
