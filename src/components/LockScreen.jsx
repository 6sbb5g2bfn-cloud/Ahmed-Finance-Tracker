import { useState } from "react";
import { ScanFace, Loader2 } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { FONT_DISPLAY } from "../lib/constants";
import { verifyFaceId } from "../lib/webauthn";

export default function LockScreen({ credentialId, onUnlock }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleUnlock = async () => {
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyFaceId(credentialId);
      if (ok) onUnlock();
      else setError("Couldn't verify. Try again.");
    } catch (e) {
      setError("Cancelled or not recognized. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8" style={{ background: t.ink }}>
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ background: "rgba(246,243,236,0.1)" }}>
        <ScanFace size={30} color={t.bg} />
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: t.bg }} className="mb-1">Finance Tracker</div>
      <div className="text-[13px] mb-8" style={{ color: "rgba(246,243,236,0.6)" }}>Locked for your privacy</div>

      <button
        onClick={handleUnlock}
        disabled={busy}
        className="flex items-center gap-2 px-6 py-3 rounded-full active:opacity-70"
        style={{ background: t.bg, color: t.ink }}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <ScanFace size={16} />}
        <span className="text-[14px] font-medium">{busy ? "Verifying\u2026" : "Unlock with Face ID"}</span>
      </button>

      {error && <div className="mt-4 text-[12.5px]" style={{ color: t.red }}>{error}</div>}
    </div>
  );
}
