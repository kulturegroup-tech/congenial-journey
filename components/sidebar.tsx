"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";

const nav = [
  { href: "/lookup", label: "Lookup", hint: "⌘K" },
  { href: "/mandates", label: "Mandates" },
  { href: "/candidates", label: "Candidates" },
  { href: "/clients", label: "Clients" },
  { href: "/billing", label: "Billing" },
  { href: "/reminders", label: "Reminders" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar({ footer, top }: { footer?: ReactNode; top?: ReactNode }) {
  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-start justify-between gap-2 px-5 pb-6 pt-6">
        <div>
          <p className="text-[15px] font-semibold tracking-tight">Paradigm Shifters</p>
          <p className="text-[12px] text-muted">Recruitment workspace</p>
        </div>
        {top}
      </div>
      {/* The current URL is only known at request time on dynamic pages, so the active state streams in. */}
      <Suspense fallback={<NavList pathname="" />}>
        <LiveNav />
      </Suspense>
      <div className="border-t border-line px-5 py-4">{footer}</div>
    </aside>
  );
}

function LiveNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Cmd/Ctrl+K jumps to Lookup from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (pathname === "/lookup") document.getElementById("lookup-input")?.focus();
        else router.push("/lookup");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  return <NavList pathname={pathname} />;
}

function NavList({ pathname }: { pathname: string }) {
  return (
    <nav className="flex-1 space-y-0.5 px-3">
      {nav.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-between rounded-lg px-3 py-2 ${
              active ? "bg-accent-soft font-medium text-accent" : "text-ink hover:bg-canvas"
            }`}
          >
            {item.label}
            {item.hint ? <span className="text-[11px] text-faint">{item.hint}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
