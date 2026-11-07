"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { navigateTo } from "@/components/nav-progress";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ButtonLink } from "@/components/form";
import { PersonRow } from "@/components/context-menu";
import { stageLabel } from "@/lib/constants";
import { Search } from "lucide-react";
import { Avatar, Badge, Empty, Table, TableSkeleton } from "@/components/ui";
import { ago, formatDate, formatPhone, formatPqe } from "@/lib/format";

type Hit = {
  candidate_id: string;
  full_name: string;
  current_firm: string | null;
  pqe_today: number | null;
  phones: string[];
  emails: string[];
  linkedin_url: string | null;
  last_called_by: string | null;
  last_called_at: string | null;
  matched_on: "linkedin" | "phone" | "email" | "name" | "firm";
};

const matchLabel: Record<Hit["matched_on"], string> = {
  linkedin: "LinkedIn match",
  phone: "Phone match",
  email: "Email match",
  name: "Name match",
  firm: "Works at",
};

type Pipe = {
  candidate_id: string;
  mandate_id: string;
  stage: string;
  label: string;
};

export function LookupClient() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{
    q: string;
    hits: Hit[];
    error?: string;
  } | null>(null);
  const [pipes, setPipes] = useState<Record<string, Pipe[]>>({});
  const [team, setTeam] = useState<Record<string, string>>({});

  const term = q.trim();
  const active = term.length >= 3;
  const current = active && result?.q === term ? result : null;
  const loading = active && !current;

  useEffect(() => {
    createClient()
      .from("team_members")
      .select("id, full_name")
      .then(
        ({ data }: { data: { id: string; full_name: string }[] | null }) => {
          if (data)
            setTeam(
              Object.fromEntries(
                data.map((m) => [m.id, m.full_name.split(" ")[0]]),
              ),
            );
        },
      );
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("lookup", { q: term });
      if (cancelled) return;
      const hits = (data as Hit[]) ?? [];
      setResult({ q: term, hits, error: error?.message });
      // Open pipelines for the people found, so you see at once if someone is already working them.
      const ids = hits
        .map((h) => h.candidate_id)
        .filter((id) => !(id in pipes));
      if (!ids.length) return;
      const { data: rows } = await supabase
        .from("pipeline_entries")
        .select(
          "candidate_id, mandate_id, stage, mandates(title, clients(display_name))",
        )
        .in("candidate_id", ids)
        .is("exit_reason", null);
      if (cancelled) return;
      const next: Record<string, Pipe[]> = Object.fromEntries(
        ids.map((id) => [id, []]),
      );
      for (const r of rows ?? []) {
        next[r.candidate_id].push({
          candidate_id: r.candidate_id,
          mandate_id: r.mandate_id,
          stage: r.stage,
          label:
            `${r.mandates?.clients?.display_name ?? ""} ${r.mandates?.title ?? ""}`.trim(),
        });
      }
      setPipes((p) => ({ ...p, ...next }));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, active]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-3xl bg-canvas px-5 transition-shadow focus-within:bg-surface focus-within:shadow-[0_0_0_1px_var(--color-line),0_18px_40px_-24px_rgb(29_42_36/0.5)]">
        <Search size={20} className="text-muted" />
        <input
          id="lookup-input"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQ("");
            if (e.key === "Enter" && current?.hits[0])
              navigateTo(router, `/candidates/${current.hits[0].candidate_id}`);
          }}
          placeholder="Paste a LinkedIn URL, phone number, email or name"
          className="h-16 w-full bg-transparent text-[17px] outline-none placeholder:text-faint"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {!active ? (
        <p className="text-muted">
          Phone numbers work in any format:{" "}
          <span className="font-medium text-ink">98xxxxxx01</span>,{" "}
          <span className="font-medium text-ink">+91 98xxx xxx01</span>, or two
          numbers separated by a comma.
        </p>
      ) : loading ? (
        <TableSkeleton rows={3} />
      ) : current?.error ? (
        <Empty title="Search failed">{current.error}</Empty>
      ) : current && current.hits.length === 0 ? (
        <Empty
          title="Not in our database"
          action={
            <ButtonLink
              href={`/candidates/new?q=${encodeURIComponent(term)}`}
              variant="primary"
            >
              Add as a new candidate
            </ButtonLink>
          }
        >
          Safe to pull this number from Weekday. Add them afterwards so nobody
          pulls it again.
        </Empty>
      ) : current ? (
        <Table
          head={[
            "Candidate",
            "Firm",
            "PQE",
            "Phone",
            "Email",
            "Last call",
            "On mandates",
          ]}
        >
          {current.hits.map((h) => (
            <PersonRow
              as="tr"
              key={h.candidate_id}
              person={{
                id: h.candidate_id,
                name: h.full_name,
                phone: h.phones[0],
              }}
            >
              <td>
                <div className="flex items-center gap-3">
                  <Avatar name={h.full_name} size={34} />
                  <div>
                    <Link
                      href={`/candidates/${h.candidate_id}`}
                      className="font-semibold hover:text-accent"
                    >
                      {h.full_name}
                    </Link>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge
                        tone={
                          h.matched_on === "name" || h.matched_on === "firm"
                            ? "neutral"
                            : "ok"
                        }
                      >
                        {matchLabel[h.matched_on]}
                      </Badge>
                      {h.linkedin_url ? (
                        <a
                          href={h.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] text-accent hover:underline"
                        >
                          LinkedIn
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </td>
              <td>{h.current_firm ?? <span className="text-faint">—</span>}</td>
              <td className="whitespace-nowrap">{formatPqe(h.pqe_today)}</td>
              <td className="whitespace-nowrap">
                {h.phones.length ? (
                  h.phones.map((p) => (
                    <div key={p}>
                      <a
                        href={`tel:${p}`}
                        className="text-[13px] tabular-nums hover:text-accent"
                      >
                        {formatPhone(p)}
                      </a>
                    </div>
                  ))
                ) : (
                  <span className="text-faint">No number yet</span>
                )}
              </td>
              <td className="max-w-56 truncate">
                {h.emails[0] ?? <span className="text-faint">—</span>}
              </td>
              <td className="whitespace-nowrap">
                {h.last_called_at ? (
                  <>
                    <div>
                      {team[h.last_called_by ?? ""] ?? "Someone"},{" "}
                      {ago(h.last_called_at)}
                    </div>
                    <div className="text-[12px] text-muted">
                      {formatDate(h.last_called_at)}
                    </div>
                  </>
                ) : (
                  <span className="text-faint">Never called</span>
                )}
              </td>
              <td className="text-[13px]">
                {pipes[h.candidate_id] === undefined ? (
                  <span className="text-faint">…</span>
                ) : pipes[h.candidate_id].length ? (
                  pipes[h.candidate_id].map((p) => (
                    <div key={p.mandate_id}>
                      <Link
                        href={`/mandates/${p.mandate_id}`}
                        className="hover:text-accent"
                      >
                        {p.label}
                      </Link>{" "}
                      <span className="text-muted">
                        · {stageLabel(p.stage)}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-faint">None open</span>
                )}
              </td>
            </PersonRow>
          ))}
        </Table>
      ) : null}
    </div>
  );
}
