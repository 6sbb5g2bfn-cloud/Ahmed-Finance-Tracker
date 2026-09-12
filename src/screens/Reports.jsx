import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { FONT_DISPLAY } from "../lib/constants";
import { fmtNum, thisMonthKey, monthKeyOf, addMonthsISO, todayISO, monthLabel } from "../lib/utils";
import {
  monthIncome, monthExpense, last6Months, categorySpend, chartPalette,
  totalAssetsValue, totalAssetsCost, totalAssetsGain, assetsByType, totalBalance,
} from "../lib/calculations";
import { Screen, SectionTitle, Card, Amount, ProgressBar } from "../components/ui";

export default function ReportsScreen({ state, fxRates }) {
  const t = useTheme();
  const key = thisMonthKey();
  const prevKey = monthKeyOf(addMonthsISO(todayISO(), -1));
  const inc = monthIncome(state, key), exp = monthExpense(state, key);
  const prevInc = monthIncome(state, prevKey), prevExp = monthExpense(state, prevKey);
  const net = inc - exp;

  const trendKeys = last6Months();
  const trendData = trendKeys.map((k) => ({ month: monthLabel(k), Income: Math.round(monthIncome(state, k)), Expense: Math.round(monthExpense(state, k)) }));
  const avgExpense = trendData.reduce((s, d) => s + d.Expense, 0) / trendData.length;

  const catSpend = categorySpend(state, key);
  const pieData = Object.entries(catSpend).map(([cid, val]) => ({ name: state.categories.find((c) => c.id === cid)?.name || "Other", value: Math.round(val * 100) / 100 })).sort((a, b) => b.value - a.value);
  const palette = chartPalette(t);
  const totalCat = pieData.reduce((s, d) => s + d.value, 0);

  const budgetRows = state.budgets.map((b) => {
    const spent = catSpend[b.categoryId] || 0;
    return { cat: state.categories.find((c) => c.id === b.categoryId), spent, amount: b.amount, pct: b.amount > 0 ? (spent / b.amount) * 100 : 0 };
  });

  const assetsVal = totalAssetsValue(state);
  const assetsCost = totalAssetsCost(state);
  const assetsGain = totalAssetsGain(state);
  const assetsGainPct = assetsCost > 0 ? (assetsGain / assetsCost) * 100 : null;
  const assetBreakdown = assetsByType(state);
  const netW = totalBalance(state, fxRates) + assetsVal;

  const Delta = ({ now, prev, invert }) => {
    if (prev === 0) return null;
    const pct = ((now - prev) / prev) * 100;
    const good = invert ? pct < 0 : pct > 0;
    return (
      <span className="text-[11px] font-medium ml-1.5" style={{ color: good ? t.green : t.red }}>
        {pct > 0 ? "+" : ""}{Math.round(pct)}% vs last month
      </span>
    );
  };

  return (
    <Screen>
      <div className="px-4 pt-6"><div className="text-[20px] font-medium" style={{ fontFamily: FONT_DISPLAY }}>Reports</div></div>

      <SectionTitle>This month</SectionTitle>
      <div className="px-4 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-[12px]" style={{ color: t.textSoft }}>Income</div>
          <Amount value={inc} tone="pos" size="lg" /><Delta now={inc} prev={prevInc} />
        </Card>
        <Card className="p-4">
          <div className="text-[12px]" style={{ color: t.textSoft }}>Expenses</div>
          <Amount value={exp} tone="neg" size="lg" /><Delta now={exp} prev={prevExp} invert />
        </Card>
      </div>
      <div className="px-4 mt-3">
        <Card className="p-4 flex items-center justify-between">
          <div className="text-[13px] font-medium">Net cash flow</div>
          <Amount value={net} size="lg" tone={net >= 0 ? "pos" : "neg"} />
        </Card>
      </div>

      {(state.assets || []).length > 0 && (
        <>
          <SectionTitle>Net worth</SectionTitle>
          <div className="px-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12px]" style={{ color: t.textSoft }}>Cash + assets</div>
                  <Amount value={netW} size="lg" />
                </div>
                <div className="text-right">
                  <div className="text-[12px]" style={{ color: t.textSoft }}>Assets gain/loss</div>
                  <div className="flex items-center gap-1 justify-end text-[14px] font-medium" style={{ fontFamily: FONT_DISPLAY, color: assetsGain >= 0 ? t.green : t.red }}>
                    {assetsGain >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {assetsGain >= 0 ? "+" : ""}{fmtNum(assetsGain)} {assetsGainPct !== null ? `(${assetsGain >= 0 ? "+" : ""}${Math.round(assetsGainPct)}%)` : ""}
                  </div>
                </div>
              </div>
              {assetBreakdown.length > 0 && (
                <div className="mt-4 pt-4 flex flex-col gap-2.5" style={{ borderTop: `1px solid ${t.line}` }}>
                  {assetBreakdown.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-[12.5px]">
                      <span style={{ color: t.textSoft }}>{d.label}</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtNum(d.value)} · {assetsVal > 0 ? Math.round((d.value / assetsVal) * 100) : 0}%</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      <SectionTitle>Income vs expense — 6 months</SectionTitle>
      <div className="px-4">
        <Card className="p-4">
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={trendData} barGap={2}>
                <CartesianGrid vertical={false} stroke={t.line} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: t.textSoft }} axisLine={{ stroke: t.line }} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v) => fmtNum(v)} contentStyle={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 10, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Income" fill={t.green} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Expense" fill={t.red} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[12px] mt-1" style={{ color: t.textSoft }}>Average monthly spending: {fmtNum(avgExpense)} {state.meta.currency}</div>
        </Card>
      </div>

      <SectionTitle>Category breakdown — this month</SectionTitle>
      <div className="px-4">
        <Card className="p-4">
          {pieData.length === 0 ? (
            <div className="text-center py-6 text-[13px]" style={{ color: t.textFaint }}>No expenses recorded this month yet.</div>
          ) : (
            <div className="flex items-center">
              <div style={{ width: 120, height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={34} outerRadius={58} paddingAngle={2} stroke="none">
                      {pieData.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 pl-2 flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="rounded-full shrink-0" style={{ width: 7, height: 7, background: palette[i % palette.length] }} />
                      <span className="truncate" style={{ color: t.textSoft }}>{d.name}</span>
                    </div>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{totalCat > 0 ? Math.round((d.value / totalCat) * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {budgetRows.length > 0 && (
        <>
          <SectionTitle>Budget utilization</SectionTitle>
          <div className="px-4">
            <Card className="p-4 flex flex-col gap-4">
              {budgetRows.map((b, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between text-[13px] mb-1.5">
                    <span className="font-medium">{b.cat?.name}</span>
                    <span style={{ color: t.textSoft }}>{Math.round(b.pct)}%</span>
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
