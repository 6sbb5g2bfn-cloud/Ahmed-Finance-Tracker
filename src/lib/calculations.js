import {
  todayISO, addDaysISO, addMonthsISO, monthKeyOf, thisMonthKey, daysBetween, fmtNum,
  occurrencesInRange, nextUnpostedOccurrence,
} from "./utils";
import { ASSET_TYPES } from "./constants";

/* =========================================================================
   Everything here is computed from the raw records in `state`
   (accounts, transactions, recurringPayments, installments, debts,
   budgets, savingsGoals, assets). Nothing is stored twice, so edits or
   deletes anywhere automatically keep every total correct.
   ========================================================================= */
export function accountBalance(state, accountId) {
  const acc = state.accounts.find((a) => a.id === accountId);
  if (!acc) return 0;
  let bal = acc.initialBalance || 0;
  for (const t of state.transactions) {
    if (t.type === "income" && t.accountId === accountId) bal += t.amount;
    else if (t.type === "expense" && t.accountId === accountId) bal -= t.amount;
    else if (t.type === "transfer") {
      if (t.accountId === accountId) bal -= t.amount;
      if (t.toAccountId === accountId) bal += t.amount;
    }
  }
  return bal;
}

// fxRates: resolved { CURRENCY_CODE: rate_to_main_currency } map, built once at
// the app level (see App.jsx) so this stays a plain synchronous calculation -
// no network calls happen inside here. Accounts already in the main currency,
// or with no rate available yet, are simply added unconverted.
export function totalBalance(state, fxRates = {}) {
  return state.accounts.filter((a) => a.status === "active").reduce((s, a) => {
    const bal = accountBalance(state, a.id);
    const currency = a.currency || state.meta.currency;
    if (currency === state.meta.currency) return s + bal;
    const rate = fxRates[currency];
    return s + (rate ? bal * rate : bal);
  }, 0);
}

export function totalAssetsValue(state) {
  return (state.assets || []).reduce((s, a) => s + (a.currentValue || 0), 0);
}
export function totalAssetsCost(state) {
  return (state.assets || []).reduce((s, a) => s + (a.costBasis || 0), 0);
}
export function totalAssetsGain(state) {
  return totalAssetsValue(state) - totalAssetsCost(state);
}
export function netWorth(state, fxRates = {}) {
  return totalBalance(state, fxRates) + totalAssetsValue(state);
}
export function assetsByType(state) {
  const byType = {};
  for (const a of state.assets || []) {
    byType[a.type] = (byType[a.type] || 0) + (a.currentValue || 0);
  }
  return ASSET_TYPES.map((tp) => ({ type: tp.id, label: tp.label, value: byType[tp.id] || 0 })).filter((r) => r.value > 0);
}

export function txInMonth(state, key) {
  return state.transactions.filter((t) => monthKeyOf(t.date) === key);
}

export function monthIncome(state, key) {
  return txInMonth(state, key).filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
}
export function monthExpense(state, key) {
  return txInMonth(state, key).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
}

export function categorySpend(state, key) {
  const map = {};
  for (const t of txInMonth(state, key)) {
    if (t.type !== "expense") continue;
    map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
  }
  return map;
}

