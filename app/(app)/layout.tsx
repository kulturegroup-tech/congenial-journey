import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { BellMenu } from "@/components/bell";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { NotOnTeam, SetupNotice } from "@/components/notices";
import { TableSkeleton } from "@/components/ui";
import { getSession } from "@/lib/auth/member";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// The shell (sidebar) is static and loads instantly; anything that reads the session
// streams in behind a Suspense boundary, as Cache Components requires.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar
        top={
          <Suspense fallback={null}>
            <Bell />
          </Suspense>
        }
        footer={
          <Suspense fallback={<div className="h-9" />}>
            <UserMenu />
          </Suspense>
        }
      />
      <main className="min-w-0 flex-1">
        <Suspense fallback={<div className="p-8"><TableSkeleton /></div>}>
          <TeamGate>{children}</TeamGate>
        </Suspense>
      </main>
    </div>
  );
}

async function TeamGate({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured) return <SetupNotice />;
  const session = await getSession();
  if (session.state === "signed_out") redirect("/login");
  if (session.state === "not_on_team") return <NotOnTeam email={session.email} />;
  return <>{children}</>;
}

async function UserMenu() {
  if (!isSupabaseConfigured) return null;
  const session = await getSession();
  if (session.state !== "member") return <SignOutButton />;
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate font-medium">{session.member.full_name}</p>
        <p className="text-[12px] text-muted">{session.member.is_admin ? "Admin" : "Recruiter"}</p>
      </div>
      <SignOutButton />
    </div>
  );
}

async function Bell() {
  if (!isSupabaseConfigured) return null;
  const session = await getSession();
  if (session.state !== "member") return null;
  const supabase = await createClient();
  const [{ data }, { count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, title, body, mandate_id, candidate_id, read_at, created_at")
      .eq("recipient_id", session.member.id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", session.member.id).is("read_at", null),
  ]);
  return <BellMenu notes={data ?? []} unread={count ?? 0} />;
}
