import { supabase } from "./supabaseClient";
import { DEFAULT_CATEGORIES } from "./constants";
import { uid, todayISO, addDaysISO, addMonthsISO } from "./utils";

/* =========================================================================
   Row <-> app-state mappers (Postgres snake_case <-> the camelCase shape
   every screen/form in this app already expects). Nested jsonb payloads
   (payments, contributions, postedDates) are stored camelCase as-is, so
   only the top-level table columns need translating.
   ========================================================================= */
const mapAccount = (r) => ({ id: r.id, name: r.name, type: r.type, initialBalance: Number(r.initial_balance), status: r.status, createdAt: r.created_at?.slice(0, 10) });
const mapCategory = (r) => ({ id: r.id, name: r.name, type: r.type, icon: r.icon, core: r.core });
const mapTransaction = (r) => ({ id: r.id, type: r.type, amount: Number(r.amount), categoryId: r.category_id, accountId: r.account_id, toAccountId: r.to_account_id, date: r.date, notes: r.notes || "", createdAt: r.created_at });
const mapRecurring = (r) => ({ id: r.id, name: r.name, commitmentType: r.commitment_type, amount: Number(r.amount), frequency: r.frequency, startDate: r.start_date, endDate: r.end_date, categoryId: r.category_id, accountId: r.account_id, active: r.active, postedDates: r.posted_dates || [] });
const mapInstallment = (r) => ({ id: r.id, name: r.name, totalAmount: Number(r.total_amount), monthlyPayment: Number(r.monthly_payment), numberOfPayments: r.number_of_payments, startDate: r.start_date, categoryId: r.category_id, accountId: r.account_id, payments: (r.payments || []).map((p) => ({ ...p, amount: Number(p.amount) })) });
const mapDebt = (r) => ({ id: r.id, direction: r.direction, person: r.person, amount: Number(r.amount), date: r.date, dueDate: r.due_date, notes: r.notes || "", status: r.status, payments: (r.payments || []).map((p) => ({ ...p, amount: Number(p.amount) })) });
const mapBudget = (r) => ({ id: r.id, categoryId: r.category_id, amount: Number(r.amount) });
const mapGoal = (r) => ({ id: r.id, name: r.name, target: Number(r.target), targetDate: r.target_date, accountId: r.account_id, contributions: (r.contributions || []).map((c) => ({ ...c, amount: Number(c.amount) })) });
const mapAsset = (r) => ({ id: r.id, name: r.name, type: r.type, currentValue: Number(r.current_value), costBasis: Number(r.cost_basis), purchaseDate: r.purchase_date, notes: r.notes || "", createdAt: r.created_at?.slice(0, 10) });

function must(res, action) {
  if (res.error) throw new Error(`${action} failed: ${res.error.message}`);
  return res.data;
}

/* =========================================================================
   LOAD — fetch everything for the signed-in user in parallel, seeding
   default categories + a settings row the very first time.
   ========================================================================= */
export async function ensureUserSettings(userId) {
  const existing = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle();
  if (existing.error) throw new Error("Loading settings failed: " + existing.error.message);
  if (existing.data) return existing.data;
  const inserted = await supabase.from("user_settings").insert({ user_id: userId, currency: "SAR", theme: "light" }).select().single();
  return must(inserted, "Creating settings");
}

async function ensureDefaultCategories(userId) {
  const existing = await supabase.from("categories").select("id").eq("user_id", userId).limit(1);
  if (existing.error) throw new Error("Checking categories failed: " + existing.error.message);
  if (existing.data && existing.data.length > 0) return;
  const rows = DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: userId }));
  const res = await supabase.from("categories").insert(rows);
  if (res.error) throw new Error("Seeding categories failed: " + res.error.message);
}

