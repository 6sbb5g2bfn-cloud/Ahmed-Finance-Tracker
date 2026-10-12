import { useState, useEffect } from "react";
import { Plus, Gem, TrendingUp, TrendingDown, Trash2, RotateCcw } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useTheme } from "../context/ThemeContext";
import { FONT_DISPLAY, ASSET_TYPES } from "../lib/constants";
import { todayISO, fmtNum, uid } from "../lib/utils";
import { totalAssetsValue, totalAssetsCost, totalAssetsGain, assetsByType, chartPalette } from "../lib/calculations";
import { Screen, Card, Amount, EmptyState, IconBadge, FieldLabel, TextInput, SelectPills, PrimaryButton } from "../components/ui";

const KARATS = [
  { id: "24k", label: "24k" },
  { id: "22k", label: "22k" },
  { id: "21k", label: "21k" },
  { id: "18k", label: "18k" },
];

export function AssetForm({ state, initial, onSave, onCancel, onDelete }) {
  const t = useTheme();
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState(initial?.type || "gold");
  const [currentValue, setCurrentValue] = useState(initial ? String(initial.currentValue) : "");
  const [costBasis, setCostBasis] = useState(initial ? String(initial.costBasis) : "");
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate || todayISO());
  const [notes, setNotes] = useState(initial?.notes || "");
  const [weightGrams, setWeightGrams] = useState(initial?.weightGrams != null ? String(initial.weightGrams) : "");
  const [karat, setKarat] = useState(initial?.karat || "21k");
  const [livePrices, setLivePrices] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState(null);
  const canSave = name.trim().length > 0 && parseFloat(currentValue) > 0;

  const isGold = type === "gold";
  const currency = (state && state.meta && state.meta.currency) || "USD";

  const fetchLivePrice = async () => {
    setPriceLoading(true);
    setPriceError(null);
    try {
      const resp = await fetch(`/api/gold-price?currency=${encodeURIComponent(currency)}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Couldn't load live price");
      setLivePrices(data);
    } catch (e) {
      setPriceError(e.message || "Couldn't load live price");
    } finally {
      setPriceLoading(false);
    }
  };

  useEffect(() => {
    if (isGold) fetchLivePrice();
    // eslint-disable-next-line
  }, [isGold]);

  const pricePerGram = livePrices ? Number(livePrices[`price_gram_${karat}`]) : null;
  const grams = parseFloat(weightGrams) || 0;
  const liveComputedValue = pricePerGram && grams > 0 ? Math.round(pricePerGram * grams * 100) / 100 : null;
  const usingLiveValue = isGold && liveComputedValue != null;

  // Sync the auto-calculated value into currentValue whenever it changes, so
  // saving always uses the freshest figure without a separate "apply" step.
  useEffect(() => {
    if (usingLiveValue) setCurrentValue(String(liveComputedValue));
    // eslint-disable-next-line
  }, [liveComputedValue]);

  const cv = parseFloat(currentValue) || 0;
  const cb = parseFloat(costBasis) || 0;
  const gain = cv - cb;
  const gainPct = cb > 0 ? (gain / cb) * 100 : null;

  return (
    <div>
      <FieldLabel>Asset name</FieldLabel>
      <TextInput value={name} onChange={setName} placeholder="e.g. Gold bars, Apartment, Aramco shares" autoFocus />
      <div className="mt-5"><FieldLabel>Type</FieldLabel>
        <SelectPills value={type} onChange={setType} options={ASSET_TYPES} getLabel={(o) => o.label} />
      </div>

      {isGold ? (
        <>
          <div className="mt-5">
            <FieldLabel>Weight (grams)</FieldLabel>
            <TextInput type="number" inputMode="decimal" step="0.01" value={weightGrams} onChange={setWeightGrams} placeholder="0.00" />
          </div>
          <div className="mt-5">
            <FieldLabel>Karat</FieldLabel>
            <SelectPills value={karat} onChange={setKarat} options={KARATS} getLabel={(o) => o.label} />
          </div>

          {priceLoading && (
            <div className="mt-4 text-[12.5px]" style={{ color: t.textSoft }}>Loading live gold price&hellip;</div>
          )}

          {!priceLoading && livePrices && (
            <div className="mt-4 rounded-2xl p-4" style={{ background: t.ink }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: "rgba(246,243,236,0.7)" }}>Live price ({karat})</span>
                <button onClick={fetchLivePrice} className="flex items-center gap-1 text-[10px]" style={{ color: "rgba(246,243,236,0.7)" }}>
                  <RotateCcw size={11} /> refresh
                </button>
              </div>
              <div className="text-[13px] mt-0.5" style={{ color: t.bg }}>
                {pricePerGram ? `${fmtNum(pricePerGram)} ${currency} / gram` : "Not available for this karat"}
              </div>
              {liveComputedValue != null && (
                <>
                  <div className="h-px my-2.5" style={{ background: "rgba(246,243,236,0.15)" }} />
                  <div className="text-[10px]" style={{ color: "rgba(246,243,236,0.7)" }}>Current value (auto-calculated)</div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: t.bg, marginTop: 2 }}>{fmtNum(liveComputedValue)} {currency}</div>
                </>
              )}
            </div>
          )}

          {!priceLoading && priceError && (
            <div className="mt-4">
              <div className="text-[12px] mb-2" style={{ color: t.red }}>Couldn't load a live price ({priceError}). Enter the value yourself for now.</div>
              <FieldLabel>Current value</FieldLabel>
              <TextInput type="number" inputMode="decimal" step="0.01" value={currentValue} onChange={setCurrentValue} placeholder="0.00" />
            </div>
          )}
        </>
      ) : (
        <div className="mt-5">
          <FieldLabel>Current value</FieldLabel>
          <TextInput type="number" inputMode="decimal" step="0.01" value={currentValue} onChange={setCurrentValue} placeholder="0.00" />
        </div>
      )}

      <div className="mt-5">
        <FieldLabel>What you paid</FieldLabel>
        <TextInput type="number" inputMode="decimal" step="0.01" value={costBasis} onChange={setCostBasis} placeholder="0.00" />
      </div>
      {(cv > 0 || cb > 0) && (
        <div className="mt-3 flex items-center gap-1.5 text-[12.5px]" style={{ color: gain >= 0 ? t.green : t.red }}>
          {gain >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{gain >= 0 ? "+" : ""}{fmtNum(gain)} {gainPct !== null ? `(${gain >= 0 ? "+" : ""}${Math.round(gainPct)}%)` : ""}</span>
        </div>
      )}
      <div className="mt-5">
        <FieldLabel>Purchase date</FieldLabel>
        <TextInput type="date" value={purchaseDate} onChange={setPurchaseDate} />
      </div>
      <div className="mt-5">
        <FieldLabel>Notes (optional)</FieldLabel>
        <TextInput value={notes} onChange={setNotes} placeholder="e.g. location, certificate #, broker" />
      </div>
      <div className="mt-6 flex gap-2">
        {initial && onDelete && <button onClick={onDelete} className="p-3 rounded-full active:opacity-60" style={{ border: `1px solid ${t.line}` }}><Trash2 size={18} color={t.red} /></button>}
        <PrimaryButton full disabled={!canSave} onClick={() => onSave({
          id: initial?.id || uid(), name: name.trim(), type, currentValue: cv, costBasis: cb,
          purchaseDate: purchaseDate || null,
          weightGrams: isGold && grams > 0 ? grams : null,
          karat: isGold ? karat : null,
          notes: notes.trim(), createdAt: initial?.createdAt || todayISO(),
        })}>{initial ? "Save changes" : "Add asset"}</PrimaryButton>
      </div>
    </div>
  );
}

// Works for any asset type. Gold assets (with a weight) ask how many grams
// were sold, so the remaining weight/value/cost basis scale down correctly;
// everything else asks for the percent of the holding sold. Either way, the
// proceeds you actually received drive the realized gain/loss - not just a
// proportional share of the current value, since the market may have moved.
export function SellAssetForm({ state, asset, onSave, onCancel }) {
  const t = useTheme();
  const isGold = asset.type === "gold" && asset.weightGrams != null && asset.weightGrams > 0;
  const [proceeds, setProceeds] = useState("");
  const [gramsSold, setGramsSold] = useState(isGold ? String(asset.weightGrams) : "");
  const [pctSold, setPctSold] = useState("100");
  const [accountId, setAccountId] = useState(state.accounts.find((a) => a.status === "active")?.id);
  const [date, setDate] = useState(todayISO());

  const fraction = isGold
    ? Math.min(1, Math.max(0, (parseFloat(gramsSold) || 0) / asset.weightGrams))
    : Math.min(1, Math.max(0, (parseFloat(pctSold) || 0) / 100));
  const proceedsNum = parseFloat(proceeds) || 0;
  const costBasisSold = Math.round(asset.costBasis * fraction * 100) / 100;
  const realizedGain = Math.round((proceedsNum - costBasisSold) * 100) / 100;
  const isFullSale = fraction >= 0.9999;
  const canSave = proceedsNum > 0 && fraction > 0 && accountId;

  return (
    <div>
      <div className="text-[13px] mb-4" style={{ color: t.textSoft }}>
        Selling <span style={{ color: t.text, fontWeight: 500 }}>{asset.name}</span>
      </div>

      <FieldLabel>Sale proceeds ({state.meta.currency})</FieldLabel>
      <TextInput type="number" inputMode="decimal" step="0.01" value={proceeds} onChange={setProceeds} placeholder="0.00" autoFocus />

      <div className="mt-5">
        {isGold ? (
          <>
            <FieldLabel>Grams sold (of {fmtNum(asset.weightGrams)}g held)</FieldLabel>
            <TextInput type="number" inputMode="decimal" step="0.01" value={gramsSold} onChange={setGramsSold} placeholder="0.00" />
          </>
        ) : (
          <>
            <FieldLabel>Percent of this holding sold</FieldLabel>
            <TextInput type="number" inputMode="decimal" step="1" value={pctSold} onChange={setPctSold} placeholder="100" />
          </>
        )}
      </div>

      <div className="mt-5">
        <FieldLabel>Account receiving the money</FieldLabel>
        <SelectPills options={state.accounts.filter((a) => a.status === "active")} value={accountId} onChange={setAccountId} getLabel={(a) => a.name} />
      </div>

      <div className="mt-5">
        <FieldLabel>Date</FieldLabel>
        <TextInput type="date" value={date} onChange={setDate} />
      </div>

      {proceedsNum > 0 && fraction > 0 && (
        <div className="mt-5 rounded-2xl p-4" style={{ background: t.ink }}>
          <div className="text-[10px]" style={{ color: "rgba(246,243,236,0.7)" }}>Realized gain / loss on this sale</div>
          <div className="flex items-center gap-1.5 mt-1" style={{ color: realizedGain >= 0 ? "#8FD19E" : "#E08585" }}>
            {realizedGain >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18 }}>{realizedGain >= 0 ? "+" : ""}{fmtNum(realizedGain)} {state.meta.currency}</span>
          </div>
          <div className="mt-1.5 text-[11px]" style={{ color: "rgba(246,243,236,0.7)" }}>
            {isFullSale ? "This sells the entire holding — the asset will be removed." : `Keeps the remaining ${isGold ? fmtNum(asset.weightGrams * (1 - fraction)) + "g" : Math.round((1 - fraction) * 100) + "%"} on your Assets list.`}
          </div>
        </div>
      )}

      <div className="mt-6">
        <PrimaryButton full disabled={!canSave} onClick={() => onSave({ proceeds: proceedsNum, fraction, date, accountId, isFullSale })}>
          Confirm sale
        </PrimaryButton>
      </div>
    </div>
  );
}

export default function AssetsScreen({ state, onAdd, onEdit, onSell }) {
  const t = useTheme();
  const assets = state.assets || [];
  const value = totalAssetsValue(state);
  const cost = totalAssetsCost(state);
  const gain = totalAssetsGain(state);
  const gainPct = cost > 0 ? (gain / cost) * 100 : null;
  const breakdown = assetsByType(state);
  const palette = chartPalette(t);

  return (
    <Screen>
      <div className="px-4 pt-6 flex items-center justify-between">
        <div className="text-[20px] font-medium" style={{ fontFamily: FONT_DISPLAY }}>Assets</div>
        <button onClick={onAdd} className="p-2.5 rounded-full active:opacity-60" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <Plus size={17} color={t.text} />
        </button>
      </div>

      {assets.length === 0 ? (
        <EmptyState icon={<Gem size={34} strokeWidth={1.3} />} title="No assets yet" subtitle="Track gold, property, stocks and other holdings alongside your cash." actionLabel="Add asset" onAction={onAdd} />
      ) : (
        <>
          <div className="px-4 mt-3">
            <div className="text-[12px]" style={{ color: t.textSoft }}>Total assets value</div>
            <div className="mt-1"><Amount value={value} size="xxl" /> <span className="text-[13px]" style={{ color: t.textSoft }}>{state.meta.currency}</span></div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[12.5px]" style={{ color: gain >= 0 ? t.green : t.red }}>
              {gain >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>{gain >= 0 ? "+" : ""}{fmtNum(gain)} {state.meta.currency} {gainPct !== null ? `(${gain >= 0 ? "+" : ""}${Math.round(gainPct)}%)` : ""} vs. {fmtNum(cost)} invested</span>
            </div>
          </div>

          {breakdown.length > 1 && (
            <div className="px-4 mt-4">
              <Card className="p-4">
                <div className="flex items-center">
                  <div style={{ width: 110, height: 110 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={breakdown} dataKey="value" nameKey="label" innerRadius={32} outerRadius={54} paddingAngle={2} stroke="none">
                          {breakdown.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5 pl-2">
                    {breakdown.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-[12px]">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="rounded-full shrink-0" style={{ width: 7, height: 7, background: palette[i % palette.length] }} />
                          <span className="truncate" style={{ color: t.textSoft }}>{d.label}</span>
                        </div>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>{value > 0 ? Math.round((d.value / value) * 100) : 0}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          )}

          <div className="px-4 mt-4 flex flex-col gap-3">
            {assets.map((a) => {
              const meta = ASSET_TYPES.find((tp) => tp.id === a.type) || ASSET_TYPES[0];
              const Icon = meta.icon;
              const g = (a.currentValue || 0) - (a.costBasis || 0);
              return (
                <Card key={a.id} className="p-4">
                  <div className="flex items-center justify-between" onClick={() => onEdit(a)}>
                    <div className="flex items-center gap-3">
                      <IconBadge bg={t.bgAlt} size={40}><Icon size={18} color={t.text} strokeWidth={1.7} /></IconBadge>
                      <div>
                        <div className="text-[14px] font-medium">{a.name}</div>
                        <div className="text-[12px]" style={{ color: t.textSoft }}>{meta.label}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Amount value={a.currentValue} size="base" />
                      <div className="text-[11px] mt-0.5" style={{ color: g >= 0 ? t.green : t.red }}>{g >= 0 ? "+" : ""}{fmtNum(g)}</div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSell(a); }}
                    className="mt-3 w-full py-2 rounded-full text-[12px] font-medium"
                    style={{ background: t.bgAlt, color: t.text }}
                  >
                    Sell
                  </button>
                </Card>
              );
            })}
          </div>
        </>
      )}
      <div className="h-6" />
    </Screen>
  );
}