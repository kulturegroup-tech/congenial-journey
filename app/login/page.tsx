import type { Metadata } from "next";
import { Suspense } from "react";
import { SetupNotice } from "@/components/notices";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-hero p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-sage text-[13px] font-semibold text-hero">PS</span>
          <span className="text-[16px] font-semibold">Paradigm Shifters</span>
        </div>
        <div>
          <p className="max-w-md font-display text-[56px] leading-[1.02]">Every lawyer you&apos;ve spoken to, ready when the right mandate opens.</p>
          <p className="mt-5 max-w-sm text-[15px] text-white/65">Calls, mandates, CV shares, invoices and suggestions, in one place for the team.</p>
        </div>
        <p className="text-[12.5px] text-white/45">Navi Mumbai</p>
      </section>
      <section className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-[40px] leading-none">Sign in</h1>
          <p className="mb-8 mt-2 text-muted">Use the email and PIN Khyati set up for you.</p>
          <Suspense fallback={<div className="h-64 rounded-3xl bg-side" />}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