export async function fetchAllData(userId) {
  await ensureDefaultCategories(userId);
  const settings = await ensureUserSettings(userId);

  const [accounts, categories, transactions, recurring, installments, debts, budgets, goals, assets] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at"),
    supabase.from("categories").select("*").order("created_at"),
    supabase.from("transactions").select("*").order("date", { ascending: false }),
    supabase.from("recurring_payments").select("*").order("created_at"),
    supabase.from("installments").select("*").order("created_at"),
    supabase.from("debts").select("*").order("created_at"),
    supabase.from("budgets").select("*").order("created_at"),
    supabase.from("savings_goals").select("*").order("created_at"),
    supabase.from("assets").select("*").order("created_at"),
  ]);

  return {
    meta: { currency: settings.currency, theme: settings.theme },
    accounts: must(accounts, "Loading accounts").map(mapAccount),
    categories: must(categories, "Loading categories").map(mapCategory),
    transactions: must(transactions, "Loading transactions").map(mapTransaction),
    recurringPayments: must(recurring, "Loading recurring payments").map(mapRecurring),
    installments: must(installments, "Loading installments").map(mapInstallment),
    debts: must(debts, "Loading debts").map(mapDebt),
    budgets: must(budgets, "Loading budgets").map(mapBudget),
    savingsGoals: must(goals, "Loading savings goals").map(mapGoal),
    assets: must(assets, "Loading assets").map(mapAsset),
  };
}

/* =========================================================================
   ACCOUNTS — never hard-deleted, only archived, to preserve ledger history.
   ========================================================================= */
export async function createAccount(userId, acc) {
  const res = await supabase.from("accounts").insert({
    user_id: userId, name: acc.name, type: acc.type, initial_balance: acc.initialBalance, status: acc.status || "active",
  }).select().single();
  return mapAccount(must(res, "Creating account"));
}
export async function updateAccount(userId, acc) {
  const res = await supabase.from("accounts").update({
    name: acc.name, type: acc.type, initial_balance: acc.initialBalance, status: acc.status,
  }).eq("id", acc.id).eq("user_id", userId).select().single();
  return mapAccount(must(res, "Updating account"));
}

/* =========================================================================
   CATEGORIES
   ========================================================================= */
export async function createCategory(userId, name, type) {
  const res = await supabase.from("categories").insert({ user_id: userId, name, type, icon: "MoreHorizontal", core: false }).select().single();
  return mapCategory(must(res, "Creating category"));
}
export async function renameCategory(userId, id, name) {
  const res = await supabase.from("categories").update({ name }).eq("id", id).eq("user_id", userId).select().single();
  return mapCategory(must(res, "Renaming category"));
}
export async function deleteCategory(userId, id) {
  const res = await supabase.from("categories").delete().eq("id", id).eq("user_id", userId);
  must(res, "Deleting category");
}

/* =========================================================================
   TRANSACTIONS
   ========================================================================= */
export async function createTransaction(userId, tx) {
  const res = await supabase.from("transactions").insert({
    user_id: userId, type: tx.type, amount: tx.amount, category_id: tx.categoryId, account_id: tx.accountId,
    to_account_id: tx.toAccountId, date: tx.date, notes: tx.notes || "",
  }).select().single();
  return mapTransaction(must(res, "Creating transaction"));
}
export async function updateTransaction(userId, tx) {
  const res = await supabase.from("transactions").update({
    type: tx.type, amount: tx.amount, category_id: tx.categoryId, account_id: tx.accountId,
    to_account_id: tx.toAccountId, date: tx.date, notes: tx.notes || "",
  }).eq("id", tx.id).eq("user_id", userId).select().single();
  return mapTransaction(must(res, "Updating transaction"));
}
export async function deleteTransaction(userId, id) {
  const res = await supabase.from("transactions").delete().eq("id", id).eq("user_id", userId);
  must(res, "Deleting transaction");
}

/* =========================================================================
   RECURRING PAYMENTS
   ========================================================================= */
