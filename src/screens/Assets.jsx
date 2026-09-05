import { useState } from "react";
import { Plus, Gem, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useTheme } from "../context/ThemeContext";
import { FONT_DISPLAY, ASSET_TYPES } from "../lib/constants";
import { todayISO, fmtNum, uid } from "../lib/utils";
import { totalAssetsValue, totalAssetsCost, totalAssetsGain, assetsByType, chartPalette } from "../lib/calculations";
import { Screen, Card, Amount, EmptyState, IconBadge, FieldLabel, TextInput, SelectPills, PrimaryButton } from "../components/ui";

export function AssetForm({ initial, onSave, onCancel, onDelete }) {
  const t = useTheme();
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState(initial?.type || "gold");
  const [currentValue, setCurrentValue] = useState(initial ? String(initial.currentValue) : "");
  const [costBasis, setCostBasis] = useState(initial ? String(initial.costBasis) : "");
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate || todayISO());
  const [notes, setNotes] = useState(initial?.notes || "");
  const canSave = name.trim().length > 0 && parseFloat(currentValue) > 0;

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
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Current value</FieldLabel>
          <TextInput type="number" inputMode="decimal" step="0.01" value={currentValue} onChange={setCurrentValue} placeholder="0.00" />
        </div>
        <div>
          <FieldLabel>What you paid</FieldLabel>
          <TextInput type="number" inputMode="decimal" step="0.01" value={costBasis} onChange={setCostBasis} placeholder="0.00" />
        </div>
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
          purchaseDate: purchaseDate || null, notes: notes.trim(), createdAt: initial?.createdAt || todayISO(),
        })}>{initial ? "Save changes" : "Add asset"}</PrimaryButton>
      </div>
    </div>
  );
}

export default function AssetsScreen({ state, onAdd, onEdit }) {
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
                <Card key={a.id} className="p-4 flex items-center justify-between" onClick={() => onEdit(a)}>
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
