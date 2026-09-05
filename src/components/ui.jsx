import { Plus, X, Tag } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { FONT_DISPLAY, FONT_UI, ICONS } from "../lib/constants";
import { fmtNum, clamp } from "../lib/utils";

export function CategoryIcon({ category, size = 16, color }) {
  const t = useTheme();
  const Cmp = (category && ICONS[category.icon]) || Tag;
  return <Cmp size={size} color={color || t.text} strokeWidth={1.8} />;
}

export function IconBadge({ children, bg, size = 34 }) {
  return (
    <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: size, height: size, background: bg }}>
      {children}
    </div>
  );
}

export function Screen({ children }) {
  const t = useTheme();
  return (
    <div className="min-h-full pb-28" style={{ background: t.bg, color: t.text, fontFamily: FONT_UI }}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }) {
  const t = useTheme();
  return (
    <div className="flex items-center justify-between px-4 mt-6 mb-2">
      <h2 className="text-[13px] tracking-wide font-medium" style={{ color: t.textSoft }}>{children}</h2>
      {right}
    </div>
  );
}

export function Card({ children, className = "", style = {}, onClick }) {
  const t = useTheme();
  return (
    <div onClick={onClick} className={"rounded-2xl " + className} style={{ background: t.card, border: `1px solid ${t.line}`, ...style }}>
      {children}
    </div>
  );
}

export function Row({ left, right, onClick, className = "", noBorder }) {
  const t = useTheme();
  return (
    <div onClick={onClick} className={"flex items-center justify-between gap-3 px-4 py-3 " + (onClick ? "active:opacity-60 " : "") + className}
      style={{ borderBottom: noBorder ? "none" : `1px solid ${t.line}` }}>
      {left}
      {right}
    </div>
  );
}

export function Amount({ value, size = "base", tone, prefix = "" }) {
  const t = useTheme();
  const color = tone === "pos" ? t.green : tone === "neg" ? t.red : tone === "gold" ? t.gold : t.text;
  const sizeClass = { xs: "text-xs", sm: "text-sm", base: "text-base", lg: "text-xl", xl: "text-3xl", xxl: "text-4xl" }[size];
  return (
    <span className={sizeClass} style={{ fontFamily: FONT_DISPLAY, fontVariantNumeric: "tabular-nums", color, fontWeight: 500 }}>
      {prefix}{fmtNum(value)}
    </span>
  );
}

export function ProgressBar({ pct, color, bg, height = 8 }) {
  const t = useTheme();
  const p = clamp(pct, 0, 100);
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: bg || t.bgAlt }}>
      <div className="h-full rounded-full" style={{ width: `${p}%`, background: color || t.green, transition: "width .4s ease" }} />
    </div>
  );
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }) {
  const t = useTheme();
  return (
    <div className="flex flex-col items-center text-center px-8 py-12">
      <div className="mb-3" style={{ color: t.textFaint }}>{icon}</div>
      <div className="text-[15px] font-medium mb-1" style={{ color: t.text }}>{title}</div>
      {subtitle && <div className="text-[13px] mb-4" style={{ color: t.textSoft }}>{subtitle}</div>}
      {actionLabel && (
        <button onClick={onAction} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium" style={{ background: t.ink, color: t.bg }}>
          <Plus size={15} /> {actionLabel}
        </button>
      )}
    </div>
  );
}

export function PrimaryButton({ children, onClick, full, disabled, style = {} }) {
  const t = useTheme();
  return (
    <button onClick={onClick} disabled={disabled}
      className={"flex items-center justify-center gap-1.5 rounded-full text-[14px] font-medium px-5 py-3 active:opacity-70 " + (full ? "w-full" : "")}
      style={{ background: disabled ? t.textFaint : t.ink, color: t.bg, opacity: disabled ? 0.5 : 1, ...style }}>
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, full, danger }) {
  const t = useTheme();
  return (
    <button onClick={onClick} className={"flex items-center justify-center gap-1.5 rounded-full text-[14px] font-medium px-5 py-3 active:opacity-60 " + (full ? "w-full" : "")}
      style={{ background: "transparent", color: danger ? t.red : t.text, border: `1px solid ${danger ? t.red : t.lineStrong}` }}>
      {children}
    </button>
  );
}

export function FieldLabel({ children }) {
  const t = useTheme();
  return <div className="text-[12px] font-medium mb-1.5" style={{ color: t.textSoft }}>{children}</div>;
}

export function TextInput({ value, onChange, placeholder, type = "text", inputMode, autoFocus, step, onBlur }) {
  const t = useTheme();
  return (
    <input autoFocus={autoFocus} type={type} step={step} inputMode={inputMode} value={value}
      onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder}
      className="w-full px-3.5 py-3 rounded-xl text-[15px] outline-none"
      style={{ background: t.bgAlt, color: t.text, border: `1px solid ${t.line}`, fontFamily: FONT_UI }} />
  );
}

export function SelectPills({ options, value, onChange, getLabel, getId }) {
  const t = useTheme();
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const id = getId ? getId(opt) : opt.id;
        const label = getLabel ? getLabel(opt) : opt.label;
        const active = value === id;
        return (
          <button key={id} onClick={() => onChange(id)} className="px-3.5 py-2 rounded-full text-[13px] font-medium active:opacity-70"
            style={{ background: active ? t.ink : t.bgAlt, color: active ? t.bg : t.text, border: `1px solid ${active ? t.ink : t.line}` }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Sheet({ open, onClose, title, children, footer }) {
  const t = useTheme();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="absolute inset-0" style={{ background: "rgba(10,14,12,0.5)" }} onClick={onClose} />
      <div className="relative rounded-t-3xl flex flex-col" style={{ background: t.bg, maxHeight: "88vh", boxShadow: "0 -8px 30px rgba(0,0,0,0.25)" }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${t.line}` }}>
          <div className="text-[16px] font-medium" style={{ fontFamily: FONT_DISPLAY }}>{title}</div>
          <button onClick={onClose} className="p-1.5 rounded-full active:opacity-60" style={{ background: t.bgAlt }}>
            <X size={16} color={t.text} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="px-4 py-3" style={{ borderTop: `1px solid ${t.line}`, background: t.bg }}>{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, onCancel, onConfirm, confirmLabel = "Delete", danger = true }) {
  const t = useTheme();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6" style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="absolute inset-0" style={{ background: "rgba(10,14,12,0.55)" }} onClick={onCancel} />
      <div className="relative rounded-2xl p-5 w-full" style={{ background: t.card, border: `1px solid ${t.line}` }}>
        <div className="text-[15px] font-medium mb-1.5">{title}</div>
        <div className="text-[13px] mb-4" style={{ color: t.textSoft }}>{message}</div>
        <div className="flex gap-2">
          <GhostButton onClick={onCancel} full>Cancel</GhostButton>
          <PrimaryButton onClick={onConfirm} full style={danger ? { background: t.red } : {}}>{confirmLabel}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

export function Toast({ message }) {
  const t = useTheme();
  if (!message) return null;
  return (
    <div className="fixed left-0 right-0 z-[70] flex justify-center px-6" style={{ bottom: 100, maxWidth: 480, margin: "0 auto" }}>
      <div className="px-4 py-2.5 rounded-full text-[13px] font-medium shadow-lg" style={{ background: t.ink, color: t.bg }}>
        {message}
      </div>
    </div>
  );
}
