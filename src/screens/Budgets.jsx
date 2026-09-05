import { useState } from "react";
import { Plus, PieChart as PieIcon, Trash2 } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { FONT_DISPLAY } from "../lib/constants";
import { uid, thisMonthKey, fmtNum } from "../lib/utils";
import { categorySpend } from "../lib/calculations";
import { Screen, Card, ProgressBar, EmptyState, IconBadge, CategoryIcon, FieldLabel, TextInput, SelectPills, PrimaryButton } from "../components/ui";

export function BudgetForm({ state, initial, onSave, onCancel, onDelete, usedCategoryIds }) {
  const expenseCats = state.categories.filter((c) => c.type === "expense" && (!usedCategoryIds.includes(c.id) || c.id === initial?.categoryId));
  const [categoryId, setCategoryId] = useState(initial?.categoryId || expenseCats[0]?.id || null);
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const canSave = categoryId && parseFloat(amount) > 0;
  const t = useTheme();
  return (
    <div>
      <FieldLabel>Category</FieldLabel>
      <SelectPills options={expenseCats} value={categoryId} onChange={setCategoryId} getLabel={(c) => c.name} />
      <div className="mt-5">
        <FieldLabel>Monthly limit ({state.meta.currency})</FieldLabel>
        <TextInput type="number" inputMode="decimal" step="0.01" value={amount} onChange={setAmount} placeholder="0.00" autoFocus />
      </div>
      <div className="mt-6 flex gap-2">
        {initial && onDelete && <button onClick={onDelete} className="p-3 rounded-full active:opacity-60" style={{ border: `1px solid ${t.line}` }}><Trash2 size={18} color={t.red} /></button>}
        <PrimaryButton full disabled={!canSave} onClick={() => onSave({ id: initial?.id || uid(), categoryId, amount: parseFloat(amount) })}>
          {initial ? "Save changes" : "Add budget"}
        </PrimaryButton>
      </div>
    </div>
  );
}

export default function BudgetsScreen({ state, onAdd, onEdit }) {
  const t = useTheme();
  const key = thisMonthKey();
  const spend = categorySpend(state, key);
  const rows = state.budgets.map((b) => {
    const spent = spend[b.categoryId] || 0;
    const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
    return { ...b, spent, pct, cat: state.categories.find((c) => c.id === b.categoryId) };
  }).sort((a, b) => b.pct - a.pct);
  const totalBudget = rows.reduce((s, r) => s + r.amount, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);

  return (
    <Screen>
      <div className="px-4 pt-6 flex items-center justify-between">
        <div className="text-[20px] font-medium" style={{ fontFamily: FONT_DISPLAY }}>Budgets</div>
        <button onClick={onAdd} className="p-2.5 rounded-full active:opacity-60" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <Plus size={17} color={t.text} />
        </button>
      </div>
      {rows.length > 0 && (
        <div className="px-4 mt-3">
          <Card className="p-4">
            <div className="flex items-center justify-between text-[13px] mb-1.5">
              <span className="font-medium">This month, all categories</span>
              <span style={{ color: t.textSoft }}>{fmtNum(totalSpent)} / {fmtNum(totalBudget)}</span>
            </div>
            <ProgressBar pct={totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0} color={t.green} />
          </Card>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={<PieIcon size={34} strokeWidth={1.3} />} title="No budgets yet" subtitle="Set a monthly limit for a category to track your spending." actionLabel="Add budget" onAction={onAdd} />
      ) : (
        <div className="px-4 mt-4 flex flex-col gap-3">
          {rows.map((b) => (
            <Card key={b.id} className="p-4" onClick={() => onEdit(b)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <IconBadge bg={t.bgAlt}><CategoryIcon category={b.cat} /></IconBadge>
                  <span className="text-[14px] font-medium">{b.cat?.name}</span>
                </div>
                <span className="text-[12px]" style={{ color: t.textSoft }}>{Math.round(b.pct)}%</span>
              </div>
              <ProgressBar pct={b.pct} color={b.pct >= 100 ? t.red : b.pct >= 80 ? t.gold : t.green} />
              <div className="flex items-center justify-between mt-1.5 text-[12px]" style={{ color: t.textSoft }}>
                <span>{fmtNum(b.spent)} spent</span>
                <span>{fmtNum(Math.max(0, b.amount - b.spent))} left</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  );
}
