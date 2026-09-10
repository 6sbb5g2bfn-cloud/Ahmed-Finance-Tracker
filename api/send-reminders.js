import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addMonthsISO(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
}

// Same occurrence logic as src/lib/utils.js, ported to plain Node (no imports across
// the client/server boundary) so the reminder window matches what the app itself shows.
function generateOccurrences(item, rangeStartISO, rangeEndISO) {
  const dates = [];
  let cursor = new Date(item.start_date + "T00:00:00Z");
  const rangeStart = new Date(rangeStartISO + "T00:00:00Z");
  const rangeEnd = new Date(rangeEndISO + "T00:00:00Z");
  const end = item.end_date ? new Date(item.end_date + "T00:00:00Z") : null;
  let guard = 0;
  while (cursor <= rangeEnd && guard < 3000) {
        if (cursor >= rangeStart && (!end || cursor <= end)) dates.push(cursor.toISOString().slice(0, 10));
    if (item.frequency === "once") break;
    const nd = new Date(cursor);

    switch (item.frequency) {
      case "daily": nd.setUTCDate(nd.getUTCDate() + 1); break;
      case "weekly": nd.setUTCDate(nd.getUTCDate() + 7); break;
      case "quarterly": nd.setUTCMonth(nd.getUTCMonth() + 3); break;
      case "yearly": nd.setUTCFullYear(nd.getUTCFullYear() + 1); break;
      case "monthly":
      default: nd.setUTCMonth(nd.getUTCMonth() + 1); break;
    }
    cursor = nd;
    guard++;
    if (end && cursor > end) break;
  }
  return dates;
}

function nextUnpostedOccurrence(item) {
  if (!item.active) return null;
  const horizon = addMonthsISO(todayISO(), 24);
  const occ = generateOccurrences(item, item.start_date, horizon);
  const posted = new Set(item.posted_dates || []);
  for (const d of occ) if (!posted.has(d)) return d;
  return null;
}

const RECURRING_THRESHOLD_DAYS = { once: 3, daily: 1, weekly: 1, monthly: 1, quarterly: 3, yearly: 7 };

const INSTALLMENT_THRESHOLD_DAYS = 1;
const DEBT_THRESHOLD_DAYS = 3;

function logKey(userId, itemType, itemId, date, channel) {
  return userId + "|" + itemType + "|" + itemId + "|" + date + "|" + channel;
}

