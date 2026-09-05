import { Home, Receipt, Plus, PieChart as PieIcon, Menu } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function BottomNav({ active, onNav, onAdd, onMore }) {
  const t = useTheme();
  const items = [
    { id: "dashboard", label: "Home", icon: Home },
    { id: "transactions", label: "Activity", icon: Receipt },
    null,
    { id: "budgets", label: "Budgets", icon: PieIcon },
    { id: "more", label: "More", icon: Menu },
  ];
  return (
    <div className="fixed left-0 right-0 bottom-0 z-40" style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="flex items-end justify-around px-2 pt-2" style={{ background: t.ink, paddingBottom: "max(10px, env(safe-area-inset-bottom))", borderTop: `1px solid ${t.line}` }}>
        {items.map((it, i) => {
          if (!it) {
            return (
              <button key="add" onClick={onAdd} className="flex flex-col items-center -mt-6 active:opacity-80">
                <div className="rounded-full flex items-center justify-center shadow-lg" style={{ width: 52, height: 52, background: t.gold }}>
                  <Plus size={24} color={t.ink} strokeWidth={2.3} />
                </div>
              </button>
            );
          }
          const Icon = it.icon;
          const isActive = it.id === "more" ? false : active === it.id;
          return (
            <button key={it.id} onClick={() => (it.id === "more" ? onMore() : onNav(it.id))} className="flex flex-col items-center gap-1 px-2 py-1.5 active:opacity-70">
              <Icon size={20} color={isActive ? t.gold : "#8A9289"} strokeWidth={isActive ? 2.1 : 1.7} />
              <span className="text-[10px]" style={{ color: isActive ? t.gold : "#8A9289" }}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
