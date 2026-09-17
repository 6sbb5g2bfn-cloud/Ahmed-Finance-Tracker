// Client-side id for optimistic UI before the Supabase round-trip resolves.
// Real rows use Postgres-generated uuids; this just needs to be unique
// enough locally and is only ever used transiently.
export const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : "id_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// Calendar dates (bill due dates, purchase dates, etc.) are a timezone-independent
// concept - "Sep 10" should always mean Sep 10, no matter who's viewing it or where.
// So every date-string helper below is UTC-anchored and stays UTC-consistent through
// all arithmetic, matching the server-side reminder logic exactly. The one exception
// is todayISO(), which deliberately reads the *local* calendar day, since "today" is
// the one place that must reflect where the user actually is right now.
export const parseISO = (iso) => new Date(iso + "T00:00:00Z");

export const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const fmtDate = (iso, opts) => {
  if (!iso) return "";
  const d = parseISO(iso);
  // Re-anchor to a plain local Date built from the UTC calendar components, so
  // toLocaleDateString can't shift the displayed day for the viewer's own zone.
  const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return local.toLocaleDateString("en-US", opts || { month: "short", day: "numeric" });
};

export const fmtDateLong = (iso) => fmtDate(iso, { month: "long", day: "numeric", year: "numeric" });

export const monthKeyOf = (iso) => iso.slice(0, 7);
export const thisMonthKey = () => monthKeyOf(todayISO());

export const addMonthsISO = (iso, n) => {
  const d = parseISO(iso);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

export const addDaysISO = (iso, n) => {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (aISO, bISO) => Math.round((parseISO(bISO) - parseISO(aISO)) / 86400000);

export const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
};

export const fmtNum = (n) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
    Math.round(((n || 0) + Number.EPSILON) * 100) / 100
  );

export const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

/* ---- recurring occurrence generator: works for recurring payments,
   fixed commitments — anything with {startDate, frequency, endDate} ---- */
export function generateOccurrences(item, rangeStartISO, rangeEndISO) {
  const dates = [];
  let cursor = parseISO(item.startDate);
  const rangeStart = parseISO(rangeStartISO);
  const rangeEnd = parseISO(rangeEndISO);
  const end = item.endDate ? parseISO(item.endDate) : null;
  let guard = 0;
  while (cursor <= rangeEnd && guard < 3000) {
    if (cursor >= rangeStart && (!end || cursor <= end)) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    if (item.frequency === "once") break;
    const nd = new Date(cursor);
    switch (item.frequency) {
      case "daily": nd.setUTCDate(nd.getUTCDate() + 1); break;
      case "weekly": nd.setUTCDate(nd.getUTCDate() + 7); break;
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

// Each entry in postedDates is either a bare date string (legacy format, from
// before partial payments existed - always treated as "fully covered") or a
// {date, amount} object (current format, tracks how much was actually paid
// toward that specific occurrence, so partial payments correctly leave the
// occurrence open rather than silently marking the whole bill as settled).
export function postedAmountForDate(postedDates, date) {
  let sum = 0;
  let fullyCoveredLegacy = false;
  for (const p of postedDates || []) {
    if (typeof p === "string") {
      if (p === date) fullyCoveredLegacy = true;
    } else if (p && p.date === date) {
      sum += Number(p.amount) || 0;
    }
  }
  return { sum, fullyCoveredLegacy };
}

export function nextUnpostedOccurrence(item) {
  if (!item.active) return null;
  const horizon = addMonthsISO(todayISO(), 24);
  const occ = generateOccurrences(item, item.startDate, horizon);
  for (const d of occ) {
    const { sum, fullyCoveredLegacy } = postedAmountForDate(item.postedDates, d);
    if (!fullyCoveredLegacy && sum < item.amount) return d;
  }
  return null;
}

// How much is actually still owed for the next occurrence, after crediting
// any partial payments already made toward it - not just the flat bill amount.
export function nextOccurrenceAmountDue(item) {
  const d = nextUnpostedOccurrence(item);
  if (!d) return 0;
  const { sum } = postedAmountForDate(item.postedDates, d);
  return Math.max(0, Math.round((item.amount - sum) * 100) / 100);
}

/* Sum amount of unposted occurrences of a recurring item that fall within [a,b] */
export function occurrencesInRange(item, aISO, bISO) {
  if (!item.active) return [];
  const occ = generateOccurrences(item, item.startDate, bISO).filter((d) => d >= aISO);
  return occ
    .map((d) => {
      const { sum, fullyCoveredLegacy } = postedAmountForDate(item.postedDates, d);
      const amountDue = fullyCoveredLegacy ? 0 : Math.max(0, Math.round((item.amount - sum) * 100) / 100);
      return { date: d, amountDue };
    })
    .filter((o) => o.amountDue > 0);
}