// Sends to every subscription a user has (e.g. multiple devices). Returns true
// if at least one succeeded. Expired/invalid subscriptions (410/404) are deleted.
async function pushToUser(supabase, userId, subscriptions, title, body) {
  const mySubs = subscriptions.filter((s) => s.user_id === userId);
  let anySucceeded = false;
  for (const sub of mySubs) {
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
    if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set for this environment");
    if (!process.env.VAPID_PRIVATE_KEY) throw new Error("VAPID_PRIVATE_KEY is not set for this environment");
    if (!process.env.VITE_VAPID_PUBLIC_KEY) throw new Error("VITE_VAPID_PUBLIC_KEY is not set for this environment");

    webpush.setVapidDetails("mailto:noreply@example.com", process.env.VITE_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const today = todayISO();

    const [settingsRes, recurringRes, installmentsRes, debtsRes] = await Promise.all([
      supabase.from("user_settings").select("user_id, reminders_enabled, push_enabled").or("reminders_enabled.eq.true,push_enabled.eq.true"),
      supabase.from("recurring_payments").select("*").eq("active", true),
      supabase.from("installments").select("*"),
      supabase.from("debts").select("*"),
    ]);
    const checks = [["user_settings", settingsRes], ["recurring_payments", recurringRes], ["installments", installmentsRes], ["debts", debtsRes]];
    for (let i = 0; i < checks.length; i++) {
      const name = checks[i][0];
      const r = checks[i][1];
      if (r.error) throw new Error("Reading " + name + " failed: " + r.error.message);
    }

    const wantsEmail = {};
    const wantsPush = {};
    const enabledUserIds = new Set();
    for (const row of settingsRes.data || []) {
      enabledUserIds.add(row.user_id);
      wantsEmail[row.user_id] = !!row.reminders_enabled;
      wantsPush[row.user_id] = !!row.push_enabled;
    }
    if (enabledUserIds.size === 0) return res.status(200).json({ emailSent: 0, pushSent: 0, note: "no users opted in" });

    const perUser = {};
    const addItem = (userId, entry) => {
      if (!enabledUserIds.has(userId)) return;
      (perUser[userId] = perUser[userId] || []).push(entry);
    };

    for (const r of recurringRes.data || []) {
      const next = nextUnpostedOccurrence(r);
      if (!next) continue;
      const threshold = RECURRING_THRESHOLD_DAYS[r.frequency] != null ? RECURRING_THRESHOLD_DAYS[r.frequency] : 3;
      const daysAway = daysBetween(today, next);
      if (daysAway >= 0 && daysAway <= threshold) {
        addItem(r.user_id, { type: "recurring", id: r.id, date: next, name: r.name, amount: r.amount });
      }
    }
    for (const inst of installmentsRes.data || []) {
      const paidCount = (inst.payments || []).length;
      if (paidCount >= inst.number_of_payments) continue;
      const next = addMonthsISO(inst.start_date, paidCount + 1);
      const daysAway = daysBetween(today, next);
      if (daysAway >= 0 && daysAway <= INSTALLMENT_THRESHOLD_DAYS) {
        addItem(inst.user_id, { type: "installment", id: inst.id, date: next, name: inst.name, amount: inst.monthly_payment });
      }
    }
    for (const debt of debtsRes.data || []) {
      if (!debt.due_date) continue;
      const paid = (debt.payments || []).reduce((s, p) => s + Number(p.amount), 0);
      const remaining = Number(debt.amount) - paid;
      if (remaining <= 0) continue;
      const daysAway = daysBetween(today, debt.due_date);
      if (daysAway >= 0 && daysAway <= DEBT_THRESHOLD_DAYS) {
        const label = (debt.direction === "owe" ? "Pay " : "Collect from ") + debt.person;
        addItem(debt.user_id, { type: "debt", id: debt.id, date: debt.due_date, name: label, amount: remaining });
      }
    }

    const userIds = Object.keys(perUser);
    if (userIds.length === 0) return res.status(200).json({ emailSent: 0, pushSent: 0, note: "nobody has anything due within their reminder window right now" });

    const [logRes, subsRes] = await Promise.all([
      supabase.from("reminder_log").select("user_id, item_type, item_id, occurrence_date, channel").in("user_id", userIds),
      supabase.from("push_subscriptions").select("user_id, endpoint, p256dh, auth").in("user_id", userIds),
    ]);
    if (logRes.error) throw new Error("Reading reminder_log failed: " + logRes.error.message);
    if (subsRes.error) throw new Error("Reading push_subscriptions failed: " + subsRes.error.message);
    const sentSet = new Set((logRes.data || []).map((r) => logKey(r.user_id, r.item_type, r.item_id, r.occurrence_date, r.channel)));
    const subscriptions = subsRes.data || [];

    const usersRes = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (usersRes.error) throw new Error("Listing users failed: " + usersRes.error.message);
    const emailById = {};
    for (const u of usersRes.data.users || []) emailById[u.id] = u.email;

    let emailSent = 0;
    let pushSent = 0;
    const logRows = [];
    const skipped = [];

    for (const userId of userIds) {
      const allItems = perUser[userId];

      if (wantsEmail[userId]) {
        const items = allItems.filter((it) => !sentSet.has(logKey(userId, it.type, it.id, it.date, "email")));
        const email = emailById[userId];
        if (items.length > 0 && email) {
          const rows = items
            .map((it) => "<tr><td style=\"padding:6px 10px;\">" + it.name + "</td><td style=\"padding:6px 10px;\">" + it.date + "</td><td style=\"padding:6px 10px;text-align:right;\">" + Number(it.amount).toLocaleString() + "</td></tr>")
            .join("");
          const html = "<div style=\"font-family:sans-serif;\"><h2>Upcoming payments</h2><table style=\"border-collapse:collapse;width:100%;\">" + rows + "</table><p style=\"color:#666;font-size:12px;\">Sent by your Finance Tracker.</p></div>";
          const resp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ from: "Finance Tracker <onboarding@resend.dev>", to: email, subject: items.length + " upcoming payment" + (items.length > 1 ? "s" : ""), html }),
          });
          if (resp.ok) {
            emailSent++;
            for (const it of items) logRows.push({ user_id: userId, item_type: it.type, item_id: it.id, occurrence_date: it.date, channel: "email" });
          } else {
            const bodyText = await resp.text().catch(() => "");
            skipped.push({ userId, channel: "email", reason: "Resend responded " + resp.status + ": " + bodyText.slice(0, 300) });
          }
        }
      }

      if (wantsPush[userId]) {
        const items = allItems.filter((it) => !sentSet.has(logKey(userId, it.type, it.id, it.date, "push")));
        if (items.length > 0) {
          const title = items.length + " upcoming payment" + (items.length > 1 ? "s" : "");
          const body = items.map((it) => it.name + " - " + Number(it.amount).toLocaleString()).join(", ");
          const ok = await pushToUser(supabase, userId, subscriptions, title, body);
          if (ok) {
            pushSent++;
            for (const it of items) logRows.push({ user_id: userId, item_type: it.type, item_id: it.id, occurrence_date: it.date, channel: "push" });
          } else {
            skipped.push({ userId, channel: "push", reason: "no active subscription or all sends failed" });
          }
        }
      }
    }

    if (logRows.length) {
      const upsertRes = await supabase
        .from("reminder_log")
        .upsert(logRows, { onConflict: "user_id,item_type,item_id,occurrence_date,channel", ignoreDuplicates: true });
      if (upsertRes.error) throw new Error("Writing reminder_log failed: " + upsertRes.error.message);
    }

    return res.status(200).json({ emailSent, pushSent, skipped });
  } catch (e) {
    console.error("send-reminders failed:", e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}