export async function createRecurring(userId, r) {
  const res = await supabase.from("recurring_payments").insert({
    user_id: userId, name: r.name, commitment_type: r.commitmentType, amount: r.amount, frequency: r.frequency,
    start_date: r.startDate, end_date: r.endDate, category_id: r.categoryId, account_id: r.accountId,
    active: r.active, posted_dates: r.postedDates || [],
  }).select().single();
  return mapRecurring(must(res, "Creating recurring payment"));
}
export async function updateRecurring(userId, r) {
  const res = await supabase.from("recurring_payments").update({
    name: r.name, commitment_type: r.commitmentType, amount: r.amount, frequency: r.frequency,
    start_date: r.startDate, end_date: r.endDate, category_id: r.categoryId, account_id: r.accountId,
    active: r.active, posted_dates: r.postedDates || [],
  }).eq("id", r.id).eq("user_id", userId).select().single();
  return mapRecurring(must(res, "Updating recurring payment"));
}
export async function deleteRecurring(userId, id) {
  const res = await supabase.from("recurring_payments").delete().eq("id", id).eq("user_id", userId);
  must(res, "Deleting recurring payment");
}
// Marks one occurrence as posted AND records the real transaction it produced.
export async function markRecurringPaid(userId, recurring, occurrenceDate, amount, date, accountId) {
  const nextPosted = [...(recurring.postedDates || []), occurrenceDate];
  const [updated, tx] = await Promise.all([
    supabase.from("recurring_payments").update({ posted_dates: nextPosted }).eq("id", recurring.id).eq("user_id", userId).select().single(),
    supabase.from("transactions").insert({
      user_id: userId, type: "expense", amount, category_id: recurring.categoryId, account_id: accountId,
      to_account_id: null, date, notes: `${recurring.name} (recurring)`,
    }).select().single(),
  ]);
  return { recurring: mapRecurring(must(updated, "Marking recurring as paid")), transaction: mapTransaction(must(tx, "Recording payment transaction")) };
}

/* =========================================================================
   INSTALLMENTS
   ========================================================================= */
export async function createInstallment(userId, i) {
  const res = await supabase.from("installments").insert({
    user_id: userId, name: i.name, total_amount: i.totalAmount, monthly_payment: i.monthlyPayment,
    number_of_payments: i.numberOfPayments, start_date: i.startDate, category_id: i.categoryId, account_id: i.accountId,
    payments: i.payments || [],
  }).select().single();
  return mapInstallment(must(res, "Creating installment"));
}
export async function updateInstallment(userId, i) {
  const res = await supabase.from("installments").update({
    name: i.name, total_amount: i.totalAmount, monthly_payment: i.monthlyPayment,
    number_of_payments: i.numberOfPayments, start_date: i.startDate, category_id: i.categoryId, account_id: i.accountId,
    payments: i.payments || [],
  }).eq("id", i.id).eq("user_id", userId).select().single();
  return mapInstallment(must(res, "Updating installment"));
}
export async function deleteInstallment(userId, id) {
  const res = await supabase.from("installments").delete().eq("id", id).eq("user_id", userId);
  must(res, "Deleting installment");
}
export async function payInstallment(userId, installment, amount, date, accountId) {
  const nextPayments = [...installment.payments, { id: uid(), date, amount }];
  const [updated, tx] = await Promise.all([
    supabase.from("installments").update({ payments: nextPayments }).eq("id", installment.id).eq("user_id", userId).select().single(),
    supabase.from("transactions").insert({
      user_id: userId, type: "expense", amount, category_id: installment.categoryId, account_id: accountId,
      to_account_id: null, date, notes: `${installment.name} (installment payment)`,
    }).select().single(),
  ]);
  return { installment: mapInstallment(must(updated, "Recording installment payment")), transaction: mapTransaction(must(tx, "Recording payment transaction")) };
}

/* =========================================================================
   DEBTS
   ========================================================================= */
