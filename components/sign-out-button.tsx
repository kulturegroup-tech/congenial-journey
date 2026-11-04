"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ variant = "link" }: { variant?: "link" | "button" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const style =
    variant === "button"
      ? "state rounded-full px-4 py-2 font-medium ring-1 ring-inset ring-line"
      : "text-[13px] text-muted hover:text-ink";

  return (
    <button type="button" onClick={signOut} disabled={busy} className={`${style} disabled:opacity-50`}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
