import { useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { LIGHT, FONT_DISPLAY, FONT_UI } from "../lib/constants";
import { PrimaryButton, GhostButton, FieldLabel, TextInput } from "../components/ui";
import { ThemeCtx } from "../context/ThemeContext";

export default function Auth() {
  const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const t = LIGHT;

  const canSubmit = email.trim().length > 3 && password.length >= 6 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        setNotice("Account created. If email confirmation is enabled on your Supabase project, check your inbox before signing in.");
      }
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemeCtx.Provider value={t}>
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: t.bg, fontFamily: FONT_UI }}>
        <div className="w-full" style={{ maxWidth: 380 }}>
          <div className="flex flex-col items-center mb-8">
            <div className="rounded-2xl flex items-center justify-center mb-4" style={{ width: 56, height: 56, background: t.ink }}>
              <Wallet size={24} color={t.bg} />
            </div>
            <div className="text-[22px] font-medium" style={{ fontFamily: FONT_DISPLAY, color: t.text }}>Finance Tracker</div>
            <div className="text-[13px] mt-1" style={{ color: t.textSoft }}>Your money, privately tracked</div>
          </div>

          <div className="flex mb-5 rounded-full p-1" style={{ background: t.bgAlt }}>
            <button onClick={() => { setMode("signin"); setError(""); setNotice(""); }}
              className="flex-1 py-2 rounded-full text-[13px] font-medium"
              style={{ background: mode === "signin" ? t.ink : "transparent", color: mode === "signin" ? t.bg : t.textSoft }}>
              Sign in
            </button>
            <button onClick={() => { setMode("signup"); setError(""); setNotice(""); }}
              className="flex-1 py-2 rounded-full text-[13px] font-medium"
              style={{ background: mode === "signup" ? t.ink : "transparent", color: mode === "signup" ? t.bg : t.textSoft }}>
              Create account
            </button>
          </div>

          <FieldLabel>Email</FieldLabel>
          <TextInput value={email} onChange={setEmail} placeholder="you@example.com" type="email" autoFocus />

          <div className="mt-4">
            <FieldLabel>Password</FieldLabel>
            <TextInput value={password} onChange={setPassword} placeholder="At least 6 characters" type="password" />
          </div>

          {error && <div className="mt-3 text-[13px]" style={{ color: t.red }}>{error}</div>}
          {notice && <div className="mt-3 text-[13px]" style={{ color: t.green }}>{notice}</div>}

          <div className="mt-6">
            <PrimaryButton full disabled={!canSubmit} onClick={submit}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : mode === "signin" ? "Sign in" : "Create account"}
            </PrimaryButton>
          </div>

          <div className="mt-4 text-[11px] text-center" style={{ color: t.textFaint }}>
            Your data is private to your account — nobody else can see it.
          </div>
                 

        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
