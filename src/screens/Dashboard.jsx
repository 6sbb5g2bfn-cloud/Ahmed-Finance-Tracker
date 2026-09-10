import { useMemo } from "react";
import {
  Wallet, Gem, Sparkles, ArrowDownRight, ArrowUpRight, Repeat, CreditCard, Copy,
  ChevronRight, TrendingUp, TrendingDown, Calendar, Settings as SettingsIcon,
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "../context/ThemeContext";
import { FONT_DISPLAY } from "../lib/constants";
import { fmtNum, fmtDate, fmtDateLong, todayISO, thisMonthKey, daysBetween, monthLabel } from "../lib/utils";
import {
  totalBalance, totalAssetsValue, totalAssetsGain, monthIncome, monthExpense, monthFixedCommitmentsTotal,
  monthInstallmentsTotal, goalContributed, upcomingPayments, financialInsights, categorySpend, last6Months,
  chartPalette, frequentTransactions, accountBalance,
} from "../lib/calculations";
import { Screen, SectionTitle, Card, Row, Amount, ProgressBar, IconBadge, CategoryIcon } from "../components/ui";

function InsightIcon({ kind, color }) {
  if (kind === "up") return <TrendingUp size={15} color={color} />;
  if (kind === "down") return <TrendingDown size={15} color={color} />;
  if (kind === "calendar") return <Calendar size={15} color={color} />;
  return <Sparkles size={15} color={color} />;
}

export default function Dashboard({ state, onNav, onOpenOccurrence, onRepeat, currency }) {
  const t = useTheme();
  const key = thisMonthKey();
  const frequent = useMemo(() => frequentTransactions(state, 3), [state]);
  const activeAccounts = useMemo(() => state.accounts.filter((a) => a.status === "active"), [state]);
  const bal = totalBalance(state);
  const assetsVal = totalAssetsValue(state);
  const assetsGain = totalAssetsGain(state);
  const netW = bal + assetsVal;
  const inc = monthIncome(state, key);
  const exp = monthExpense(state, key);
  const commitments = monthFixedCommitmentsTotal(state, key);
  const instTotal = monthInstallmentsTotal(state, key);
  const upcoming = useMemo(() => upcomingPayments(state, 30).slice(0, 5), [state]);
  const insights = useMemo(() => financialInsights(state), [state]);

  const catSpend = categorySpend(state, key);
  const pieData = Object.entries(catSpend)
    .map(([cid, val]) => ({ name: state.categories.find((c) => c.id === cid)?.name || "Other", value: Math.round(val * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  const palette = chartPalette(t);

  const trendKeys = last6Months();
  const trendData = trendKeys.map((k) => ({
    month: monthLabel(k), Income: Math.round(monthIncome(state, k)), Expense: Math.round(monthExpense(state, k)),
  }));

  const availableEst = bal - upcomingPayments(state, daysBetween(todayISO(), new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth() + 1, 0)).toISOString().slice(0, 10))).reduce((s, r) => s + r.amount, 0);

  const topBudgets = useMemo(() => {
    return state.budgets
      .map((b) => {
        const spent = catSpend[b.categoryId] || 0;
        return { ...b, spent, pct: b.amount > 0 ? (spent / b.amount) * 100 : 0, cat: state.categories.find((c) => c.id === b.categoryId) };
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
  }, [state, catSpend]);

  return (
    <Screen>
      <div className="px-4 pt-6 pb-1 flex items-center justify-between">
        <div>
          <div className="text-[13px]" style={{ color: t.textSoft }}>{fmtDateLong(todayISO())}</div>
          <div className="text-[20px] font-medium mt-0.5" style={{ fontFamily: FONT_DISPLAY }}>Your money</div>
        </div>
        <button onClick={() => onNav("settings")} className="p-2.5 rounded-full active:opacity-60" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <SettingsIcon size={17} color={t.text} />
        </button>
      </div>

      {/* HERO */}
      <div className="px-4 mt-4">
        <div className="rounded-3xl px-5 py-6" style={{ background: t.hero, color: t.heroText }}>
          <div className="text-[12px] tracking-wide opacity-70">Net worth</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 40, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{fmtNum(netW)}</span>
            <span className="text-[15px] opacity-70">{currency}</span>
          </div>
          <div className="flex items-center gap-4 mt-3 text-[12px] opacity-80">
            <div className="flex items-center gap-1.5"><Wallet size={13} /> Cash {fmtNum(bal)}</div>
            {assetsVal > 0 && <div className="flex items-center gap-1.5"><Gem size={13} /> Assets {fmtNum(assetsVal)}</div>}
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 text-[12px] opacity-80">
            <Sparkles size={13} />
            <span>Est. disposable this month: {fmtNum(Math.max(0, availableEst))} {currency}</span>
          </div>
        </div>
      </div>

      {/* SUMMARY GRID */}
      <div className="px-4 mt-3 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: t.textSoft }}><ArrowDownRight size={13} color={t.green} /> Income</div>
          <div className="mt-1"><Amount value={inc} tone="pos" size="lg" /></div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: t.textSoft }}><ArrowUpRight size={13} color={t.red} /> Expenses</div>
          <div className="mt-1"><Amount value={exp} tone="neg" size="lg" /></div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: t.textSoft }}><Repeat size={13} /> Commitments</div>
          <div className="mt-1"><Amount value={commitments} size="lg" /></div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: t.textSoft }}><CreditCard size={13} /> Installments</div>
          <div className="mt-1"><Amount value={instTotal} size="lg" /></div>
        </Card>
      </div>

      {/* ACCOUNTS PREVIEW */}
      <SectionTitle right={<button onClick={() => onNav("accounts")} className="text-[12px] font-medium flex items-center" style={{ color: t.textSoft }}>All <ChevronRight size={14} /></button>}>
        Accounts
      </SectionTitle>
      <div className="px-4">
        <Card>
          {activeAccounts.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px]" style={{ color: t.textFaint }}>No accounts yet.</div>
          ) : (
            activeAccounts.map((a, i) => (
              <Row key={a.id} noBorder={i === activeAccounts.length - 1}
                onClick={() => onNav("accounts")}
                left={
                  <div className="flex items-center gap-3">
                    <IconBadge bg={t.bgAlt}><Wallet size={16} color={t.textSoft} /></IconBadge>
                    <div className="text-[14px] font-medium">{a.name}</div>
                  </div>
                }
                right={<Amount value={accountBalance(state, a.id)} size="sm" />}
              />
            ))
          )}
        </Card>
      </div>

      {/* QUICK REPEAT */}
      {frequent.length > 0 && (
        <>
          <SectionTitle>Quick add</SectionTitle>
          <div className="px-4 flex gap-2 overflow-x-auto">
            {frequent.map((f) => {
              const cat = state.categories.find((c) => c.id === f.categoryId);
              return (
                <button key={f.id} onClick={() => onRepeat(f)}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl shrink-0 active:opacity-70"
                  style={{ background: t.card, border: `1px solid ${t.line}` }}>
                  <Copy size={13} color={t.textSoft} />
                  <div className="text-left">
                    <div className="text-[12.5px] font-medium leading-tight">{cat?.name}</div>
                    <div className="text-[11px] leading-tight" style={{ color: t.textSoft, fontVariantNumeric: "tabular-nums" }}>{fmtNum(f.amount)} {currency}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* INSIGHTS */}
      {insights.length > 0 && (
        <>
          <SectionTitle>Insights</SectionTitle>
          <div className="px-4 flex flex-col gap-2">
            {insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2.5 px-4 py-3 rounded-2xl" style={{ background: t.goldSoft }}>
                <div className="mt-0.5"><InsightIcon kind={ins.icon} color={t.gold} /></div>
                <div className="text-[13px] leading-snug" style={{ color: t.text }}>{ins.text}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* UPCOMING */}
      <SectionTitle right={<button onClick={() => onNav("recurring")} className="text-[12px] font-medium flex items-center" style={{ color: t.textSoft }}>All <ChevronRight size={14} /></button>}>
        Upcoming payments
      </SectionTitle>
      <div className="px-4">
        <Card>
          {upcoming.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px]" style={{ color: t.textFaint }}>Nothing due in the next 30 days.</div>
          ) : (
            upcoming.map((u, i) => {
              const cat = u.categoryId ? state.categories.find((c) => c.id === u.categoryId) : null;
              const overdue = u.date < todayISO();
              return (
                <Row key={i} noBorder={i === upcoming.length - 1}
                  onClick={() => onOpenOccurrence(u)}
                  left={
                    <div className="flex items-center gap-3">
                      <IconBadge bg={t.bgAlt}><CategoryIcon category={cat} /></IconBadge>
                      <div>
                        <div className="text-[14px] font-medium">{u.name}</div>
                        <div className="text-[12px]" style={{ color: overdue ? t.red : t.textSoft }}>{overdue ? "Overdue · " : ""}{fmtDate(u.date)}</div>
                      </div>
                    </div>
                  }
                  right={<Amount value={u.amount} size="sm" tone={u.kind === "debt" && u.direction === "owed" ? "pos" : "neg"} />}
                />
              );
            })
          )}
        </Card>
      </div>

      {/* SPENDING BY CATEGORY */}
      {pieData.length > 0 && (
        <>
          <SectionTitle right={<button onClick={() => onNav("reports")} className="text-[12px] font-medium flex items-center" style={{ color: t.textSoft }}>Reports <ChevronRight size={14} /></button>}>
            Spending by category
          </SectionTitle>
          <div className="px-4">
            <Card className="p-4">
              <div className="flex items-center">
                <div style={{ width: 128, height: 128 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2} stroke="none">
                        {pieData.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 flex flex-col gap-1.5 pl-2">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="rounded-full shrink-0" style={{ width: 7, height: 7, background: palette[i % palette.length] }} />
                        <span className="truncate" style={{ color: t.textSoft }}>{d.name}</span>
                      </div>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtNum(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* MONTHLY TREND */}
      <SectionTitle>6-month trend</SectionTitle>
      <div className="px-4">
        <Card className="p-4">
          <div style={{ width: "100%", height: 140 }}>
            <ResponsiveContainer>
              <BarChart data={trendData} barGap={2}>
                <CartesianGrid vertical={false} stroke={t.line} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: t.textSoft }} axisLine={{ stroke: t.line }} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v) => fmtNum(v)} contentStyle={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="Income" fill={t.green} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Expense" fill={t.red} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* ASSETS PREVIEW */}
      {assetsVal > 0 && (
        <>
          <SectionTitle right={<button onClick={() => onNav("assets")} className="text-[12px] font-medium flex items-center" style={{ color: t.textSoft }}>All <ChevronRight size={14} /></button>}>
            Assets
          </SectionTitle>
          <div className="px-4">
            <Card className="p-4 flex items-center justify-between" onClick={() => onNav("assets")}>
              <div>
                <div className="text-[12px]" style={{ color: t.textSoft }}>Total value</div>
                <Amount value={assetsVal} size="lg" />
              </div>
              <div className="text-right">
                <div className="text-[12px]" style={{ color: t.textSoft }}>Gain / loss</div>
                <div className="flex items-center gap-1 justify-end text-[14px] font-medium" style={{ fontFamily: FONT_DISPLAY, color: assetsGain >= 0 ? t.green : t.red }}>
                  {assetsGain >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {assetsGain >= 0 ? "+" : ""}{fmtNum(assetsGain)}
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* BUDGETS PREVIEW */}
      {topBudgets.length > 0 && (
        <>
          <SectionTitle right={<button onClick={() => onNav("budgets")} className="text-[12px] font-medium flex items-center" style={{ color: t.textSoft }}>All <ChevronRight size={14} /></button>}>
            Budgets to watch
          </SectionTitle>
          <div className="px-4">
            <Card className="p-4 flex flex-col gap-4">
              {topBudgets.map((b) => (
                <div key={b.id}>
                  <div className="flex items-center justify-between text-[13px] mb-1.5">
                    <span className="font-medium">{b.cat?.name}</span>
                    <span style={{ color: t.textSoft, fontVariantNumeric: "tabular-nums" }}>{fmtNum(b.spent)} / {fmtNum(b.amount)}</span>
                  </div>
                  <ProgressBar pct={b.pct} color={b.pct >= 100 ? t.red : b.pct >= 80 ? t.gold : t.green} />
                </div>
              ))}
            </Card>
          </div>
        </>
      )}

      <div className="h-6" />
    </Screen>
  );
}
