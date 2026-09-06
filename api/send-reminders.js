mport { createClient } from "@supabase/supabase-js";

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

// Reminder lead time by commitment type, per the user's own rule:
// higher-frequency commitments get shorter notice.
const RECURRING_THRESHOLD_DAYS = { daily: 1, weekly: 1, monthly: 1, quarterly: 3, yearly: 7 };
const INSTALLMENT_THRESHOLD_DAYS = 1;
const DEBT_THRESHOLD_DAYS = 3;

export default async function handler(req, res) {
  // Real Vercel Cron invocations send the secret as a header; this also accepts
  // it as a plain URL query param so it can be triggered manually from any
  // browser for testing, without needing a tool that can set custom headers.
  const authHeader = req.headers["authorization"] === `Bearer ${process.env.CRON_SECRET}`;
  const queryParam = req.query?.secret === process.env.CRON_SECRET;
  if (!authHeader && !queryParam) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const today = todayISO();

  const [settingsRes, recurringRes, installmentsRes, debtsRes] = await Promise.all([
    supabase.from("user_settings").select("user_id").eq("reminders_enabled", true),
    supabase.from("recurring_payments").select("*").eq("active", true),
    supabase.from("installments").select("*"),
    supabase.from("debts").select("*"),
  ]);
  for (const r of [settingsRes, recurringRes, installmentsRes, debtsRes]) {
    if (r.error) return res.status(500).json({ error: r.error.message });
  }

  const enabledUserIds = new Set((settingsRes.data || []).map((r) => r.user_id));
  if (enabledUserIds.size === 0) return res.status(200).json({ sent: 0, note: "no users opted in" });

  const perUser = {};
  const addItem = (userId, entry) => {
    if (!enabledUserIds.has(userId)) return;
    (perUser[userId] = perUser[userId] || []).push(entry);
  };

  for (const r of recurringRes.data || []) {
    const next = nextUnpostedOccurrence(r);
    if (!next) continue;
    const threshold = RECURRING_THRESHOLD_DAYS[r.frequency] ?? 3;
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
      const label = debt.direction === "owe" ? `Pay ${debt.person}` : `Collect from ${debt.person}`;
      addItem(debt.user_id, { type: "debt", id: debt.id, date: debt.due_date, name: label, amount: remaining });
    }
  }

  const userIds = Object.keys(perUser);
  if (userIds.length === 0) return res.status(200).json({ sent: 0 });

  const { data: alreadySent, error: logErr } = await supabase
    .from("reminder_log")
    .select("user_id, item_type, item_id, occurrence_date")
    .in("user_id", userIds);
  if (logErr) return res.status(500).json({ error: logErr.message });
  const sentSet = new Set((alreadySent || []).map((r) => `${r.user_id}|${r.item_type}|${r.item_id}|${r.occurrence_date}`));

  const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersErr) return res.status(500).json({ error: usersErr.message });
  const emailById = Object.fromEntries((usersData?.users || []).map((u) => [u.id, u.email]));

  let sentCount = 0;
  const logRows = [];

  for (const userId of userIds) {
    const items = perUser[userId].filter((it) => !sentSet.has(`${userId}|${it.type}|${it.id}|${it.date}`));
    if (items.length === 0) continue;
    const email = emailById[userId];
    if (!email) continue;

    const rows = items
      .map((it) => `<tr><td style="padding:6px 10px;">${it.name}</td><td style="padding:6px 10px;">${it.date}</td><td style="padding:6px 10px;text-align:right;">${Number(it.amount).toLocaleString()}</td></tr>`)
      .join("");
    const html = `<div style="font-family:sans-serif;"><h2>Upcoming payments</h2><table style="border-collapse:collapse;width:100%;">${rows}</table><p style="color:#666;font-size:12px;">Sent by your Finance Tracker.</p></div>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Finance Tracker <onboarding@resend.dev>",
        to: email,
        subject: `${items.length} upcoming payment${items.length > 1 ? "s" : ""}`,
        html,
      }),
    });

    if (resp.ok) {
      sentCount++;
      for (const it of items) logRows.push({ user_id: userId, item_type: it.type, item_id: it.id, occurrence_date: it.date });
    }
  }

  if (logRows.length) {
    await supabase.from("reminder_log").upsert(logRows, { onConflict: "user_id,item_type,item_id,occurrence_date", ignoreDuplicates: true });
  }

  return res.status(200).json({ sent: sentCount });
}
