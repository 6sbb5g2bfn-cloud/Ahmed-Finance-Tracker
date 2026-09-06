import { useState, useRef, useMemo } from "react";
import { ChevronRight, Wallet, Tag, FileDown, FileUp, RotateCcw, Trash2, Check, Pencil, Plus, LogOut, Mail } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { FONT_DISPLAY, CURRENCIES } from "../lib/constants";
import { Screen, SectionTitle, Card, Row, Sheet, ConfirmDialog, SelectPills, TextInput, IconBadge, CategoryIcon } from "../components/ui";

function CategoryRow({ cat, count, onRename, onDelete }) {
  const t = useTheme();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.name);
  if (editing) {
    return (
      <Row noBorder={false} left={
        <div className="flex items-center gap-2 flex-1">
          <IconBadge bg={t.bgAlt} size={28}><CategoryIcon category={cat} size={14} /></IconBadge>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[14px] border-b" style={{ color: t.text, borderColor: t.line }} />
        </div>
      } right={
        <button onClick={() => { if (name.trim()) onRename(name.trim()); setEditing(false); }} className="p-1.5 rounded-full" style={{ background: t.greenSoft }}>
          <Check size={14} color={t.green} />
        </button>
      } />
    );
  }
  return (
    <Row left={
      <div className="flex items-center gap-2.5">
        <IconBadge bg={t.bgAlt} size={28}><CategoryIcon category={cat} size={14} /></IconBadge>
        <span className="text-[14px]">{cat.name}</span>
      </div>
    } right={
      <div className="flex items-center gap-1">
        <button onClick={() => setEditing(true)} className="p-1.5 rounded-full active:opacity-60"><Pencil size={14} color={t.textSoft} /></button>
        <button onClick={onDelete} disabled={count > 0} className="p-1.5 rounded-full active:opacity-60" style={{ opacity: count > 0 ? 0.3 : 1 }}><Trash2 size={14} color={t.red} /></button>
      </div>
    } />
  );
}

export function CategoriesManager({ state, onAddCategory, onRenameCategory, onDeleteCategory }) {
  const t = useTheme();
  const [type, setType] = useState("expense");
  const [newName, setNewName] = useState("");
  const usage = useMemo(() => {
    const m = {};
    for (const tx of state.transactions) if (tx.categoryId) m[tx.categoryId] = (m[tx.categoryId] || 0) + 1;
    for (const r of state.recurringPayments) if (r.categoryId) m[r.categoryId] = (m[r.categoryId] || 0) + 1;
    for (const b of state.budgets) if (b.categoryId) m[b.categoryId] = (m[b.categoryId] || 0) + 1;
    return m;
  }, [state]);
  const cats = state.categories.filter((c) => c.type === type);

  return (
    <div>
      <SelectPills value={type} onChange={setType} options={[{ id: "expense", label: "Expense" }, { id: "income", label: "Income" }]} />
      <Card className="mt-4">
        {cats.map((c) => (
          <CategoryRow key={c.id} cat={c} count={usage[c.id] || 0}
            onRename={(name) => onRenameCategory(c.id, name)}
            onDelete={() => onDeleteCategory(c.id)} />
        ))}
      </Card>
      <div className="mt-3 flex gap-2">
        <TextInput value={newName} onChange={setNewName} placeholder={`New ${type} category`} />
        <button onClick={() => { if (newName.trim()) { onAddCategory(newName.trim(), type); setNewName(""); } }}
          className="px-4 rounded-xl active:opacity-70" style={{ background: t.ink }}>
          <Plus size={18} color={t.bg} />
        </button>
      </div>
      <div className="text-[11px] mt-2" style={{ color: t.textFaint }}>Categories in use can't be deleted — rename them instead, or stop using them first.</div>
    </div>
  );
}