export async function createDebt(userId, d) {
  const res = await supabase.from("debts").insert({
    user_id: userId, direction: d.direction, person: d.person, amount: d.amount, date: d.date,
    due_date: d.dueDate, notes: d.notes || "", status: d.status || "open", payments: d.payments || [],
  }).select().single();
  return mapDebt(must(res, "Creating debt"));
}
export async function updateDebt(userId, d) {
  const res = await supabase.from("debts").update({
    direction: d.direction, person: d.person, amount: d.amount, date: d.date,
    due_date: d.dueDate, notes: d.notes || "", status: d.status || "open", payments: d.payments || [],
  }).eq("id", d.id).eq("user_id", userId).select().single();
  return mapDebt(must(res, "Updating debt"));
}
export async function deleteDebt(userId, id) {
  const res = await supabase.from("debts").delete().eq("id", id).eq("user_id", userId);
  must(res, "Deleting debt");
}
export async function payDebt(userId, debt, amount, date, accountId, fallbackCategoryId) {
  const isOwe = debt.direction === "owe";
  const nextPayments = [...debt.payments, { id: uid(), date, amount, accountId }];
  const [updated, tx] = await Promise.all([
    supabase.from("debts").update({ payments: nextPayments }).eq("id", debt.id).eq("user_id", userId).select().single(),
    supabase.from("transactions").insert({
      user_id: userId, type: isOwe ? "expense" : "income", amount, category_id: fallbackCategoryId || null,
      account_id: accountId, to_account_id: null, date, notes: `${isOwe ? "Payment to" : "Received from"} ${debt.person}`,
    }).select().single(),
  ]);
  return { debt: mapDebt(must(updated, "Recording debt payment")), transaction: mapTransaction(must(tx, "Recording payment transaction")) };
}

/* =========================================================================
   BUDGETS
   ========================================================================= */
export async function createBudget(userId, b) {
  const res = await supabase.from("budgets").insert({ user_id: userId, category_id: b.categoryId, amount: b.amount }).select().single();
  return mapBudget(must(res, "Creating budget"));
}
export async function updateBudget(userId, b) {
  const res = await supabase.from("budgets").update({ category_id: b.categoryId, amount: b.amount }).eq("id", b.id).eq("user_id", userId).select().single();
  return mapBudget(must(res, "Updating budget"));
}
export async function deleteBudget(userId, id) {
  const res = await supabase.from("budgets").delete().eq("id", id).eq("user_id", userId);
  must(res, "Deleting budget");
}

/* =========================================================================
   SAVINGS GOALS
   ========================================================================= */
export async function createGoal(userId, g) {
  const res = await supabase.from("savings_goals").insert({
    user_id: userId, name: g.name, target: g.target, target_date: g.targetDate, account_id: g.accountId, contributions: g.contributions || [],
  }).select().single();
  return mapGoal(must(res, "Creating savings goal"));
}
export async function updateGoal(userId, g) {
  const res = await supabase.from("savings_goals").update({
    name: g.name, target: g.target, target_date: g.targetDate, account_id: g.accountId, contributions: g.contributions || [],
  }).eq("id", g.id).eq("user_id", userId).select().single();
  return mapGoal(must(res, "Updating savings goal"));
}
export async function deleteGoal(userId, id) {
  const res = await supabase.from("savings_goals").delete().eq("id", id).eq("user_id", userId);
  must(res, "Deleting savings goal");
}
export async function contributeToGoal(userId, goal, amount, date, sourceAccountId) {
  const nextContributions = [...goal.contributions, { id: uid(), date, amount, accountId: sourceAccountId }];
  const ops = [
    supabase.from("savings_goals").update({ contributions: nextContributions }).eq("id", goal.id).eq("user_id", userId).select().single(),
  ];
  const needsTransfer = goal.accountId && sourceAccountId && sourceAccountId !== goal.accountId;
  if (needsTransfer) {
    ops.push(supabase.from("transactions").insert({
      user_id: userId, type: "transfer", amount, category_id: null, account_id: sourceAccountId,
      to_account_id: goal.accountId, date, notes: `Contribution to ${goal.name}`,
    }).select().single());
  }
  const results = await Promise.all(ops);
  const updated = mapGoal(must(results[0], "Recording contribution"));
  const transaction = results[1] ? mapTransaction(must(results[1], "Recording transfer transaction")) : null;
  return { goal: updated, transaction };
}

