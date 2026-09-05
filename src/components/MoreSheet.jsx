import { Wallet, Gem, Repeat, CreditCard, Target, PieChart as PieIcon, Settings as SettingsIcon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { Sheet } from "./ui";
import { IconBadge } from "./ui";

export default function MoreSheet({ open, onClose, onNav }) {
  const t = useTheme();
  const items = [
    { id: "accounts", label: "Accounts", icon: Wallet, desc: "Balances across banks, cash & cards" },
    { id: "assets", label: "Assets", icon: Gem, desc: "Gold, property, stocks & other holdings" },
    { id: "recurring", label: "Recurring & bills", icon: Repeat, desc: "Subscriptions & fixed commitments" },
    { id: "debts", label: "Installments & debts", icon: CreditCard, desc: "Payment plans & money owed" },
    { id: "goals", label: "Savings goals", icon: Target, desc: "Targets & progress" },
    { id: "reports", label: "Reports", icon: PieIcon, desc: "Trends & category breakdowns" },
    { id: "settings", label: "Settings", icon: SettingsIcon, desc: "Currency, categories, data" },
  ];
  return (
    <Sheet open={open} onClose={onClose} title="More">
      <div className="flex flex-col gap-2 pb-2">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => { onNav(it.id); onClose(); }} className="flex items-center gap-3 p-3 rounded-2xl text-left active:opacity-70" style={{ background: t.card, border: `1px solid ${t.line}` }}>
              <IconBadge bg={t.bgAlt} size={40}><Icon size={18} color={t.text} strokeWidth={1.7} /></IconBadge>
              <div>
                <div className="text-[14px] font-medium">{it.label}</div>
                <div className="text-[12px]" style={{ color: t.textSoft }}>{it.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
