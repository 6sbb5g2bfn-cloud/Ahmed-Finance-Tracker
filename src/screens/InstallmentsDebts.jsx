import { useState } from "react";
import { Plus, CreditCard, Users, User, Trash2 } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { FONT_DISPLAY } from "../lib/constants";
import { uid, todayISO, fmtDate, fmtNum } from "../lib/utils";
import { installmentRemaining, debtRemaining } from "../lib/calculations";
import { Screen, Card, Amount, ProgressBar, EmptyState, IconBadge, FieldLabel, TextInput, SelectPills, PrimaryButton } from "../components/ui";

export function InstallmentForm({ state, initial, onSave, onCancel, onDelete }) {
  const t = useTheme();
  const [name, setName] = useState(initial?.name || "");
  const [totalAmount, setTotalAmount] = useState(initial ? String(initial.totalAmount) : "");
  const [numberOfPayments, setNumberOfPayments] = useState(initial ? String(initial.numberOfPayments) : "12");
  const [monthlyPayment, setMonthlyPayment] = useState(initial ? String(initial.monthlyPayment) : "");
  const [startDate, setStartDate] = useState(initial?.startDate || todayISO());
  const [accountId, setAccountId] = useState(initial?.accountId || state.accounts[0]?.id);
  const debtCat = state.categories.find((c) => c.name === "Debt Payment");

  const autoMonthly = () => {
    const tot = parseFloat(totalAmount), n = parseInt(numberOfPayments);
    if (tot > 0 && n > 0) setMonthlyPayment(String(Math.round((tot / n) * 100) / 100));
  };

  const canSave = name.trim() && parseFloat(totalAmount) > 0 && parseInt(numberOfPayments) > 0 && parseFloat(monthlyPayment) > 0 && accountId;

  return (
    <div>
      <FieldLabel>Item name</FieldLabel>
      <TextInput value={name} onChange={setName} placeholder="e.g. iPhone 15" autoFocus />
      <div className="mt-5"><FieldLabel>Total amount ({state.meta.currency})</FieldLabel>
        <TextInput type="number" inputMode="decimal" step="0.01" value={totalAmount} onChange={(v) => { setTotalAmount(v); }} onBlur={autoMonthly} placeholder="0.00" /></div>
      <div className="mt-5"><FieldLabel>Number of payments</FieldLabel>
        <TextInput type="number" inputMode="numeric" value={numberOfPayments} onChange={setNumberOfPayments} placeholder="12" /></div>
      <div className="mt-2"><button onClick={autoMonthly} className="text-[12px] font-medium" style={{ color: t.blue }}>Auto-calculate monthly payment</button></div>
      <div className="mt-3"><FieldLabel>Monthly payment ({state.meta.currency})</FieldLabel>
        <TextInput type="number" inputMode="decimal" step="0.01" value={monthlyPayment} onChange={setMonthlyPayment} placeholder="0.00" /></div>
      <div className="mt-5"><FieldLabel>Start date</FieldLabel>
        <TextInput type="date" value={startDate} onChange={setStartDate} /></div>
      <div className="mt-5"><FieldLabel>Account</FieldLabel>
        <SelectPills options={state.accounts.filter((a) => a.status === "active")} value={accountId} onChange={setAccountId} getLabel={(a) => a.name} /></div>
      <div className="mt-6 flex gap-2">
        {initial && onDelete && <button onClick={onDelete} className="p-3 rounded-full active:opacity-60" style={{ border: `1px solid ${t.line}` }}><Trash2 size={18} color={t.red} /></button>}
        <PrimaryButton full disabled={!canSave} onClick={() => onSave({
          id: initial?.id || uid(), name: name.trim(), totalAmount: parseFloat(totalAmount), numberOfPayments: parseInt(numberOfPayments),
          monthlyPayment: parseFloat(monthlyPayment), startDate, accountId, categoryId: debtCat?.id || null, payments: initial?.payments || [],
        })}>{initial ? "Save changes" : "Add installment"}</PrimaryButton>
      </div>
    </div>
  );
}

