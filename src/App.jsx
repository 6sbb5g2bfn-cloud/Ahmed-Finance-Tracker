import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import { LIGHT, DARK, FONT_UI } from "./lib/constants";
import { debtRemaining, goalRequiredMonthly } from "./lib/calculations";
import { todayISO } from "./lib/utils";
import * as db from "./lib/db";
import { ThemeCtx } from "./context/ThemeContext";
import { Sheet, Toast } from "./components/ui";
import BottomNav from "./components/BottomNav";
import MoreSheet from "./components/MoreSheet";
import Auth from "./screens/Auth";
import Dashboard from "./screens/Dashboard";
import TransactionsScreen, { TransactionForm } from "./screens/Transactions";
import AccountsScreen, { AccountForm } from "./screens/Accounts";
import AssetsScreen, { AssetForm } from "./screens/Assets";
import BudgetsScreen, { BudgetForm } from "./screens/Budgets";
import RecurringScreen, { RecurringForm } from "./screens/Recurring";
import InstallmentsDebtsScreen, { InstallmentForm, DebtForm, RecordPaymentForm } from "./screens/InstallmentsDebts";
import SavingsGoalsScreen, { SavingsGoalForm } from "./screens/SavingsGoals";
import ReportsScreen from "./screens/Reports";
import SettingsScreen from "./screens/Settings";

/* =========================================================================
   ROOT — decides Auth vs the signed-in app based on the Supabase session.
   ========================================================================= */
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking, null = signed out

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "100vh", background: LIGHT.bg, fontFamily: FONT_UI }}>
        <Loader2 size={22} className="animate-spin" color={LIGHT.textSoft} />
      </div>
    );
  }

  if (!session) return <Auth />;

  // key forces a full remount (fresh data load) if the signed-in user changes
  return <FinanceApp key={session.user.id} userId={session.user.id} userEmail={session.user.email} />;
}

/* =========================================================================
   FINANCE APP — everything below is the same shape/behavior as the
   original artifact; only the persistence layer changed from
   window.storage to real per-user Supabase tables.
   ========================================================================= */
