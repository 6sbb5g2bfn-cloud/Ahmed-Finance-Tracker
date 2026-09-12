// Public, read-only endpoint - no secrets involved, so no auth needed.
// Uses the same free, key-free, no-limit currency source already validated
// for gold pricing: fawazahmed0/currency-api.

async function fetchJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Request to ${url} failed with ${resp.status}`);
  return resp.json();
}

export default async function handler(req, res) {
  try {
    const from = String((req.query && req.query.from) || "").toLowerCase();
    const to = String((req.query && req.query.to) || "").toLowerCase();
    if (!from || !to) throw new Error("Both from and to currency codes are required");

    if (from === to) {
      return res.status(200).json({ from: from.toUpperCase(), to: to.toUpperCase(), rate: 1, updated_at: new Date().toISOString() });
    }

    let data;
    try {
      data = await fetchJson(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from}.json`);
    } catch (e) {
      data = await fetchJson(`https://latest.currency-api.pages.dev/v1/currencies/${from}.json`);
    }

    const rates = data[from];
    if (!rates || rates[to] == null) {
      throw new Error(`No rate found for ${from.toUpperCase()} -> ${to.toUpperCase()}`);
    }

    return res.status(200).json({
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      rate: Number(rates[to]),
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("exchange-rate failed:", e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}
