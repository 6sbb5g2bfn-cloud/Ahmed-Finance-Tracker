import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Rebuilds exactly the same JSON shape the app's own "Export Data" button
// produces client-side, but here on the server so it can run unattended.
async function fetchUserExport(userId) {
  const [settingsRes, accounts, categories, transactions, recurring, installments, debts, budgets, goals, assets] = await Promise.all([
    supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("accounts").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("categories").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: false }),
    supabase.from("recurring_payments").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("installments").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("debts").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("budgets").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("savings_goals").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("assets").select("*").eq("user_id", userId).order("created_at"),
  ]);
  const settings = settingsRes.data || {};
  return {
    meta: { currency: settings.currency || "EGP", theme: settings.theme || "light" },
    accounts: accounts.data || [], categories: categories.data || [], transactions: transactions.data || [],
    recurringPayments: recurring.data || [], installments: installments.data || [], debts: debts.data || [],
    budgets: budgets.data || [], savingsGoals: goals.data || [], assets: assets.data || [],
  };
}

export default async function handler(req, res) {
  try {
    const secret = (req.query && req.query.secret) || (req.headers.authorization || "").replace("Bearer ", "");
    if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });

    const usersRes = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (usersRes.error) throw new Error("Listing users failed: " + usersRes.error.message);
    const users = usersRes.data.users || [];

    const today = new Date().toISOString().slice(0, 10);
    const attachments = [];
    for (const u of users) {
      const data = await fetchUserExport(u.id);
      const label = (u.email || u.id).split("@")[0];
      attachments.push({
        filename: `finance-backup-${label}-${today}.json`,
        content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
      });
    }

    const toEmail = process.env.BACKUP_EMAIL;
    if (!toEmail) return res.status(500).json({ error: "BACKUP_EMAIL environment variable is not set - add it in Vercel before this can send." });

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Finance Tracker <onboarding@resend.dev>",
        to: toEmail,
        subject: `Daily backup - ${today}`,
        html: `<p>Your daily Mega Ledger backup is attached - one JSON file per account (${attachments.length} total).</p><p style="color:#666;font-size:12px;">Keep these somewhere safe. To restore, use Settings → Import in the app.</p>`,
        attachments,
      }),
    });
    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => "");
      throw new Error("Resend responded " + resp.status + ": " + bodyText.slice(0, 300));
    }

    return res.status(200).json({ sent: true, accountsBackedUp: attachments.length, to: toEmail });
  } catch (e) {
    console.error("daily-backup failed:", e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}