/* All active recurring items due within this calendar month, unposted */
export function monthUpcomingRecurring(state, key) {
  const [y, m] = key.split("-").map(Number);
  const start = `${key}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const rows = [];
  for (const r of state.recurringPayments) {
    for (const d of occurrencesInRange(r, start, end)) {
      rows.push({ kind: "recurring", ref: r, date: d, name: r.name, amount: r.amount, categoryId: r.categoryId });
    }
  }
  return rows;
}

export function installmentRemaining(inst) {
  const paidSum = inst.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, Math.round((inst.totalAmount - paidSum) * 100) / 100);
  const paidCount = inst.payments.length;
  const remainingCount = Math.max(0, inst.numberOfPayments - paidCount);
  const nextDate = remainingCount > 0 ? addMonthsISO(inst.startDate, paidCount + 1) : null;
  return { paidSum, remaining, paidCount, remainingCount, nextDate, complete: remainingCount === 0 || remaining <= 0 };
}

export function monthInstallmentsDue(state, key) {
  const rows = [];
  for (const inst of state.installments) {
    const { nextDate, complete } = installmentRemaining(inst);
    if (!complete && nextDate && monthKeyOf(nextDate) === key) {
      rows.push({ kind: "installment", ref: inst, date: nextDate, name: inst.name, amount: inst.monthlyPayment });
    }
  }
  return rows;
}

export function debtRemaining(debt) {
  const paidSum = debt.payments.reduce((s, p) => s + p.amount, 0);
  return Math.max(0, Math.round((debt.amount - paidSum) * 100) / 100);
}

export function monthDebtsDue(state, key) {
  const rows = [];
  for (const d of state.debts) {
    const remaining = debtRemaining(d);
    if (remaining > 0 && d.dueDate && monthKeyOf(d.dueDate) === key) {
      rows.push({ kind: "debt", ref: d, date: d.dueDate, name: `${d.direction === "owe" ? "Pay" : "Collect from"} ${d.person}`, amount: remaining });
    }
  }
  return rows;
}

export function upcomingPayments(state, horizonDays = 30) {
  const today = todayISO();
  const end = addDaysISO(today, horizonDays);
  const rows = [];
  for (const r of state.recurringPayments) {
    const d = nextUnpostedOccurrence(r);
    if (d && d <= end) rows.push({ kind: "recurring", ref: r, date: d, name: r.name, amount: r.amount, categoryId: r.categoryId });
  }
  for (const inst of state.installments) {
    const { nextDate, complete } = installmentRemaining(inst);
    if (!complete && nextDate && nextDate <= end) rows.push({ kind: "installment", ref: inst, date: nextDate, name: inst.name, amount: inst.monthlyPayment });
  }
  for (const d of state.debts) {
    const remaining = debtRemaining(d);
    if (remaining > 0 && d.dueDate && d.dueDate <= end) {
      rows.push({ kind: "debt", ref: d, date: d.dueDate, name: `${d.direction === "owe" ? "Pay" : "Collect from"} ${d.person}`, amount: remaining, direction: d.direction });
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

export function monthFixedCommitmentsTotal(state, key) {
  return monthUpcomingRecurring(state, key).reduce((s, r) => s + r.amount, 0)
    + state.recurringPayments.reduce((s, r) => {
        const posted = (r.postedDates || []).filter((d) => monthKeyOf(d) === key);
        return s + posted.length * r.amount;
      }, 0);
}

export function monthInstallmentsTotal(state, key) {
  let sum = 0;
  for (const inst of state.installments) {
    const hasPaymentThisMonth = inst.payments.some((p) => monthKeyOf(p.date) === key);
    const { nextDate, complete } = installmentRemaining(inst);
    const dueThisMonth = !complete && nextDate && monthKeyOf(nextDate) === key;
    if (hasPaymentThisMonth || dueThisMonth) sum += inst.monthlyPayment;
  }
  return sum;
}

export function goalContributed(goal) {
  return (goal.contributions || []).reduce((s, c) => s + c.amount, 0);
}
export function goalRequiredMonthly(goal) {
  const remaining = Math.max(0, goal.target - goalContributed(goal));
  if (!goal.targetDate) return remaining;
  const months = Math.max(1, Math.ceil(daysBetween(todayISO(), goal.targetDate) / 30));
  return remaining / months;
}

export function frequentTransactions(state, n = 3) {
  const cutoff = addDaysISO(todayISO(), -60);
  const recent = state.transactions.filter((t) => t.type === "expense" && t.date >= cutoff);
  const map = {};
  for (const t of recent) {
    const key = `${t.categoryId}|${t.accountId}|${t.amount}`;
    if (!map[key]) map[key] = { count: 0, sample: t };
    map[key].count++;
  }
  return Object.values(map).filter((x) => x.count >= 2).sort((a, b) => b.count - a.count).slice(0, n).map((x) => x.sample);
}

export function last6Months() {
  const arr = [];
  for (let i = 5; i >= 0; i--) arr.push(monthKeyOf(addMonthsISO(todayISO(), -i)));
  return arr;
}

export function financialInsights(state) {
  const insights = [];
  const key = thisMonthKey();
  const prevKey = monthKeyOf(addMonthsISO(todayISO(), -1));
  const catNow = categorySpend(state, key);
  const catPrev = categorySpend(state, prevKey);
  let biggestDelta = null;
  for (const cid of Object.keys(catNow)) {
    const now = catNow[cid], prev = catPrev[cid] || 0;
    if (prev > 50) {
      const pct = ((now - prev) / prev) * 100;
      if (!biggestDelta || Math.abs(pct) > Math.abs(biggestDelta.pct)) biggestDelta = { cid, pct, now, prev };
    }
  }
  if (biggestDelta && Math.abs(biggestDelta.pct) >= 10) {
    const cat = state.categories.find((c) => c.id === biggestDelta.cid);
    const dir = biggestDelta.pct > 0 ? "more" : "less";
    insights.push({
      icon: biggestDelta.pct > 0 ? "up" : "down",
      text: `You spent ${Math.abs(Math.round(biggestDelta.pct))}% ${dir} on ${cat ? cat.name.toLowerCase() : "this category"} than last month.`,
    });
  }
  const upcoming = upcomingPayments(state, 30).reduce((s, r) => s + r.amount, 0);
  if (upcoming > 0) {
    insights.push({ icon: "calendar", text: `You have ${fmtNum(upcoming)} ${state.meta.currency} of upcoming commitments in the next 30 days.` });
  }
  const endOfMonth = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth() + 1, 0)).toISOString().slice(0, 10);
  const daysLeftInMonth = Math.max(1, daysBetween(todayISO(), endOfMonth));
  const disposable = totalBalance(state) - upcomingPayments(state, daysLeftInMonth).reduce((s, r) => s + r.amount, 0);
  insights.push({ icon: "sparkle", text: `Your estimated disposable amount this month is ${fmtNum(Math.max(0, disposable))} ${state.meta.currency}.` });
  return insights.slice(0, 3);
}

export function chartPalette(t) {
  return [t.green, t.gold, t.blue, t.red, t.plum, t.teal, t.textSoft, t.lineStrong];
}