export default function SettingsScreen({
  state, darkMode, setDarkMode, onSetCurrency, onAddCategory, onRenameCategory, onDeleteCategory,
  onExport, onImport, onResetDemo, onClearAll, onManageAccounts, userEmail, onSignOut,
remindersEnabled, setRemindersEnabled,
}) {

  const t = useTheme();
  const [catOpen, setCatOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDemo, setConfirmDemo] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const fileRef = useRef(null);

  return (
    <Screen>
      <div className="px-4 pt-6"><div className="text-[20px] font-medium" style={{ fontFamily: FONT_DISPLAY }}>Settings</div></div>

      <SectionTitle>Preferences</SectionTitle>
      <div className="px-4"><Card>
        <Row left={<span className="text-[14px]">Currency</span>} onClick={() => setCurrencyOpen(true)}
          right={<div className="flex items-center gap-1" style={{ color: t.textSoft }}><span className="text-[13px]">{state.meta.currency}</span><ChevronRight size={15} /></div>} />
        <Row noBorder left={<span className="text-[14px]">Dark mode</span>}
          right={
                    <button onClick={() => setDarkMode(!darkMode)} className="w-11 h-6 rounded-full relative shrink-0" style={{ background: darkMode ? t.green : t.line }}>
          <span className="absolute top-0.5 rounded-full bg-white transition-all" style={{ width: 20, height: 20, left: darkMode ? 22 : 2 }} />
        </button>
      } />
  </Card></div>

  <SectionTitle>Notifications</SectionTitle>
  <div className="px-4"><Card>
    <Row noBorder left={<div className="flex items-center gap-2.5"><Mail size={16} color={t.textSoft} /><span className="text-[14px]">Email reminders</span></div>}
      right={
        <button onClick={() => setRemindersEnabled(!remindersEnabled)} className="w-11 h-6 rounded-full relative shrink-0" style={{ background: remindersEnabled ? t.green : t.line }}>
          <span className="absolute top-0.5 rounded-full bg-white transition-all" style={{ width: 20, height: 20, left: remindersEnabled ? 22 : 2 }} />
        </button>
      } />
  </Card></div>
  <div className="px-4 mt-2 text-[11px]" style={{ color: t.textFaint }}>
    A daily email before anything's due — 1 day ahead for monthly bills and installments, 3 days for quarterly and debts, a week for yearly.
  </div>

  <SectionTitle>Manage</SectionTitle>

      <div className="px-4"><Card>
        <Row onClick={onManageAccounts} left={<div className="flex items-center gap-2.5"><Wallet size={16} color={t.textSoft} /><span className="text-[14px]">Accounts</span></div>} right={<ChevronRight size={15} color={t.textSoft} />} />
        <Row noBorder onClick={() => setCatOpen(true)} left={<div className="flex items-center gap-2.5"><Tag size={16} color={t.textSoft} /><span className="text-[14px]">Categories</span></div>} right={<ChevronRight size={15} color={t.textSoft} />} />
      </Card></div>

      <SectionTitle>Data</SectionTitle>
      <div className="px-4"><Card>
        <Row onClick={onExport} left={<div className="flex items-center gap-2.5"><FileDown size={16} color={t.textSoft} /><span className="text-[14px]">Export data (JSON)</span></div>} right={<ChevronRight size={15} color={t.textSoft} />} />
        <Row onClick={() => fileRef.current?.click()} left={<div className="flex items-center gap-2.5"><FileUp size={16} color={t.textSoft} /><span className="text-[14px]">Import data</span></div>} right={<ChevronRight size={15} color={t.textSoft} />} />
        <Row onClick={() => setConfirmDemo(true)} left={<div className="flex items-center gap-2.5"><RotateCcw size={16} color={t.textSoft} /><span className="text-[14px]">Load sample data</span></div>} right={<ChevronRight size={15} color={t.textSoft} />} />
        <Row noBorder onClick={() => setConfirmClear(true)} left={<div className="flex items-center gap-2.5"><Trash2 size={16} color={t.red} /><span className="text-[14px]" style={{ color: t.red }}>Clear all data</span></div>} />
      </Card></div>
      <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />

      <SectionTitle>Account</SectionTitle>
      <div className="px-4"><Card>
        <Row noBorder left={<span className="text-[14px]" style={{ color: t.textSoft }}>{userEmail}</span>}
          right={<button onClick={() => setConfirmSignOut(true)} className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: t.red }}><LogOut size={14} /> Sign out</button>} />
      </Card></div>
      <div className="px-4 mt-3 text-[11px]" style={{ color: t.textFaint }}>
        Everything here is private to your account, protected by row-level security in the database — nothing is shared with other users.
      </div>

      <Sheet open={currencyOpen} onClose={() => setCurrencyOpen(false)} title="Currency">
        <div className="flex flex-col gap-1">
          {CURRENCIES.map((c) => (
            <Row key={c} onClick={() => { onSetCurrency(c); setCurrencyOpen(false); }}
              left={<span className="text-[14px]">{c}</span>} right={state.meta.currency === c ? <Check size={16} color={t.green} /> : null} />
          ))}
        </div>
      </Sheet>

      <Sheet open={catOpen} onClose={() => setCatOpen(false)} title="Categories">
        <CategoriesManager state={state} onAddCategory={onAddCategory} onRenameCategory={onRenameCategory} onDeleteCategory={onDeleteCategory} />
      </Sheet>

      <ConfirmDialog open={confirmClear} title="Clear all data?" message="This permanently removes every account, transaction, budget, and goal. This can't be undone."
        onCancel={() => setConfirmClear(false)} onConfirm={() => { setConfirmClear(false); onClearAll(); }} confirmLabel="Clear everything" />
      <ConfirmDialog open={confirmDemo} title="Load sample data?" message="This replaces your current data with realistic sample data so you can explore the app." danger={false} confirmLabel="Load sample data"
        onCancel={() => setConfirmDemo(false)} onConfirm={() => { setConfirmDemo(false); onResetDemo(); }} />
      <ConfirmDialog open={confirmSignOut} title="Sign out?" message="You'll need your email and password to sign back in." danger={false} confirmLabel="Sign out"
        onCancel={() => setConfirmSignOut(false)} onConfirm={() => { setConfirmSignOut(false); onSignOut(); }} />
    </Screen>
  );
}