/* =========================================================================
   ASSETS
   ========================================================================= */
export async function createAsset(userId, a) {
  const res = await supabase.from("assets").insert({
    user_id: userId, name: a.name, type: a.type, current_value: a.currentValue, cost_basis: a.costBasis,
    purchase_date: a.purchaseDate, notes: a.notes || "",
  }).select().single();
  return mapAsset(must(res, "Creating asset"));
}
export async function updateAsset(userId, a) {
  const res = await supabase.from("assets").update({
    name: a.name, type: a.type, current_value: a.currentValue, cost_basis: a.costBasis,
    purchase_date: a.purchaseDate, notes: a.notes || "",
  }).eq("id", a.id).eq("user_id", userId).select().single();
  return mapAsset(must(res, "Updating asset"));
}
export async function deleteAsset(userId, id) {
  const res = await supabase.from("assets").delete().eq("id", id).eq("user_id", userId);
  must(res, "Deleting asset");
}

/* =========================================================================
   SETTINGS
   ========================================================================= */
export async function setCurrency(userId, currency) {
  const res = await supabase.from("user_settings").update({ currency, updated_at: new Date().toISOString() }).eq("user_id", userId);
  must(res, "Updating currency");
}
export async function setTheme(userId, theme) {
  const res = await supabase.from("user_settings").update({ theme, updated_at: new Date().toISOString() }).eq("user_id", userId);
  must(res, "Updating theme");
}

/* =========================================================================
   BULK OPERATIONS — clear all, load sample data, import a JSON export.
   ========================================================================= */
const DATA_TABLES = ["transactions", "recurring_payments", "installments", "debts", "budgets", "savings_goals", "assets", "accounts"];

async function wipeDataTables(userId) {
  for (const table of DATA_TABLES) {
    const res = await supabase.from(table).delete().eq("user_id", userId);
    if (res.error) throw new Error(`Clearing ${table} failed: ${res.error.message}`);
  }
}

export async function clearAllData(userId) {
  await wipeDataTables(userId);
  // Categories reset to just the defaults, same as the original "clear all" behavior.
  const resCat = await supabase.from("categories").delete().eq("user_id", userId);
  if (resCat.error) throw new Error("Clearing categories failed: " + resCat.error.message);
  await ensureDefaultCategories(userId);
  return fetchAllData(userId);
}

