"use client";

import { useRouter } from "next/navigation";
import { navigateTo } from "@/components/nav-progress";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, BriefcaseBusiness, Building2, CalendarDays, FileUp, IndianRupee, PhoneCall, Search, Settings, Sun, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ago, formatPhone, formatPqe } from "@/lib/format";
import { Avatar } from "./ui";

type Person = { candidate_id: string; full_name: string; current_firm: string | null; pqe_today: number | null; phones: string[]; last_called_by: string | null; last_called_at: string | null };
type Action = { label: string; href?: string; event?: string; icon: ReactNode; words?: string };

const actions: Action[] = [
  { label: "Log a call", event: "ps:log-call", icon: <PhoneCall size={16} />, words: "call notes screening" },
  { label: "Add a candidate", href: "/candidates/new", icon: <UserPlus size={16} />, words: "new person create" },
  { label: "New mandate", href: "/mandates/new", icon: <BriefcaseBusiness size={16} />, words: "role job opening create" },
  { label: "Add a client", href: "/clients/new", icon: <Building2 size={16} />, words: "firm new create" },
  { label: "Today", href: "/today", icon: <Sun size={16} />, words: "home dashboard" },
  { label: "Calendar", href: "/calendar", icon: <CalendarDays size={16} />, words: "week schedule interviews" },
  { label: "Mandates", href: "/mandates", icon: <BriefcaseBusiness size={16} /> },
  { label: "Candidates", href: "/candidates", icon: <Users size={16} />, words: "people" },
  { label: "Clients", href: "/clients", icon: <Building2 size={16} /> },
  { label: "Billing", href: "/billing", icon: <IndianRupee size={16} />, words: "invoices payments placements money" },
  { label: "Import from Odoo or sheets", href: "/settings/import", icon: <FileUp size={16} />, words: "csv upload" },
  { label: "Settings", href: "/settings", icon: <Settings size={16} />, words: "team pin" },
];

/** ⌘K: one box for everything. Type a person to open them, or a thing to do. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<{ q: string; rows: Person[] } | null>(null);
  const [team, setTeam] = useState<Record<string, string>>({});
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const ev = () => setOpen(true);
    window.addEventListener("keydown", key);
    window.addEventListener("ps:palette", ev);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("ps:palette", ev);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => input.current?.focus(), 10);
    if (!Object.keys(team).length)
      createClient()
        .from("team_members")
        .select("id, full_name")
        .then(({ data }: { data: { id: string; full_name: string }[] | null }) => data && setTeam(Object.fromEntries(data.map((m) => [m.id, m.full_name.split(" ")[0]]))));
  }, [open, team]);

  const term = q.trim();
  useEffect(() => {
    if (term.length < 3) return;
    let live = true;
    const t = setTimeout(async () => {
      const { data } = await createClient().rpc("lookup", { q: term, p_limit: 6 });
      if (live) setPeople({ q: term, rows: (data as Person[]) ?? [] });
    }, 180);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [term]);

  const rows = term.length >= 3 && people?.q === term ? people.rows : [];
  const acts = useMemo(() => {
    const t = term.toLowerCase();
    return t ? actions.filter((a) => `${a.label} ${a.words ?? ""}`.toLowerCase().includes(t)).slice(0, 5) : actions.slice(0, 6);
  }, [term]);
  const addNew = term.length >= 3 && people?.q === term && rows.length === 0;
  const items: { key: string; go: () => void; node: ReactNode }[] = [
    ...rows.map((p) => ({
      key: p.candidate_id,
      go: () => navigateTo(router, `/candidates/${p.candidate_id}`),
      node: (
        <>
          <Avatar name={p.full_name} size={32} />
          <span className="min-w-0 flex-1">
            <b className="font-semibold">{p.full_name}</b>
            <span className="block truncate text-[12.5px] text-muted">
              {[p.current_firm, p.pqe_today != null ? formatPqe(p.pqe_today) : null, p.phones[0] ? formatPhone(p.phones[0]) : null].filter(Boolean).join(" · ")}
            </span>
          </span>
          <span className="text-right text-[12px] text-muted">{p.last_called_at ? `${team[p.last_called_by ?? ""] ?? "Someone"} called ${ago(p.last_called_at)}` : "Never called"}</span>
        </>
      ),
    })),
    ...(addNew
      ? [
          {
            key: "new",
            go: () => navigateTo(router, `/candidates/new?q=${encodeURIComponent(term)}`),
            node: (
              <>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-accent">
                  <UserPlus size={16} />
                </span>
                <span className="flex-1">
                  Not in our database. <b className="font-semibold">Add “{term}” as a new candidate</b>
                </span>
              </>
            ),
          },
        ]
      : []),
    ...acts.map((a) => ({
      key: a.label,
      go: () => (a.event ? window.dispatchEvent(new Event(a.event)) : navigateTo(router, a.href!)),
      node: (
        <>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-side text-ink/80">{a.icon}</span>
          <span className="flex-1 font-medium">{a.label}</span>
          <ArrowUpRight size={15} className="text-faint" />
        </>
      ),
    })),
  ];
  const active = Math.min(sel, Math.max(items.length - 1, 0));

  if (!open) return null;
  const close = () => {
    setOpen(false);
    setQ("");
    setSel(0);
  };
  return (
    <div className="no-print fixed inset-0 z-[80] flex items-start justify-center bg-ink/25 px-4 pt-[12vh]" onMouseDown={close}>
      <div className="pop w-full max-w-2xl overflow-hidden rounded-3xl bg-surface shadow-[0_30px_80px_-24px_rgb(29_42_36/0.55)]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-5">
          <Search size={18} className="text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, items.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              }
              if (e.key === "Enter" && items[active]) {
                items[active].go();
                close();
              }
            }}
            placeholder="Find a person, or type what you want to do"
            className="h-16 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="rounded-md bg-side px-1.5 py-0.5 font-sans text-[11px] text-muted">esc</kbd>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto p-2">
          {term.length >= 3 && people?.q !== term ? <li className="px-4 py-3 text-[13px] text-muted">Looking…</li> : null}
          {items.map((it, i) => (
            <li key={it.key}>
              <button
                type="button"
                onMouseEnter={() => setSel(i)}
                onClick={() => {
                  it.go();
                  close();
                }}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${i === active ? "bg-accent-soft" : ""}`}
              >
                {it.node}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function openPalette() {
  window.dispatchEvent(new Event("ps:palette"));
}
