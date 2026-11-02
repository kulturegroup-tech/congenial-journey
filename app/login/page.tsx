import type { Metadata } from "next";
import { Suspense } from "react";
import { SetupNotice } from "@/components/notices";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <p className="text-[20px] font-semibold tracking-tight">Paradigm Shifters</p>
        <p className="mb-6 text-muted">Recruitment workspace</p>
        <Suspense fallback={<div className="h-64 rounded-xl border border-line bg-surface" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