// Rebuilds the same realistic sample dataset as the original artifact,
// but as real inserted rows with server-assigned ids and foreign keys.
export async function seedDemoData(userId) {
  await wipeDataTables(userId);
  const resCat = await supabase.from("categories").delete().eq("user_id", userId);
  if (resCat.error) throw new Error("Resetting categories failed: " + resCat.error.message);
  await ensureDefaultCategories(userId);

  const catRes = await supabase.from("categories").select("id, name").eq("user_id", userId);
  if (catRes.error) throw new Error("Loading categories failed: " + catRes.error.message);
  const catByName = Object.fromEntries(catRes.data.map((c) => [c.name, c.id]));

  const today = todayISO();
  const accRows = [
    { user_id: userId, name: "Main Bank", type: "bank", initial_balance: 8000, status: "active" },
    { user_id: userId, name: "Cash Wallet", type: "cash", initial_balance: 600, status: "active" },
    { user_id: userId, name: "Credit Card", type: "credit", initial_balance: 0, status: "active" },
    { user_id: userId, name: "Savings Account", type: "savings", initial_balance: 12000, status: "active" },
  ];
  const accInserted = must(await supabase.from("accounts").insert(accRows).select(), "Seeding accounts");
  const acc = {
    bank: accInserted.find((a) => a.name === "Main Bank").id,
    cash: accInserted.find((a) => a.name === "Cash Wallet").id,
    credit: accInserted.find((a) => a.name === "Credit Card").id,
    savings: accInserted.find((a) => a.name === "Savings Account").id,
  };

  const tx = [];
  const pushTx = (daysAgo, type, amount, catName, accountId, notes, toAccountId) => {
    tx.push({
      user_id: userId, type, amount: Math.round(amount * 100) / 100, category_id: catByName[catName] || null,
      account_id: accountId, to_account_id: toAccountId || null, date: addDaysISO(today, -daysAgo), notes: notes || "",
    });
  };
  pushTx(62, "income", 15000, "Salary", acc.bank, "Monthly salary");
  pushTx(58, "expense", 1400, "Housing", acc.bank, "Rent");
  pushTx(55, "expense", 320, "Groceries", acc.cash, "Weekly groceries");
  pushTx(50, "expense", 180, "Fuel", acc.credit, "Fuel top-up");
  pushTx(47, "expense", 95, "Restaurants", acc.cash, "Dinner out");
  pushTx(44, "expense", 60, "Coffee", acc.cash, "Coffee runs");
  pushTx(40, "expense", 250, "Shopping", acc.credit, "Clothes");
  pushTx(35, "expense", 150, "Entertainment", acc.credit, "Cinema + streaming");
  pushTx(30, "transfer", 1000, null, acc.bank, "Move to cash", acc.cash);
  pushTx(32, "expense", 500, "Debt Payment", acc.bank, "iPhone installment #5");
  pushTx(20, "expense", 40, "Healthcare", acc.cash, "Pharmacy");
  pushTx(31, "income", 15000, "Salary", acc.bank, "Monthly salary");
  pushTx(28, "expense", 1400, "Housing", acc.bank, "Rent");
  pushTx(25, "expense", 300, "Groceries", acc.cash, "Groceries");
  pushTx(22, "expense", 210, "Fuel", acc.credit, "Fuel top-up");
  pushTx(19, "expense", 130, "Restaurants", acc.cash, "Family dinner");
  pushTx(16, "expense", 75, "Coffee", acc.cash, "Coffee runs");
  pushTx(14, "expense", 400, "Shopping", acc.credit, "Electronics accessory");
  pushTx(12, "expense", 50, "Entertainment", acc.credit, "Streaming");
  pushTx(10, "expense", 500, "Debt Payment", acc.bank, "iPhone installment #6");
  pushTx(8, "expense", 90, "Personal", acc.cash, "Grooming");
  pushTx(5, "expense", 60, "Bills", acc.bank, "Mobile top-up");
  pushTx(3, "expense", 45, "Coffee", acc.cash, "Coffee runs");
  pushTx(1, "expense", 120, "Groceries", acc.cash, "Groceries");
  must(await supabase.from("transactions").insert(tx), "Seeding transactions");

  const recurringRows = [
    { user_id: userId, name: "Netflix", amount: 50, frequency: "monthly", start_date: addMonthsISO(today, -3).slice(0, 8) + "10", category_id: catByName["Subscriptions"], account_id: acc.credit, active: true, commitment_type: "subscription", posted_dates: [] },
    { user_id: userId, name: "Internet", amount: 300, frequency: "monthly", start_date: addMonthsISO(today, -3).slice(0, 8) + "20", category_id: catByName["Bills"], account_id: acc.bank, active: true, commitment_type: "bill", posted_dates: [] },
    { user_id: userId, name: "Rent", amount: 1400, frequency: "monthly", start_date: addMonthsISO(today, -3).slice(0, 8) + "01", category_id: catByName["Housing"], account_id: acc.bank, active: true, commitment_type: "fixed", posted_dates: [addMonthsISO(today, -2).slice(0, 8) + "01", addMonthsISO(today, -1).slice(0, 8) + "01"] },
    { user_id: userId, name: "Gym Membership", amount: 120, frequency: "monthly", start_date: addMonthsISO(today, -2).slice(0, 8) + "05", category_id: catByName["Personal"], account_id: acc.credit, active: true, commitment_type: "subscription", posted_dates: [] },
  ];
  must(await supabase.from("recurring_payments").insert(recurringRows), "Seeding recurring payments");

  const instStart = addMonthsISO(today, -6);
  const instPayments = Array.from({ length: 6 }).map((_, i) => ({ id: uid(), date: addMonthsISO(instStart, i + 1), amount: 500 }));
  must(await supabase.from("installments").insert([{
    user_id: userId, name: "iPhone 15", total_amount: 6000, monthly_payment: 500, number_of_payments: 12,
    start_date: instStart, account_id: acc.bank, category_id: catByName["Debt Payment"], payments: instPayments,
  }]), "Seeding installments");

  must(await supabase.from("debts").insert([
    { user_id: userId, direction: "owe", person: "Ahmed", amount: 2000, date: addDaysISO(today, -40), due_date: addDaysISO(today, 20), notes: "Borrowed for car repair", status: "open", payments: [{ id: uid(), date: addDaysISO(today, -10), amount: 500, accountId: acc.bank }] },
    { user_id: userId, direction: "owed", person: "Mohamed", amount: 3000, date: addDaysISO(today, -25), due_date: addDaysISO(today, 35), notes: "Lent for laptop purchase", status: "open", payments: [{ id: uid(), date: addDaysISO(today, -5), amount: 1000, accountId: acc.bank }] },
  ]), "Seeding debts");

  must(await supabase.from("budgets").insert([
    { user_id: userId, category_id: catByName["Food"], amount: 900 },
    { user_id: userId, category_id: catByName["Groceries"], amount: 1100 },
    { user_id: userId, category_id: catByName["Fuel"], amount: 800 },
    { user_id: userId, category_id: catByName["Restaurants"], amount: 400 },
    { user_id: userId, category_id: catByName["Shopping"], amount: 500 },
    { user_id: userId, category_id: catByName["Entertainment"], amount: 250 },
  ]), "Seeding budgets");

  must(await supabase.from("savings_goals").insert([
    { user_id: userId, name: "New Car", target: 100000, target_date: addMonthsISO(today, 18), account_id: acc.savings, contributions: [{ id: uid(), date: addDaysISO(today, -55), amount: 5000, accountId: acc.bank }, { id: uid(), date: addDaysISO(today, -25), amount: 5000, accountId: acc.bank }] },
    { user_id: userId, name: "Emergency Fund", target: 20000, target_date: addMonthsISO(today, 10), account_id: acc.savings, contributions: [{ id: uid(), date: addDaysISO(today, -30), amount: 2000, accountId: acc.bank }] },
  ]), "Seeding savings goals");

  must(await supabase.from("assets").insert([
    { user_id: userId, name: "Gold bars (100g)", type: "gold", current_value: 26000, cost_basis: 21000, purchase_date: addMonthsISO(today, -14), notes: "" },
    { user_id: userId, name: "Apartment — Jeddah", type: "property", current_value: 620000, cost_basis: 540000, purchase_date: addMonthsISO(today, -30), notes: "Rented out" },
    { user_id: userId, name: "Tadawul index fund", type: "stocks", current_value: 18500, cost_basis: 20000, purchase_date: addMonthsISO(today, -8), notes: "" },
  ]), "Seeding assets");

  return fetchAllData(userId);
}

