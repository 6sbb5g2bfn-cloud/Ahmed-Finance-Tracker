// Public, read-only endpoint - no secrets involved, so no auth needed.
// Chains two free, key-free APIs:
//  1. goldprice.dev /v1/carat - gold price per gram, by karat, in USD
//  2. fawazahmed0/currency-api - USD -> any of 200+ currencies (covers EGP, SAR, etc.,
//     which goldprice.dev's own 31-currency list does not)

const KARATS = ["24k", "22k", "21k", "20k", "18k", "16k", "14k", "10k"];

async function fetchJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Request to ${url} failed with ${resp.status}`);
  return resp.json();
}

export default async function handler(req, res) {
  try {
    const currency = String((req.query && req.query.currency) || "USD").toLowerCase();

    const goldUsd = await fetchJson("https://api.goldprice.dev/v1/carat?currency=USD");

    let rate = 1;
    if (currency !== "usd") {
      let fxData;
      try {
        fxData = await fetchJson(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json`);
      } catch (e) {
        // documented fallback mirror, in case the primary jsdelivr CDN is unreachable
        fxData = await fetchJson(`https://latest.currency-api.pages.dev/v1/currencies/usd.json`);
      }
      const usdRates = fxData.usd || {};
      if (usdRates[currency] == null) {
        throw new Error(`Currency "${currency}" not found in exchange rate data`);
      }
      rate = Number(usdRates[currency]);
    }

    const prices = {};
    for (const k of KARATS) {
      const field = `price_gram_${k}`;
      const usdValue = Number(goldUsd[field]);
      prices[field] = Number.isFinite(usdValue) ? Math.round(usdValue * rate * 100) / 100 : null;
    }

    return res.status(200).json({
      currency: currency.toUpperCase(),
      updated_at: new Date().toISOString(),
      ...prices,
    });
  } catch (e) {
    console.error("gold-price failed:", e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}
