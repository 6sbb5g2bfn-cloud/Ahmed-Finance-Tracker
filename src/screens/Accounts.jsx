import { useState } from "react";
import { Plus, Wallet, Trash2 } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { FONT_DISPLAY, ACCOUNT_TYPES, CURRENCIES } from "../lib/constants";
import { todayISO, uid } from "../lib/utils";
import { accountBalance, totalBalance } from "../lib/calculations";
import { Screen, Card, Amount, EmptyState, IconBadge, FieldLabel, TextInput, SelectPills, PrimaryButton } from "../components/ui";

export function AccountForm({ state, initial, onSave, onCancel, onArchive }) {
  const t = useTheme();
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState(initial?.type || "bank");
  const [initialBalance, setInitialBalance] = useState(initial ? String(initial.initialBalance) : "0");
  const [currency, setCurrency] = useState(initial?.currency || state.meta.currency);
  const canSave = name.trim().length > 0;
  return (
    <div>
      <FieldLabel>Account name</FieldLabel>
      <TextInput value={name} onChange={setName} placeholder="e.g. Main Bank" autoFocus />
      <div className="mt-5"><FieldLabel>Type</FieldLabel>
        <SelectPills value={type} onChange={setType} options={ACCOUNT_TYPES} getLabel={(o) => o.label} />
      </div>
      <div className="mt-5"><FieldLabel>Currency</FieldLabel>
        <SelectPills value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ id: c, label: c }))} getLabel={(o) => o.label} />
        {currency !== state.meta.currency && (
          <div className="mt-2 text-[11px]" style={{ color: t.textFaint }}>
            This account's balance is in {currency}. It'll convert to {state.meta.currency} for your net worth total.
          </div>
        )}
      </div>
      <div className="mt-5">
        <FieldLabel>{initial ? "Initial balance" : "Starting balance"}</FieldLabel>
        <TextInput type="number" inputMode="decimal" step="0.01" value={initialBalance} onChange={setInitialBalance} placeholder="0.00" />
      </div>
      <div className="mt-6 flex gap-2">
        {initial && onArchive && (
          <button onClick={onArchive} className="p-3 rounded-full active:opacity-60" style={{ border: `1px solid ${t.line}` }}>
            <Trash2 size={18} color={t.red} />
          </button>
        )}
        <PrimaryButton full disabled={!canSave} onClick={() => onSave({
          id: initial?.id || uid(), name: name.trim(), type, initialBalance: parseFloat(initialBalance || "0"),
          status: initial?.status || "active", currency, createdAt: initial?.createdAt || todayISO(),
        })}>{initial ? "Save changes" : "Add account"}</PrimaryButton>
      </div>
    </div>
  );
}

export default function AccountsScreen({ state, onAdd, onEdit, fxRates }) {
  const t = useTheme();
  const active = state.accounts.filter((a) => a.status === "active");
  const total = totalBalance(state, fxRates);
  return (
    <Screen>
      <div className="px-4 pt-6 flex items-center justify-between">
        <div className="text-[20px] font-medium" style={{ fontFamily: FONT_DISPLAY }}>Accounts</div>
        <button onClick={onAdd} className="p-2.5 rounded-full active:opacity-60" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <Plus size={17} color={t.text} />
        </button>
      </div>
      <div className="px-4 mt-3">
        <div className="text-[12px]" style={{ color: t.textSoft }}>Total across all accounts</div>
        <div className="mt-1"><Amount value={total} size="xxl" /> <span className="text-[13px]" style={{ color: t.textSoft }}>{state.meta.currency}</span></div>
      </div>

      {active.length === 0 ? (
        <EmptyState icon={<Wallet size={34} strokeWidth={1.3} />} title="No accounts yet" subtitle="Add a bank, cash, or card account to start tracking." actionLabel="Add account" onAction={onAdd} />
      ) : (
        <div className="px-4 mt-5 flex flex-col gap-3">
          {active.map((a) => {
            const meta = ACCOUNT_TYPES.find((tp) => tp.id === a.type) || ACCOUNT_TYPES[0];
            const Icon = meta.icon;
            const bal = accountBalance(state, a.id);
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
                  <Amount value={bal} size="base" tone={bal < 0 ? "neg" : undefined} />
                  {a.currency && a.currency !== state.meta.currency && (
                    <div className="text-[11px]" style={{ color: t.textFaint }}>{a.currency}</div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