export function DebtForm({ state, initial, onSave, onCancel, onDelete }) {
  const t = useTheme();
  const [direction, setDirection] = useState(initial?.direction || "owe");
  const [person, setPerson] = useState(initial?.person || "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [date, setDate] = useState(initial?.date || todayISO());
  const [hasDue, setHasDue] = useState(!!initial?.dueDate);
  const [dueDate, setDueDate] = useState(initial?.dueDate || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const canSave = person.trim() && parseFloat(amount) > 0;
  return (
    <div>
      <FieldLabel>Direction</FieldLabel>
      <SelectPills value={direction} onChange={setDirection} options={[{ id: "owe", label: "I owe them" }, { id: "owed", label: "They owe me" }]} />
      <div className="mt-5"><FieldLabel>Person</FieldLabel><TextInput value={person} onChange={setPerson} placeholder="e.g. Ahmed" autoFocus /></div>
      <div className="mt-5"><FieldLabel>Amount ({state.meta.currency})</FieldLabel><TextInput type="number" inputMode="decimal" step="0.01" value={amount} onChange={setAmount} placeholder="0.00" /></div>
      <div className="mt-5"><FieldLabel>Date</FieldLabel><TextInput type="date" value={date} onChange={setDate} /></div>
      <div className="mt-5 flex items-center justify-between">
        <FieldLabel>Has a due date</FieldLabel>
        <button onClick={() => setHasDue(!hasDue)} className="w-11 h-6 rounded-full relative shrink-0" style={{ background: hasDue ? t.green : t.line }}>
          <span className="absolute top-0.5 rounded-full bg-white transition-all" style={{ width: 20, height: 20, left: hasDue ? 22 : 2 }} />
        </button>
      </div>
      {hasDue && <div className="mt-3"><TextInput type="date" value={dueDate} onChange={setDueDate} /></div>}
      <div className="mt-5"><FieldLabel>Notes (optional)</FieldLabel><TextInput value={notes} onChange={setNotes} placeholder="What's this for?" /></div>
      <div className="mt-6 flex gap-2">
        {initial && onDelete && <button onClick={onDelete} className="p-3 rounded-full active:opacity-60" style={{ border: `1px solid ${t.line}` }}><Trash2 size={18} color={t.red} /></button>}
        <PrimaryButton full disabled={!canSave} onClick={() => onSave({
          id: initial?.id || uid(), direction, person: person.trim(), amount: parseFloat(amount), date,
          dueDate: hasDue ? dueDate : null, notes, status: initial?.status || "open", payments: initial?.payments || [],
        })}>{initial ? "Save changes" : "Add debt"}</PrimaryButton>
      </div>
    </div>
  );
}

export function RecordPaymentForm({ state, defaultAmount, defaultAccountId, defaultDate, label, accountLabel, onSave, onCancel }) {
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : "");
  const [date, setDate] = useState(defaultDate || todayISO());
  const [accountId, setAccountId] = useState(defaultAccountId || state.accounts.find((a) => a.status === "active")?.id);
  const canSave = parseFloat(amount) > 0 && accountId;
  return (
    <div>
      <FieldLabel>{label || "Amount"} ({state.meta.currency})</FieldLabel>
      <TextInput type="number" inputMode="decimal" step="0.01" value={amount} onChange={setAmount} autoFocus />
      <div className="mt-5"><FieldLabel>Date</FieldLabel><TextInput type="date" value={date} onChange={setDate} /></div>
      <div className="mt-5"><FieldLabel>{accountLabel || "Account"}</FieldLabel>
        <SelectPills options={state.accounts.filter((a) => a.status === "active")} value={accountId} onChange={setAccountId} getLabel={(a) => a.name} /></div>
      <div className="mt-6"><PrimaryButton full disabled={!canSave} onClick={() => onSave(parseFloat(amount), date, accountId)}>Confirm</PrimaryButton></div>
    </div>
  );
}

function DebtCard({ d, onEdit, onPay }) {
  const t = useTheme();
  const remaining = debtRemaining(d);
  const pct = ((d.amount - remaining) / d.amount) * 100;
  const settled = remaining <= 0;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between" onClick={onEdit}>
        <div className="flex items-center gap-3">
          <IconBadge bg={t.bgAlt}><User size={16} color={t.text} /></IconBadge>
          <div>
            <div className="text-[14px] font-medium">{d.person}</div>
            <div className="text-[12px]" style={{ color: t.textSoft }}>{d.dueDate ? "Due " + fmtDate(d.dueDate) : "No due date"}</div>
          </div>
        </div>
        <div className="text-right">
          <Amount value={remaining} size="sm" tone={settled ? undefined : d.direction === "owed" ? "pos" : "neg"} />
          <div className="text-[11px]" style={{ color: t.textFaint }}>of {fmtNum(d.amount)}</div>
        </div>
      </div>
      <div className="mt-3"><ProgressBar pct={pct} color={d.direction === "owed" ? t.green : t.gold} /></div>
      {!settled ? (
        <button onClick={onPay} className="mt-2.5 w-full py-2 rounded-full text-[12px] font-medium" style={{ background: t.bgAlt, color: t.text }}>
          {d.direction === "owe" ? "Record payment" : "Record receipt"}
        </button>
      ) : (
        <div className="mt-2.5 text-[12px] font-medium" style={{ color: t.green }}>Settled ✓</div>
      )}
    </Card>
  );
}

