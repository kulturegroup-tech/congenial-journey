"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { BriefcaseBusiness, Building2, CalendarDays, IndianRupee, Search, Settings, Sun, Users } from "lucide-react";

const nav = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/lookup", label: "Find someone", icon: Search, hint: "⌘K" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/mandates", label: "Mandates", icon: BriefcaseBusiness },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/billing", label: "Billing", icon: IndianRupee },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ footer, top }: { footer?: ReactNode; top?: ReactNode }) {
  return (
    <aside className="sticky top-0 flex h-screen w-[248px] shrink-0 flex-col border-r border-line bg-side">
      <div className="flex items-center justify-between gap-1 pb-6 pl-5 pr-3 pt-6">
        <Link href="/today" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-accent text-[12px] font-semibold tracking-wide text-white">PS</span>
          <span className="whitespace-nowrap text-[14.5px] font-semibold tracking-[-0.01em]">Paradigm Shifters</span>
        </Link>
        {top}
      </div>
      {/* The current URL is only known at request time on dynamic pages, so the active state streams in. */}
      <Suspense fallback={<NavList pathname="" />}>
        <LiveNav />
      </Suspense>
      <div className="border-t border-line px-4 py-4">{footer}</div>
    </aside>
  );
}

function LiveNav() {
  return <NavList pathname={usePathname()} />;
}

function NavList({ pathname }: { pathname: string }) {
  return (
    <nav className="flex-1 space-y-0.5 px-3">
      {nav.map(({ href, label, icon: Icon, hint }) => {
        const active = pathname === href || pathname.startsWith(href + "/") || (href === "/today" && pathname === "/");
        return (
          <Link
            key={href}
            href={href}
            className={`state flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${active ? "bg-accent-soft font-semibold text-accent" : "font-medium text-muted hover:text-ink"}`}
          >
            <Icon size={17} strokeWidth={active ? 2 : 1.75} />
            {label}
            {hint ? <kbd className="ml-auto font-sans text-[11px] font-normal text-faint">{hint}</kbd> : null}
          </Link>
        );
      })}
    </nav>
  );
}
