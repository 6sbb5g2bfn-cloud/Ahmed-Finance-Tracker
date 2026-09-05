import { useState, useEffect, useMemo } from "react";
import { Search, SlidersHorizontal, Receipt, ArrowLeftRight, Trash2 } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { FONT_DISPLAY } from "../lib/constants";
import { fmtDate, todayISO, uid } from "../lib/utils";
import {
  Screen, Card, Row, Amount, EmptyState, IconBadge, CategoryIcon, Sheet, FieldLabel, SelectPills,
  GhostButton, PrimaryButton, TextInput, ConfirmDialog,
} from "../components/ui";

export function TransactionForm({ state, initial, onSave, onDelete, onCancel }) {
  const t = useTheme();
  const [type, setType] = useState(initial?.type || "expense");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId || null);
  const [accountId, setAccountId] = useState(initial?.accountId || state.accounts[0]?.id || null);
  const [toAccountId, setToAccountId] = useState(initial?.toAccountId || null);
  const [date, setDate] = useState(initial?.date || todayISO());
  const [notes, setNotes] = useState(initial?.notes || "");
  const [confirmDel, setConfirmDel] = useState(false);

  const cats = state.categories.filter((c) => c.type === type || c.type === "both");
  useEffect(() => {
    if (type !== "transfer" && !cats.find((c) => c.id === categoryId)) setCategoryId(cats[0]?.id || null);
    // eslint-disable-next-line
  }, [type]);

  const activeAccounts = state.accounts.filter((a) => a.status === "active");
  const canSave = amount && parseFloat(amount) > 0 && accountId && (type !== "transfer" || (toAccountId && toAccountId !== accountId));

  const submit = () => {
    if (!canSave) return;
    onSave({
      id: initial?.id || uid(),
      type, amount: parseFloat(amount), categoryId: type === "transfer" ? null : categoryId,
      accountId, toAccountId: type === "transfer" ? toAccountId : null,
      date, notes, createdAt: initial?.createdAt || todayISO(),
    });
  };

  if (activeAccounts.length === 0) {
    return (
      <div className="py-8 text-center">
        <div className="text-[14px] font-medium mb-1.5" style={{ color: t.text }}>Add an account first</div>
        <div className="text-[13px] mb-4" style={{ color: t.textSoft }}>You need at least one account before you can record a transaction.</div>
        <GhostButton onClick={onCancel}>Got it</GhostButton>
      </div>
    );
  }

  return (
    <div className="pb-2">
      <SelectPills
        options={[{ id: "expense", label: "Expense" }, { id: "income", label: "Income" }, { id: "transfer", label: "Transfer" }]}
        value={type} onChange={setType}
      />

      <div className="mt-5">
        <FieldLabel>Amount ({state.meta.currency})</FieldLabel>
        <input
          autoFocus type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
          value={amount} onChange={(e) => setAmount(e.target.value)}
          className="w-full text-3xl bg-transparent outline-none py-1"
          style={{ fontFamily: FONT_DISPLAY, color: t.text, borderBottom: `2px solid ${t.line}`, fontVariantNumeric: "tabular-nums" }}
        />
      </div>

      {type !== "transfer" && (
        <div className="mt-5">
          <FieldLabel>Category</FieldLabel>
          <SelectPills options={cats} value={categoryId} onChange={setCategoryId} getLabel={(c) => c.name} />
        </div>
      )}

      <div className="mt-5">
        <FieldLabel>{type === "transfer" ? "From account" : "Account"}</FieldLabel>
        <SelectPills options={activeAccounts} value={accountId} onChange={setAccountId} getLabel={(a) => a.name} />
      </div>

      {type === "transfer" && (
        <div className="mt-5">
          <FieldLabel>To account</FieldLabel>
          <SelectPills options={activeAccounts.filter((a) => a.id !== accountId)} value={toAccountId} onChange={setToAccountId} getLabel={(a) => a.name} />
        </div>
      )}

      <div className="mt-5">
        <FieldLabel>Date</FieldLabel>
        <TextInput type="date" value={date} onChange={setDate} />
      </div>

      <div className="mt-5">
        <FieldLabel>Notes (optional)</FieldLabel>
        <TextInput value={notes} onChange={setNotes} placeholder="Add a note" />
      </div>

      <div className="mt-6 flex gap-2">
        {initial && onDelete && (
          <button onClick={() => setConfirmDel(true)} className="p-3 rounded-full active:opacity-60" style={{ border: `1px solid ${t.line}` }}>
            <Trash2 size={18} color={t.red} />
          </button>
        )}
        <PrimaryButton onClick={submit} disabled={!canSave} full>
          {initial ? "Save changes" : "Add transaction"}
        </PrimaryButton>
      </div>

      <ConfirmDialog
        open={confirmDel} title="Delete transaction?" message="This will remove it and update every total that depends on it."
        onCancel={() => setConfirmDel(false)} onConfirm={() => { setConfirmDel(false); onDelete(initial.id); }}
      />
    </div>
  );
}

