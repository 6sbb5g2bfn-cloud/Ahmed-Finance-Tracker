import { useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { FONT_DISPLAY } from "../lib/constants";
import { uid, todayISO, addMonthsISO, fmtDate, fmtNum } from "../lib/utils";
import { goalContributed, goalRequiredMonthly } from "../lib/calculations";
import { Screen, Card, Amount, ProgressBar, EmptyState, IconBadge, FieldLabel, TextInput, SelectPills, PrimaryButton } from "../components/ui";

export function SavingsGoalForm({ state, initial, onSave, onCancel, onDelete }) {
  const t = useTheme();
  const [name, setName] = useState(initial?.name || "");
  const [target, setTarget] = useState(initial ? String(initial.target) : "");
  const [targetDate, setTargetDate] = useState(initial?.targetDate || addMonthsISO(todayISO(), 12));
  const [accountId, setAccountId] = useState(initial?.accountId || state.accounts[0]?.id);
  const canSave = name.trim() && parseFloat(target) > 0;
  return (
    <div>
      <FieldLabel>Goal name</FieldLabel>
      <TextInput value={name} onChange={setName} placeholder="e.g. New Car" autoFocus />
      <div className="mt-5"><FieldLabel>Target amount ({state.meta.currency})</FieldLabel>
        <TextInput type="number" inputMode="decimal" step="0.01" value={target} onChange={setTarget} placeholder="0.00" /></div>
      <div className="mt-5"><FieldLabel>Target date</FieldLabel>
        <TextInput type="date" value={targetDate} onChange={setTargetDate} /></div>
      <div className="mt-5"><FieldLabel>Savings account (optional)</FieldLabel>
        <SelectPills options={state.accounts.filter((a) => a.status === "active")} value={accountId} onChange={setAccountId} getLabel={(a) => a.name} /></div>
      <div className="mt-6 flex gap-2">
        {initial && onDelete && <button onClick={onDelete} className="p-3 rounded-full active:opacity-60" style={{ border: `1px solid ${t.line}` }}><Trash2 size={18} color={t.red} /></button>}
        <PrimaryButton full disabled={!canSave} onClick={() => onSave({
          id: initial?.id || uid(), name: name.trim(), target: parseFloat(target), targetDate, accountId,
          contributions: initial?.contributions || [],
        })}>{initial ? "Save changes" : "Add goal"}</PrimaryButton>
      </div>
    </div>
  );
}

export default function SavingsGoalsScreen({ state, onAdd, onEdit, onContribute }) {
  const t = useTheme();
  return (
    <Screen>
      <div className="px-4 pt-6 flex items-center justify-between">
        <div className="text-[20px] font-medium" style={{ fontFamily: FONT_DISPLAY }}>Savings goals</div>
        <button onClick={onAdd} className="p-2.5 rounded-full active:opacity-60" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <Plus size={17} color={t.text} />
        </button>
      </div>
      {state.savingsGoals.length === 0 ? (
        <EmptyState icon={<Target size={34} strokeWidth={1.3} />} title="No savings goals yet" subtitle="Set a target and track your progress over time." actionLabel="Add goal" onAction={onAdd} />
      ) : (
        <div className="px-4 mt-4 flex flex-col gap-3">
          {state.savingsGoals.map((g) => {
            const current = goalContributed(g);
            const pct = (current / g.target) * 100;
            const remaining = Math.max(0, g.target - current);
            const monthly = goalRequiredMonthly(g);
            const done = remaining <= 0;
            return (
              <Card key={g.id} className="p-4">
                <div className="flex items-center justify-between" onClick={() => onEdit(g)}>
                  <div className="flex items-center gap-3">
                    <IconBadge bg={t.goldSoft}><Target size={16} color={t.gold} /></IconBadge>
                    <div>
                      <div className="text-[14px] font-medium">{g.name}</div>
                      <div className="text-[12px]" style={{ color: t.textSoft }}>Target {fmtDate(g.targetDate)}</div>
                    </div>
                  </div>
                  <Amount value={current} size="sm" tone="gold" />
                </div>
                <div className="mt-3"><ProgressBar pct={pct} color={t.gold} /></div>
                <div className="flex items-center justify-between mt-1.5 text-[12px]" style={{ color: t.textSoft }}>
                  <span>{fmtNum(current)} of {fmtNum(g.target)}</span>
                  <span>{Math.round(pct)}%</span>
                </div>
                {!done ? (
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[12px]" style={{ color: t.textSoft }}>~{fmtNum(monthly)}/mo needed</span>
                    <button onClick={() => onContribute(g)} className="px-3.5 py-1.5 rounded-full text-[12px] font-medium" style={{ background: t.goldSoft, color: t.gold }}>Add contribution</button>
                  </div>
                ) : (
                  <div className="mt-3 text-[12px] font-medium" style={{ color: t.green }}>Goal reached ✓</div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
