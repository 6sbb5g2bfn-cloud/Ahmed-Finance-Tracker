import { useState } from "react";
import { Plus, Repeat, Trash2, Check } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { FONT_DISPLAY, FREQUENCIES, COMMITMENT_TYPES } from "../lib/constants";
import { uid, todayISO, fmtDate, nextUnpostedOccurrence } from "../lib/utils";
import { Screen, Card, Amount, EmptyState, IconBadge, CategoryIcon, FieldLabel, TextInput, SelectPills, PrimaryButton } from "../components/ui";

export function RecurringForm({ state, initial, onSave, onCancel, onDelete }) {
  const t = useTheme();
  const [name, setName] = useState(initial?.name || "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [frequency, setFrequency] = useState(initial?.frequency || "monthly");
  const [commitmentType, setCommitmentType] = useState(initial?.commitmentType || "subscription");
  const [categoryId, setCategoryId] = useState(initial?.categoryId || state.categories.find((c) => c.type === "expense")?.id);
  const [accountId, setAccountId] = useState(initial?.accountId || state.accounts[0]?.id);
  const [startDate, setStartDate] = useState(initial?.startDate || todayISO());
  const [hasEnd, setHasEnd] = useState(!!initial?.endDate);
  const [endDate, setEndDate] = useState(initial?.endDate || "");
  const [active, setActive] = useState(initial?.active !== false);
  const expenseCats = state.categories.filter((c) => c.type === "expense");
  const canSave = name.trim() && parseFloat(amount) > 0 && categoryId && accountId && startDate;

  return (
    <div>
      <FieldLabel>Name</FieldLabel>
      <TextInput value={name} onChange={setName} placeholder="e.g. Netflix" autoFocus />
      <div className="mt-5"><FieldLabel>Amount ({state.meta.currency})</FieldLabel>
        <TextInput type="number" inputMode="decimal" step="0.01" value={amount} onChange={setAmount} placeholder="0.00" /></div>
      <div className="mt-5"><FieldLabel>Type</FieldLabel>
        <SelectPills options={COMMITMENT_TYPES} value={commitmentType} onChange={setCommitmentType} getLabel={(o) => o.label} /></div>
      <div className="mt-5"><FieldLabel>Frequency</FieldLabel>
        <SelectPills options={FREQUENCIES} value={frequency} onChange={setFrequency} getLabel={(o) => o.label} /></div>
      <div className="mt-5"><FieldLabel>Category</FieldLabel>
        <SelectPills options={expenseCats} value={categoryId} onChange={setCategoryId} getLabel={(c) => c.name} /></div>
      <div className="mt-5"><FieldLabel>Account</FieldLabel>
        <SelectPills options={state.accounts.filter((a) => a.status === "active")} value={accountId} onChange={setAccountId} getLabel={(a) => a.name} /></div>
      <div className="mt-5"><FieldLabel>Start / first due date</FieldLabel>
        <TextInput type="date" value={startDate} onChange={setStartDate} /></div>
      <div className="mt-5 flex items-center justify-between">
        <FieldLabel>Has an end date</FieldLabel>
        <button onClick={() => setHasEnd(!hasEnd)} className="w-11 h-6 rounded-full relative shrink-0" style={{ background: hasEnd ? t.green : t.line }}>
          <span className="absolute top-0.5 rounded-full bg-white transition-all" style={{ width: 20, height: 20, left: hasEnd ? 22 : 2 }} />
        </button>
      </div>
      {hasEnd && <div className="mt-3"><TextInput type="date" value={endDate} onChange={setEndDate} /></div>}
      <div className="mt-5 flex items-center justify-between">
        <FieldLabel>Active</FieldLabel>
        <button onClick={() => setActive(!active)} className="w-11 h-6 rounded-full relative shrink-0" style={{ background: active ? t.green : t.line }}>
          <span className="absolute top-0.5 rounded-full bg-white transition-all" style={{ width: 20, height: 20, left: active ? 22 : 2 }} />
        </button>
      </div>
      <div className="mt-6 flex gap-2">
        {initial && onDelete && <button onClick={onDelete} className="p-3 rounded-full active:opacity-60" style={{ border: `1px solid ${t.line}` }}><Trash2 size={18} color={t.red} /></button>}
        <PrimaryButton full disabled={!canSave} onClick={() => onSave({
          id: initial?.id || uid(), name: name.trim(), amount: parseFloat(amount), frequency, commitmentType,
          categoryId, accountId, startDate, endDate: hasEnd ? endDate : null, active, postedDates: initial?.postedDates || [],
        })}>{initial ? "Save changes" : "Add recurring payment"}</PrimaryButton>
      </div>
    </div>
  );
}

export default function RecurringScreen({ state, onAdd, onEdit, onMarkPaid }) {
  const t = useTheme();
  const rows = state.recurringPayments.map((r) => ({ ...r, next: nextUnpostedOccurrence(r), cat: state.categories.find((c) => c.id === r.categoryId) }));
  const active = rows.filter((r) => r.active).sort((a, b) => (a.next || "9999").localeCompare(b.next || "9999"));
  const inactive = rows.filter((r) => !r.active);

  return (
    <Screen>
      <div className="px-4 pt-6 flex items-center justify-between">
        <div className="text-[20px] font-medium" style={{ fontFamily: FONT_DISPLAY }}>Recurring & bills</div>
        <button onClick={onAdd} className="p-2.5 rounded-full active:opacity-60" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <Plus size={17} color={t.text} />
        </button>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<Repeat size={34} strokeWidth={1.3} />} title="Nothing recurring yet" subtitle="Add subscriptions, bills, or fixed commitments like rent." actionLabel="Add recurring payment" onAction={onAdd} />
      ) : (
        <div className="px-4 mt-4 flex flex-col gap-3">
          {active.map((r) => {
            const overdue = r.next && r.next < todayISO();
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-center justify-between" onClick={() => onEdit(r)}>
                  <div className="flex items-center gap-3">
                    <IconBadge bg={t.bgAlt}><CategoryIcon category={r.cat} /></IconBadge>
                    <div>
                      <div className="text-[14px] font-medium">{r.name}</div>
                      <div className="text-[12px]" style={{ color: overdue ? t.red : t.textSoft }}>
                        {FREQUENCIES.find((f) => f.id === r.frequency)?.label} · {r.next ? (overdue ? "Overdue " : "Due ") + fmtDate(r.next) : "Ended"}
                      </div>
                    </div>
                  </div>
                  <Amount value={r.amount} size="sm" />
                </div>
                {r.next && (
                  <button onClick={() => onMarkPaid(r, r.next)} className="mt-3 w-full py-2 rounded-full text-[12px] font-medium flex items-center justify-center gap-1.5"
                    style={{ background: t.greenSoft, color: t.green }}>
                    <Check size={13} /> Mark as paid
                  </button>
                )}
              </Card>
            );
          })}
          {inactive.length > 0 && (
            <>
              <div className="text-[12px] font-medium mt-2 mb-1 px-1" style={{ color: t.textFaint }}>Inactive</div>
              {inactive.map((r) => (
                <Card key={r.id} className="p-4 flex items-center justify-between opacity-60" onClick={() => onEdit(r)}>
                  <div className="flex items-center gap-3">
                    <IconBadge bg={t.bgAlt}><CategoryIcon category={r.cat} /></IconBadge>
                    <div className="text-[14px] font-medium">{r.name}</div>
                  </div>
                  <Amount value={r.amount} size="sm" />
                </Card>
              ))}
            </>
          )}
        </div>
      )}
    </Screen>
  );
}
