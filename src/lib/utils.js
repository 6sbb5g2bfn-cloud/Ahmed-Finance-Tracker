// Client-side id for optimistic UI before the Supabase round-trip resolves.
// Real rows use Postgres-generated uuids; this just needs to be unique
// enough locally and is only ever used transiently.
export const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : "id_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const parseISO = (iso) => new Date(iso + "T00:00:00");

export const fmtDate = (iso, opts) => {
  if (!iso) return "";
  return parseISO(iso).toLocaleDateString("en-US", opts || { month: "short", day: "numeric" });
};

export const fmtDateLong = (iso) => fmtDate(iso, { month: "long", day: "numeric", year: "numeric" });

export const monthKeyOf = (iso) => iso.slice(0, 7);
export const thisMonthKey = () => monthKeyOf(todayISO());

export const addMonthsISO = (iso, n) => {
  const d = parseISO(iso);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};

export const addDaysISO = (iso, n) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
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
    const nd = new Date(cursor);
    switch (item.frequency) {
      case "daily": nd.setDate(nd.getDate() + 1); break;
      case "weekly": nd.setDate(nd.getDate() + 7); break;
      case "yearly": nd.setFullYear(nd.getFullYear() + 1); break;
      case "monthly":
      default: nd.setMonth(nd.getMonth() + 1); break;
    }
    cursor = nd;
    guard++;
    if (end && cursor > end) break;
  }
  return dates;
}

export function nextUnpostedOccurrence(item) {
  if (!item.active) return null;
  const horizon = addMonthsISO(todayISO(), 24);
  const occ = generateOccurrences(item, item.startDate, horizon);
  const posted = new Set(item.postedDates || []);
  for (const d of occ) if (!posted.has(d)) return d;
  return null;
}

/* Sum amount of unposted occurrences of a recurring item that fall within [a,b] */
export function occurrencesInRange(item, aISO, bISO) {
  if (!item.active) return [];
  const occ = generateOccurrences(item, item.startDate, bISO).filter((d) => d >= aISO);
  const posted = new Set(item.postedDates || []);
  return occ.filter((d) => !posted.has(d));
}
