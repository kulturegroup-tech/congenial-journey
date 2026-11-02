"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const errors: Record<string, string> = {
  domain: "That account isn't on the Paradigm Shifters team. Use your @paradigmshifters.in account.",
  auth: "Sign-in didn't complete. Please try again.",
};

// Google sign-in shows only once it is switched on in Supabase (Authentication → Providers → Google)
// and NEXT_PUBLIC_GOOGLE_SIGNIN=on is set in Netlify. Until then the button would lead to an error page.
const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "on";

// Supabase's error codes, in words the team can act on.
function explain(error: { code?: string; message: string }) {
  if (error.code === "email_address_not_authorized")
    return "Email sign-in links can't reach this address yet. Use Google sign-in, or ask your admin to finish email setup.";
  if (error.code === "over_email_send_rate_limit")
    return "Too many sign-in emails in the last hour. Wait a bit, or use Google sign-in.";
  return error.message;
}

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<null | "google" | "email">(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(errors[params.get("error") ?? ""] ?? null);

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function withGoogle() {
    setBusy("google");
    setMessage(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback(), queryParams: { prompt: "select_account" } },
    });
    if (error) {
      setMessage(error.message);
      setBusy(null);
    }
  }

  async function withEmail(e: FormEvent) {
    e.preventDefault();
    setBusy("email");
    setMessage(null);
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callback() },
    });
    setBusy(null);
    if (error) setMessage(explain(error));
    else setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <div className="rounded-xl border border-line bg-surface px-6 py-6">
        <p className="font-medium">Check your inbox</p>
        <p className="mt-1 text-muted">We sent a sign-in link to {sentTo}. Open it on this device.</p>
        <button type="button" onClick={() => setSentTo(null)} className="mt-4 text-[13px] text-accent hover:underline">
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface px-6 py-6">
      {message ? <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{message}</p> : null}
      {googleEnabled ? (
        <>
          <button
            type="button"
            onClick={withGoogle}
            disabled={busy !== null}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-medium text-white hover:opacity-95 disabled:opacity-60"
          >
            {busy === "google" ? "Opening Google…" : "Sign in with Google"}
          </button>
          <div className="my-5 flex items-center gap-3 text-[12px] text-faint">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : null}
      <form onSubmit={withEmail} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@paradigmshifters.in"
          className="w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy !== null}
          className="w-full rounded-lg border border-line px-4 py-2.5 font-medium hover:bg-canvas disabled:opacity-60"
        >
          {busy === "email" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
    </div>
  );
}