// Import a previously exported JSON file: wipes current data, then
// re-inserts everything from the file, remapping old ids to new
// server-assigned ids so foreign keys stay consistent.
export async function replaceAllData(userId, parsed) {
  await wipeDataTables(userId);
  const resCat = await supabase.from("categories").delete().eq("user_id", userId);
  if (resCat.error) throw new Error("Clearing categories failed: " + resCat.error.message);

  const catIdMap = {};
  if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
    const rows = parsed.categories.map((c) => ({ user_id: userId, name: c.name, type: c.type, icon: c.icon || "Tag", core: !!c.core }));
    const inserted = must(await supabase.from("categories").insert(rows).select(), "Importing categories");
    parsed.categories.forEach((c, i) => { catIdMap[c.id] = inserted[i].id; });
  } else {
    await ensureDefaultCategories(userId);
  }

  const accIdMap = {};
  if (Array.isArray(parsed.accounts) && parsed.accounts.length > 0) {
    const rows = parsed.accounts.map((a) => ({ user_id: userId, name: a.name, type: a.type, initial_balance: a.initialBalance || 0, status: a.status || "active" }));
    const inserted = must(await supabase.from("accounts").insert(rows).select(), "Importing accounts");
    parsed.accounts.forEach((a, i) => { accIdMap[a.id] = inserted[i].id; });
  }

  if (Array.isArray(parsed.transactions) && parsed.transactions.length > 0) {
    const rows = parsed.transactions.map((t) => ({
      user_id: userId, type: t.type, amount: t.amount, category_id: catIdMap[t.categoryId] || null,
      account_id: accIdMap[t.accountId], to_account_id: t.toAccountId ? accIdMap[t.toAccountId] : null,
      date: t.date, notes: t.notes || "",
    })).filter((r) => r.account_id); // drop rows whose account wasn't in the file
    if (rows.length) must(await supabase.from("transactions").insert(rows), "Importing transactions");
  }

  if (Array.isArray(parsed.recurringPayments) && parsed.recurringPayments.length > 0) {
    const rows = parsed.recurringPayments.map((r) => ({
      user_id: userId, name: r.name, commitment_type: r.commitmentType || "subscription", amount: r.amount, frequency: r.frequency,
      start_date: r.startDate, end_date: r.endDate || null, category_id: catIdMap[r.categoryId] || null,
      account_id: accIdMap[r.accountId] || null, active: r.active !== false, posted_dates: r.postedDates || [],
    }));
    must(await supabase.from("recurring_payments").insert(rows), "Importing recurring payments");
  }

  if (Array.isArray(parsed.installments) && parsed.installments.length > 0) {
    const rows = parsed.installments.map((i) => ({
      user_id: userId, name: i.name, total_amount: i.totalAmount, monthly_payment: i.monthlyPayment,
      number_of_payments: i.numberOfPayments, start_date: i.startDate, category_id: catIdMap[i.categoryId] || null,
      account_id: accIdMap[i.accountId] || null, payments: i.payments || [],
    }));
    must(await supabase.from("installments").insert(rows), "Importing installments");
  }

  if (Array.isArray(parsed.debts) && parsed.debts.length > 0) {
    const rows = parsed.debts.map((d) => ({
      user_id: userId, direction: d.direction, person: d.person, amount: d.amount, date: d.date,
      due_date: d.dueDate || null, notes: d.notes || "", status: d.status || "open",
      payments: (d.payments || []).map((p) => ({ ...p, accountId: accIdMap[p.accountId] || p.accountId })),
    }));
    must(await supabase.from("debts").insert(rows), "Importing debts");
  }

  if (Array.isArray(parsed.budgets) && parsed.budgets.length > 0) {
    const rows = parsed.budgets.map((b) => ({ user_id: userId, category_id: catIdMap[b.categoryId], amount: b.amount })).filter((r) => r.category_id);
    if (rows.length) must(await supabase.from("budgets").insert(rows), "Importing budgets");
  }

  if (Array.isArray(parsed.savingsGoals) && parsed.savingsGoals.length > 0) {
    const rows = parsed.savingsGoals.map((g) => ({
      user_id: userId, name: g.name, target: g.target, target_date: g.targetDate || null, account_id: accIdMap[g.accountId] || null,
      contributions: (g.contributions || []).map((c) => ({ ...c, accountId: accIdMap[c.accountId] || c.accountId })),
    }));
    must(await supabase.from("savings_goals").insert(rows), "Importing savings goals");
  }

  if (Array.isArray(parsed.assets) && parsed.assets.length > 0) {
    const rows = parsed.assets.map((a) => ({
      user_id: userId, name: a.name, type: a.type, current_value: a.currentValue, cost_basis: a.costBasis || 0,
      purchase_date: a.purchaseDate || null, notes: a.notes || "",
    }));
    must(await supabase.from("assets").insert(rows), "Importing assets");
  }

  if (parsed.meta?.currency) await setCurrency(userId, parsed.meta.currency);

  return fetchAllData(userId);
}