function FinanceApp({ userId, userEmail }) {
  const [appState, setAppState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [moreOpen, setMoreOpen] = useState(false);

  const [txSheet, setTxSheet] = useState(null);
  const [accSheet, setAccSheet] = useState(null);
  const [assetSheet, setAssetSheet] = useState(null);
  const [budgetSheet, setBudgetSheet] = useState(null);
  const [recSheet, setRecSheet] = useState(null);
  const [instSheet, setInstSheet] = useState(null);
  const [debtSheet, setDebtSheet] = useState(null);
  const [goalSheet, setGoalSheet] = useState(null);

  const [payRecurringTarget, setPayRecurringTarget] = useState(null); // {item, occurrenceDate}
  const [payInstTarget, setPayInstTarget] = useState(null);
  const [payDebtTarget, setPayDebtTarget] = useState(null);
  const [contributeTarget, setContributeTarget] = useState(null);

  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);
  const toast = useCallback((msg) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 1800);
  }, []);
  const errorToast = useCallback((e) => toast(e?.message || "Something went wrong — please try again"), [toast]);

  useEffect(() => {
    (async () => {
      try {
        const data = await db.fetchAllData(userId);
        setAppState(data);
      } catch (e) {
        setLoadError(e.message || "Failed to load your data");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const darkMode = appState?.meta?.theme === "dark";
  const theme = darkMode ? DARK : LIGHT;

  const replaceIn = (key, row) => setAppState((prev) => {
    const list = prev[key];
    const idx = list.findIndex((x) => x.id === row.id);
    const next = idx >= 0 ? list.map((x, i) => (i === idx ? row : x)) : [...list, row];
    return { ...prev, [key]: next };
  });
  const removeFrom = (key, id) => setAppState((prev) => ({ ...prev, [key]: prev[key].filter((x) => x.id !== id) }));

  /* ---- transactions ---- */
  const openAddTx = () => setTxSheet({ mode: "add", data: null });
  const openEditTx = (tx) => setTxSheet({ mode: "edit", data: tx });

  const handleSaveTransaction = async (tx) => {
    const isEdit = appState.transactions.some((t) => t.id === tx.id);
    try {
      const saved = isEdit ? await db.updateTransaction(userId, tx) : await db.createTransaction(userId, tx);
      replaceIn("transactions", saved);
      setTxSheet(null);
      toast(isEdit ? "Transaction updated" : "Transaction added");
    } catch (e) { errorToast(e); }
  };
  const handleDeleteTransaction = async (id) => {
    try {
      await db.deleteTransaction(userId, id);
      removeFrom("transactions", id);
      setTxSheet(null);
      toast("Transaction deleted");
    } catch (e) { errorToast(e); }
  };
  const handleRepeat = async (sample) => {
    try {
      const saved = await db.createTransaction(userId, {
        type: sample.type, amount: sample.amount, categoryId: sample.categoryId, accountId: sample.accountId,
        toAccountId: null, date: todayISO(), notes: sample.notes || "",
      });
      replaceIn("transactions", saved);
      toast("Added");
    } catch (e) { errorToast(e); }
  };

  /* ---- accounts ---- */
  const handleSaveAccount = async (acc) => {
    const isEdit = appState.accounts.some((a) => a.id === acc.id);
    try {
      const saved = isEdit ? await db.updateAccount(userId, acc) : await db.createAccount(userId, acc);
      replaceIn("accounts", saved);
      setAccSheet(null);
      toast(isEdit ? "Account updated" : "Account added");
    } catch (e) { errorToast(e); }
  };
  const handleArchiveAccount = async (id) => {
    if (!window.confirm("Archive this account? Its balance will stop counting toward your total, but its history is kept.")) return;
    try {
      const acc = appState.accounts.find((a) => a.id === id);
      const saved = await db.updateAccount(userId, { ...acc, status: "archived" });
      replaceIn("accounts", saved);
      setAccSheet(null);
      toast("Account archived");
    } catch (e) { errorToast(e); }
  };

  /* ---- assets ---- */
  const handleSaveAsset = async (a) => {
    const isEdit = appState.assets.some((x) => x.id === a.id);
    try {
      const saved = isEdit ? await db.updateAsset(userId, a) : await db.createAsset(userId, a);
      replaceIn("assets", saved);
      setAssetSheet(null);
      toast(isEdit ? "Asset updated" : "Asset added");
    } catch (e) { errorToast(e); }
  };
  const handleDeleteAsset = async (id) => {
    if (!window.confirm("Delete this asset?")) return;
    try {
      await db.deleteAsset(userId, id);
      removeFrom("assets", id);
      setAssetSheet(null);
      toast("Asset deleted");
    } catch (e) { errorToast(e); }
  };

  /* ---- budgets ---- */
  const handleSaveBudget = async (b) => {
    const isEdit = appState.budgets.some((x) => x.id === b.id);
    try {
      const saved = isEdit ? await db.updateBudget(userId, b) : await db.createBudget(userId, b);
      replaceIn("budgets", saved);
      setBudgetSheet(null);
      toast(isEdit ? "Budget updated" : "Budget added");
    } catch (e) { errorToast(e); }
  };
  const handleDeleteBudget = async (id) => {
    if (!window.confirm("Delete this budget?")) return;
    try {
      await db.deleteBudget(userId, id);
      removeFrom("budgets", id);
      setBudgetSheet(null);
      toast("Budget deleted");
    } catch (e) { errorToast(e); }
  };

  /* ---- recurring payments ---- */
  const handleSaveRecurring = async (r) => {
    const isEdit = appState.recurringPayments.some((x) => x.id === r.id);
    try {
      const saved = isEdit ? await db.updateRecurring(userId, r) : await db.createRecurring(userId, r);
      replaceIn("recurringPayments", saved);
      setRecSheet(null);
      toast(isEdit ? "Recurring payment updated" : "Recurring payment added");
    } catch (e) { errorToast(e); }
  };
  const handleDeleteRecurring = async (id) => {
    if (!window.confirm("Delete this recurring payment?")) return;
    try {
      await db.deleteRecurring(userId, id);
      removeFrom("recurringPayments", id);
      setRecSheet(null);
      toast("Recurring payment deleted");
    } catch (e) { errorToast(e); }
  };
  const handleMarkRecurringPaid = async (amount, date, accountId) => {
    const { item, occurrenceDate } = payRecurringTarget;
    try {
      const { recurring, transaction } = await db.markRecurringPaid(userId, item, occurrenceDate, amount, date, accountId);
      replaceIn("recurringPayments", recurring);
      replaceIn("transactions", transaction);
      setPayRecurringTarget(null);
      toast("Marked as paid");
    } catch (e) { errorToast(e); }
  };

  /* ---- installments ---- */
  const handleSaveInstallment = async (i) => {
    const isEdit = appState.installments.some((x) => x.id === i.id);
    try {
      const saved = isEdit ? await db.updateInstallment(userId, i) : await db.createInstallment(userId, i);
      replaceIn("installments", saved);
      setInstSheet(null);
      toast(isEdit ? "Installment updated" : "Installment added");
    } catch (e) { errorToast(e); }
  };
  const handleDeleteInstallment = async (id) => {
    if (!window.confirm("Delete this installment? Its payment history will be lost.")) return;
    try {
      await db.deleteInstallment(userId, id);
      removeFrom("installments", id);
      setInstSheet(null);
      toast("Installment deleted");
    } catch (e) { errorToast(e); }
  };
  const handlePayInstallment = async (amount, date, accountId) => {
    try {
      const { installment, transaction } = await db.payInstallment(userId, payInstTarget, amount, date, accountId);
      replaceIn("installments", installment);
      replaceIn("transactions", transaction);
      setPayInstTarget(null);
      toast("Payment recorded");
    } catch (e) { errorToast(e); }
  };

  /* ---- debts ---- */
  const handleSaveDebt = async (d) => {
    const isEdit = appState.debts.some((x) => x.id === d.id);
    try {
      const saved = isEdit ? await db.updateDebt(userId, d) : await db.createDebt(userId, d);
      replaceIn("debts", saved);
      setDebtSheet(null);
      toast(isEdit ? "Debt updated" : "Debt added");
    } catch (e) { errorToast(e); }
  };
  const handleDeleteDebt = async (id) => {
    if (!window.confirm("Delete this debt record?")) return;
    try {
      await db.deleteDebt(userId, id);
      removeFrom("debts", id);
      setDebtSheet(null);
      toast("Debt deleted");
    } catch (e) { errorToast(e); }
  };
  const handlePayDebt = async (amount, date, accountId) => {
    const debt = payDebtTarget;
    const isOwe = debt.direction === "owe";
    const fallbackCat = appState.categories.find((c) => c.name === (isOwe ? "Debt Payment" : "Other Income"));
    try {
      const { debt: saved, transaction } = await db.payDebt(userId, debt, amount, date, accountId, fallbackCat?.id || null);
      replaceIn("debts", saved);
      replaceIn("transactions", transaction);
      setPayDebtTarget(null);
      toast(isOwe ? "Payment recorded" : "Receipt recorded");
    } catch (e) { errorToast(e); }
  };

  /* ---- savings goals ---- */
  const handleSaveGoal = async (g) => {
    const isEdit = appState.savingsGoals.some((x) => x.id === g.id);
    try {
      const saved = isEdit ? await db.updateGoal(userId, g) : await db.createGoal(userId, g);
      replaceIn("savingsGoals", saved);
      setGoalSheet(null);
      toast(isEdit ? "Goal updated" : "Goal added");
    } catch (e) { errorToast(e); }
  };
  const handleDeleteGoal = async (id) => {
    if (!window.confirm("Delete this savings goal?")) return;
    try {
      await db.deleteGoal(userId, id);
      removeFrom("savingsGoals", id);
      setGoalSheet(null);
      toast("Goal deleted");
    } catch (e) { errorToast(e); }
  };
  const handleContribute = async (amount, date, sourceAccountId) => {
    try {
      const { goal, transaction } = await db.contributeToGoal(userId, contributeTarget, amount, date, sourceAccountId);
      replaceIn("savingsGoals", goal);
      if (transaction) replaceIn("transactions", transaction);
      setContributeTarget(null);
      toast("Contribution added");
    } catch (e) { errorToast(e); }
  };

  /* ---- categories ---- */
  const handleAddCategory = async (name, type) => {
    try {
      const saved = await db.createCategory(userId, name, type);
      replaceIn("categories", saved);
      toast("Category added");
    } catch (e) { errorToast(e); }
  };
  const handleRenameCategory = async (id, name) => {
    try {
      const saved = await db.renameCategory(userId, id, name);
      replaceIn("categories", saved);
      toast("Category renamed");
    } catch (e) { errorToast(e); }
  };
  const handleDeleteCategory = async (id) => {
    const inUse = appState.transactions.some((t) => t.categoryId === id) || appState.recurringPayments.some((r) => r.categoryId === id) ||
      appState.budgets.some((b) => b.categoryId === id) || appState.installments.some((i) => i.categoryId === id);
    if (inUse) { toast("Category is in use"); return; }
    if (!window.confirm("Delete this category?")) return;
    try {
      await db.deleteCategory(userId, id);
      removeFrom("categories", id);
      toast("Category deleted");
    } catch (e) { errorToast(e); }
  };

  /* ---- settings ---- */
  const handleSetCurrency = async (c) => {
    try {
      await db.setCurrency(userId, c);
      setAppState((prev) => ({ ...prev, meta: { ...prev.meta, currency: c } }));
      toast(`Currency set to ${c}`);
    } catch (e) { errorToast(e); }
  };
  const handleSetDarkMode = async (v) => {
    const theme = v ? "dark" : "light";
    setAppState((prev) => ({ ...prev, meta: { ...prev.meta, theme } })); // instant, no need to wait on this one
    try { await db.setTheme(userId, theme); } catch (e) { errorToast(e); }
  };

   const handleSetRemindersEnabled = async (v) => {
  setAppState((prev) => ({ ...prev, meta: { ...prev.meta, remindersEnabled: v } }));
  try { await db.setRemindersEnabled(userId, v); toast(v ? "Email reminders on" : "Email reminders off"); } catch (e) { errorToast(e); }
};


  const handleExport = () => {
    const blob = new Blob([JSON.stringify(appState, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `finance-data-${todayISO()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("Data exported");
  };
  const handleImport = (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.categories)) throw new Error("That file doesn't look like a finance export");
        if (!window.confirm("Import this file? It will replace your current data.")) return;
        setLoading(true);
        const data = await db.replaceAllData(userId, parsed);
        setAppState(data);
        setLoading(false);
        toast("Data imported");
      } catch (e) {
        setLoading(false);
        toast(e.message || "Could not read that file");
      }
    };
    reader.readAsText(file);
  };
  const handleResetDemo = async () => {
    try {
      setLoading(true);
      const data = await db.seedDemoData(userId);
      setAppState(data);
      setLoading(false);
      toast("Sample data loaded");
    } catch (e) { setLoading(false); errorToast(e); }
  };
  const handleClearAll = async () => {
    try {
      setLoading(true);
      const data = await db.clearAllData(userId);
      setAppState(data);
      setLoading(false);
      toast("All data cleared");
    } catch (e) { setLoading(false); errorToast(e); }
  };
  const handleSignOut = () => supabase.auth.signOut();

  if (loading || !appState) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 text-center" style={{ minHeight: "100vh", background: LIGHT.bg, fontFamily: FONT_UI }}>
        {loadError ? (
          <div className="text-[13px]" style={{ color: LIGHT.red }}>{loadError}</div>
        ) : (
          <Loader2 size={22} className="animate-spin" color={LIGHT.textSoft} />
        )}
      </div>
    );
  }

  const cur = appState.meta.currency;

  return (
    <ThemeCtx.Provider value={theme}>
      <div className={darkMode ? "dark-scheme" : ""} style={{ minHeight: "100vh", background: theme.bg }}>
        <div className="relative mx-auto" style={{ maxWidth: 480, minHeight: "100vh", background: theme.bg }}>
          {activeTab === "dashboard" && <Dashboard state={appState} onNav={setActiveTab}
            onOpenOccurrence={(u) => { if (u.kind === "recurring") setPayRecurringTarget({ item: u.ref, occurrenceDate: u.date }); else if (u.kind === "installment") setPayInstTarget(u.ref); else if (u.kind === "debt") setPayDebtTarget(u.ref); }}
            onRepeat={handleRepeat} currency={cur} />}
          {activeTab === "transactions" && <TransactionsScreen state={appState} onEdit={openEditTx} onAdd={openAddTx} />}
          {activeTab === "accounts" && <AccountsScreen state={appState} onAdd={() => setAccSheet({ mode: "add", data: null })} onEdit={(a) => setAccSheet({ mode: "edit", data: a })} />}
          {activeTab === "assets" && <AssetsScreen state={appState} onAdd={() => setAssetSheet({ mode: "add", data: null })} onEdit={(a) => setAssetSheet({ mode: "edit", data: a })} />}
          {activeTab === "budgets" && <BudgetsScreen state={appState} onAdd={() => setBudgetSheet({ mode: "add", data: null })} onEdit={(b) => setBudgetSheet({ mode: "edit", data: b })} />}
          {activeTab === "recurring" && <RecurringScreen state={appState} onAdd={() => setRecSheet({ mode: "add", data: null })} onEdit={(r) => setRecSheet({ mode: "edit", data: r })} onMarkPaid={(item, date) => setPayRecurringTarget({ item, occurrenceDate: date })} />}
          {activeTab === "debts" && <InstallmentsDebtsScreen state={appState}
            onAddInstallment={() => setInstSheet({ mode: "add", data: null })} onEditInstallment={(i) => setInstSheet({ mode: "edit", data: i })} onPayInstallment={(i) => setPayInstTarget(i)}
            onAddDebt={() => setDebtSheet({ mode: "add", data: null })} onEditDebt={(d) => setDebtSheet({ mode: "edit", data: d })} onPayDebt={(d) => setPayDebtTarget(d)} />}
          {activeTab === "goals" && <SavingsGoalsScreen state={appState} onAdd={() => setGoalSheet({ mode: "add", data: null })} onEdit={(g) => setGoalSheet({ mode: "edit", data: g })} onContribute={(g) => setContributeTarget(g)} />}
          {activeTab === "reports" && <ReportsScreen state={appState} />}
          {activeTab === "settings" && <SettingsScreen state={appState} darkMode={darkMode} setDarkMode={handleSetDarkMode} onSetCurrency={handleSetCurrency}
            onAddCategory={handleAddCategory} onRenameCategory={handleRenameCategory} onDeleteCategory={handleDeleteCategory}
            onExport={handleExport} onImport={handleImport}
            onResetDemo={handleResetDemo} onClearAll={handleClearAll}
            onManageAccounts={() => setActiveTab("accounts")} userEmail={userEmail} onSignOut={handleSignOut}
remindersEnabled={!!appState.meta.remindersEnabled} setRemindersEnabled={handleSetRemindersEnabled} />}

          <BottomNav active={activeTab} onNav={setActiveTab} onAdd={openAddTx} onMore={() => setMoreOpen(true)} />
          <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} onNav={setActiveTab} />

          <Sheet open={!!txSheet} onClose={() => setTxSheet(null)} title={txSheet?.mode === "edit" ? "Edit transaction" : "Add transaction"}>
            {txSheet && <TransactionForm state={appState} initial={txSheet.data} onSave={handleSaveTransaction} onDelete={handleDeleteTransaction} onCancel={() => setTxSheet(null)} />}
          </Sheet>

          <Sheet open={!!accSheet} onClose={() => setAccSheet(null)} title={accSheet?.mode === "edit" ? "Edit account" : "Add account"}>
            {accSheet && <AccountForm initial={accSheet.data} onSave={handleSaveAccount} onCancel={() => setAccSheet(null)} onArchive={accSheet.mode === "edit" ? () => handleArchiveAccount(accSheet.data.id) : null} />}
          </Sheet>

          <Sheet open={!!assetSheet} onClose={() => setAssetSheet(null)} title={assetSheet?.mode === "edit" ? "Edit asset" : "Add asset"}>
            {assetSheet && <AssetForm state={appState} initial={assetSheet.data} onSave={handleSaveAsset} onCancel={() => setAssetSheet(null)}

              onDelete={assetSheet.mode === "edit" ? () => handleDeleteAsset(assetSheet.data.id) : null} />}
          </Sheet>

          <Sheet open={!!budgetSheet} onClose={() => setBudgetSheet(null)} title={budgetSheet?.mode === "edit" ? "Edit budget" : "Add budget"}>
            {budgetSheet && <BudgetForm state={appState} initial={budgetSheet.data} onSave={handleSaveBudget} onCancel={() => setBudgetSheet(null)}
              onDelete={budgetSheet.mode === "edit" ? () => handleDeleteBudget(budgetSheet.data.id) : null}
              usedCategoryIds={appState.budgets.filter((b) => b.id !== budgetSheet?.data?.id).map((b) => b.categoryId)} />}
          </Sheet>

          <Sheet open={!!recSheet} onClose={() => setRecSheet(null)} title={recSheet?.mode === "edit" ? "Edit recurring payment" : "Add recurring payment"}>
            {recSheet && <RecurringForm state={appState} initial={recSheet.data} onSave={handleSaveRecurring} onCancel={() => setRecSheet(null)}
              onDelete={recSheet.mode === "edit" ? () => handleDeleteRecurring(recSheet.data.id) : null} />}
          </Sheet>

          <Sheet open={!!instSheet} onClose={() => setInstSheet(null)} title={instSheet?.mode === "edit" ? "Edit installment" : "Add installment"}>
            {instSheet && <InstallmentForm state={appState} initial={instSheet.data} onSave={handleSaveInstallment} onCancel={() => setInstSheet(null)}
              onDelete={instSheet.mode === "edit" ? () => handleDeleteInstallment(instSheet.data.id) : null} />}
          </Sheet>

          <Sheet open={!!debtSheet} onClose={() => setDebtSheet(null)} title={debtSheet?.mode === "edit" ? "Edit debt" : "Add debt"}>
            {debtSheet && <DebtForm state={appState} initial={debtSheet.data} onSave={handleSaveDebt} onCancel={() => setDebtSheet(null)}
              onDelete={debtSheet.mode === "edit" ? () => handleDeleteDebt(debtSheet.data.id) : null} />}
          </Sheet>

          <Sheet open={!!goalSheet} onClose={() => setGoalSheet(null)} title={goalSheet?.mode === "edit" ? "Edit goal" : "Add savings goal"}>
            {goalSheet && <SavingsGoalForm state={appState} initial={goalSheet.data} onSave={handleSaveGoal} onCancel={() => setGoalSheet(null)}
              onDelete={goalSheet.mode === "edit" ? () => handleDeleteGoal(goalSheet.data.id) : null} />}
          </Sheet>

          <Sheet open={!!payRecurringTarget} onClose={() => setPayRecurringTarget(null)} title={payRecurringTarget ? `Mark "${payRecurringTarget.item.name}" as paid` : ""}>
            {payRecurringTarget && <RecordPaymentForm state={appState} defaultAmount={payRecurringTarget.item.amount} defaultAccountId={payRecurringTarget.item.accountId}
              defaultDate={payRecurringTarget.occurrenceDate} label="Amount paid" onSave={handleMarkRecurringPaid} />}
          </Sheet>

          <Sheet open={!!payInstTarget} onClose={() => setPayInstTarget(null)} title={payInstTarget ? `Record payment — ${payInstTarget.name}` : ""}>
            {payInstTarget && <RecordPaymentForm state={appState} defaultAmount={payInstTarget.monthlyPayment} defaultAccountId={payInstTarget.accountId} label="Payment amount" onSave={handlePayInstallment} />}
          </Sheet>

          <Sheet open={!!payDebtTarget} onClose={() => setPayDebtTarget(null)} title={payDebtTarget ? `${payDebtTarget.direction === "owe" ? "Pay" : "Collect from"} ${payDebtTarget.person}` : ""}>
            {payDebtTarget && <RecordPaymentForm state={appState} defaultAmount={debtRemaining(payDebtTarget)} label="Amount" onSave={handlePayDebt} />}
          </Sheet>

          <Sheet open={!!contributeTarget} onClose={() => setContributeTarget(null)} title={contributeTarget ? `Contribute to ${contributeTarget.name}` : ""}>
            {contributeTarget && <RecordPaymentForm state={appState} defaultAmount={Math.round(goalRequiredMonthly(contributeTarget))} accountLabel="From account" label="Contribution amount" onSave={handleContribute} />}
          </Sheet>

          <Toast message={toastMsg} />
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