export default function TransactionsScreen({ state, onEdit, onAdd }) {
  const t = useTheme();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [fType, setFType] = useState("all");
  const [fAccount, setFAccount] = useState("all");
  const [fCategory, setFCategory] = useState("all");

  const catName = (id) => state.categories.find((c) => c.id === id)?.name || "";
  const accName = (id) => state.accounts.find((a) => a.id === id)?.name || "";

  const filtered = useMemo(() => {
    let rows = state.transactions.slice();
    if (fType !== "all") rows = rows.filter((r) => r.type === fType);
    if (fAccount !== "all") rows = rows.filter((r) => r.accountId === fAccount || r.toAccountId === fAccount);
    if (fCategory !== "all") rows = rows.filter((r) => r.categoryId === fCategory);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      rows = rows.filter((r) => (r.notes || "").toLowerCase().includes(s) || catName(r.categoryId).toLowerCase().includes(s) || accName(r.accountId).toLowerCase().includes(s));
    }
    switch (sort) {
      case "oldest": rows.sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || "").localeCompare(b.createdAt || "")); break;
      case "highest": rows.sort((a, b) => b.amount - a.amount); break;
      case "lowest": rows.sort((a, b) => a.amount - b.amount); break;
      default: rows.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
    }
    return rows;
  }, [state, q, sort, fType, fAccount, fCategory]);

  const groups = useMemo(() => {
    const map = {};
    for (const r of filtered) { (map[r.date] = map[r.date] || []).push(r); }
    return Object.entries(map).sort((a, b) => sort === "oldest" ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0]));
  }, [filtered, sort]);

  const activeFilters = (fType !== "all" ? 1 : 0) + (fAccount !== "all" ? 1 : 0) + (fCategory !== "all" ? 1 : 0);

  return (
    <Screen>
      <div className="px-4 pt-6">
        <div className="text-[20px] font-medium mb-3" style={{ fontFamily: FONT_DISPLAY }}>Transactions</div>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3.5 rounded-xl" style={{ background: t.card, border: `1px solid ${t.line}` }}>
            <Search size={15} color={t.textFaint} />
            <input
              value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transactions"
              className="flex-1 py-3 bg-transparent outline-none text-[14px]" style={{ color: t.text }}
            />
          </div>
          <button onClick={() => setFilterOpen(true)} className="px-3.5 rounded-xl relative flex items-center justify-center" style={{ background: t.card, border: `1px solid ${t.line}` }}>
            <SlidersHorizontal size={16} color={t.text} />
            {activeFilters > 0 && <span className="absolute -top-1 -right-1 rounded-full text-[9px] flex items-center justify-center" style={{ width: 15, height: 15, background: t.red, color: "#fff" }}>{activeFilters}</span>}
          </button>
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto">
          {[{ id: "newest", l: "Newest" }, { id: "oldest", l: "Oldest" }, { id: "highest", l: "Highest" }, { id: "lowest", l: "Lowest" }].map((s) => (
            <button key={s.id} onClick={() => setSort(s.id)} className="px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap"
              style={{ background: sort === s.id ? t.ink : t.bgAlt, color: sort === s.id ? t.bg : t.textSoft }}>
              {s.l}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={<Receipt size={34} strokeWidth={1.3} />} title="No transactions yet" subtitle="Add your first transaction to see it here." actionLabel="Add transaction" onAction={onAdd} />
      ) : (
        <div className="px-4 mt-4 flex flex-col gap-4">
          {groups.map(([date, rows]) => (
            <div key={date}>
              <div className="text-[12px] font-medium mb-1.5 px-1" style={{ color: t.textSoft }}>{fmtDate(date, { weekday: "short", month: "short", day: "numeric" })}</div>
              <Card>
                {rows.map((r, i) => {
                  const cat = state.categories.find((c) => c.id === r.categoryId);
                  const isTransfer = r.type === "transfer";
                  return (
                    <Row key={r.id} noBorder={i === rows.length - 1} onClick={() => onEdit(r)}
                      left={
                        <div className="flex items-center gap-3 min-w-0">
                          <IconBadge bg={isTransfer ? t.blueSoft : r.type === "income" ? t.greenSoft : t.bgAlt}>
                            {isTransfer ? <ArrowLeftRight size={15} color={t.blue} /> : <CategoryIcon category={cat} color={r.type === "income" ? t.green : t.text} />}
                          </IconBadge>
                          <div className="min-w-0">
                            <div className="text-[14px] font-medium truncate">{isTransfer ? `${accName(r.accountId)} → ${accName(r.toAccountId)}` : (cat?.name || "Uncategorized")}</div>
                            <div className="text-[12px] truncate" style={{ color: t.textSoft }}>{isTransfer ? "Transfer" : accName(r.accountId)}{r.notes ? " · " + r.notes : ""}</div>
                          </div>
                        </div>
                      }
                      right={<Amount value={r.amount} size="sm" tone={isTransfer ? undefined : r.type === "income" ? "pos" : "neg"} prefix={isTransfer ? "" : r.type === "income" ? "+" : "-"} />}
                    />
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
      )}

      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter transactions"
        footer={<div className="flex gap-2">
          <GhostButton full onClick={() => { setFType("all"); setFAccount("all"); setFCategory("all"); }}>Reset</GhostButton>
          <PrimaryButton full onClick={() => setFilterOpen(false)}>Apply</PrimaryButton>
        </div>}>
        <FieldLabel>Type</FieldLabel>
        <SelectPills value={fType} onChange={setFType} options={[{ id: "all", label: "All" }, { id: "expense", label: "Expense" }, { id: "income", label: "Income" }, { id: "transfer", label: "Transfer" }]} />
        <div className="mt-5"><FieldLabel>Account</FieldLabel>
          <SelectPills value={fAccount} onChange={setFAccount} options={[{ id: "all", label: "All" }, ...state.accounts]} getLabel={(a) => a.name || a.label} />
        </div>
        <div className="mt-5"><FieldLabel>Category</FieldLabel>
          <SelectPills value={fCategory} onChange={setFCategory} options={[{ id: "all", label: "All" }, ...state.categories]} getLabel={(a) => a.name || a.label} />
        </div>
      </Sheet>
    </Screen>
  );
}