export default function InstallmentsDebtsScreen({ state, onAddInstallment, onEditInstallment, onPayInstallment, onAddDebt, onEditDebt, onPayDebt }) {
  const t = useTheme();
  const [tab, setTab] = useState("installments");
  const owe = state.debts.filter((d) => d.direction === "owe");
  const owed = state.debts.filter((d) => d.direction === "owed");

  return (
    <Screen>
      <div className="px-4 pt-6 flex items-center justify-between">
        <div className="text-[20px] font-medium" style={{ fontFamily: FONT_DISPLAY }}>Installments & debts</div>
        <button onClick={() => tab === "installments" ? onAddInstallment() : onAddDebt()} className="p-2.5 rounded-full active:opacity-60" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <Plus size={17} color={t.text} />
        </button>
      </div>
      <div className="px-4 mt-3">
        <SelectPills value={tab} onChange={setTab} options={[{ id: "installments", label: "Installments" }, { id: "debts", label: "Debts" }]} />
      </div>

      {tab === "installments" ? (
        state.installments.length === 0 ? (
          <EmptyState icon={<CreditCard size={34} strokeWidth={1.3} />} title="No installments yet" subtitle="Track a purchase you're paying off over time." actionLabel="Add installment" onAction={onAddInstallment} />
        ) : (
          <div className="px-4 mt-4 flex flex-col gap-3">
            {state.installments.map((inst) => {
              const { remaining, paidCount, nextDate, complete } = installmentRemaining(inst);
              const pct = ((inst.totalAmount - remaining) / inst.totalAmount) * 100;
              return (
                <Card key={inst.id} className="p-4">
                  <div className="flex items-center justify-between" onClick={() => onEditInstallment(inst)}>
                    <div className="flex items-center gap-3">
                      <IconBadge bg={t.bgAlt}><CreditCard size={16} color={t.text} /></IconBadge>
                      <div>
                        <div className="text-[14px] font-medium">{inst.name}</div>
                        <div className="text-[12px]" style={{ color: t.textSoft }}>{paidCount}/{inst.numberOfPayments} paid</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Amount value={remaining} size="sm" tone={complete ? undefined : "neg"} />
                      <div className="text-[11px]" style={{ color: t.textFaint }}>remaining</div>
                    </div>
                  </div>
                  <div className="mt-3"><ProgressBar pct={pct} color={t.green} /></div>
                  {!complete ? (
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="text-[12px]" style={{ color: t.textSoft }}>Next: {fmtDate(nextDate)}</span>
                      <button onClick={() => onPayInstallment(inst)} className="px-3.5 py-1.5 rounded-full text-[12px] font-medium" style={{ background: t.greenSoft, color: t.green }}>Record payment</button>
                    </div>
                  ) : (
                    <div className="mt-2.5 text-[12px] font-medium" style={{ color: t.green }}>Paid off ✓</div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <div className="px-4 mt-4">
          {owe.length === 0 && owed.length === 0 ? (
            <EmptyState icon={<Users size={34} strokeWidth={1.3} />} title="No debts tracked" subtitle="Track money you owe or money owed to you." actionLabel="Add debt" onAction={onAddDebt} />
          ) : (
            <>
              {owe.length > 0 && <>
                <div className="text-[12px] font-medium mb-1.5" style={{ color: t.textSoft }}>Money I owe</div>
                <div className="flex flex-col gap-3 mb-5">
                  {owe.map((d) => <DebtCard key={d.id} d={d} onEdit={() => onEditDebt(d)} onPay={() => onPayDebt(d)} />)}
                </div>
              </>}
              {owed.length > 0 && <>
                <div className="text-[12px] font-medium mb-1.5" style={{ color: t.textSoft }}>Owed to me</div>
                <div className="flex flex-col gap-3">
                  {owed.map((d) => <DebtCard key={d.id} d={d} onEdit={() => onEditDebt(d)} onPay={() => onPayDebt(d)} />)}
                </div>
              </>}
            </>
          )}
        </div>
      )}
    </Screen>
  );
}
