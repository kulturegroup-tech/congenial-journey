"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ButtonLink } from "@/components/form";
import { stageLabel } from "@/lib/constants";
import { Badge, Card, Empty, Table, TableSkeleton } from "@/components/ui";
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

type Pipe = { candidate_id: string; mandate_id: string; stage: string; label: string };

export function LookupClient() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ q: string; hits: Hit[]; error?: string } | null>(null);
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
      .then(({ data }: { data: { id: string; full_name: string }[] | null }) => {
        if (data) setTeam(Object.fromEntries(data.map((m) => [m.id, m.full_name.split(" ")[0]])));
      });
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
      const ids = hits.map((h) => h.candidate_id).filter((id) => !(id in pipes));
      if (!ids.length) return;
      const { data: rows } = await supabase
        .from("pipeline_entries")
        .select("candidate_id, mandate_id, stage, mandates(title, clients(display_name))")
        .in("candidate_id", ids)
        .is("exit_reason", null);
      if (cancelled) return;
      const next: Record<string, Pipe[]> = Object.fromEntries(ids.map((id) => [id, []]));
      for (const r of rows ?? []) {
        next[r.candidate_id].push({
          candidate_id: r.candidate_id,
          mandate_id: r.mandate_id,
          stage: r.stage,
          label: `${r.mandates?.clients?.display_name ?? ""} ${r.mandates?.title ?? ""}`.trim(),
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
      <Card className="p-2">
        <input
          id="lookup-input"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQ("");
            if (e.key === "Enter" && current?.hits[0]) router.push(`/candidates/${current.hits[0].candidate_id}`);
          }}
          placeholder="Paste a LinkedIn URL, phone number, email or name"
          className="w-full rounded-lg px-4 py-3.5 text-[17px] outline-none placeholder:text-faint"
          autoComplete="off"
          spellCheck={false}
        />
      </Card>

      {!active ? (
        <p className="text-muted">
          Phone numbers work in any format: <span className="font-mono text-[13px]">98xxxxxx01</span>,{" "}
          <span className="font-mono text-[13px]">+91 98xxx xxx01</span>, or two numbers separated by a comma.
        </p>
      ) : loading ? (
        <TableSkeleton rows={3} />
      ) : current?.error ? (
        <Empty title="Lookup failed">{current.error}</Empty>
      ) : current && current.hits.length === 0 ? (
        <Empty title="Not in our database">
          <p>Safe to pull this number from Weekday. Add the candidate afterwards so nobody pulls it again.</p>
          <div className="mt-4">
            <ButtonLink href={`/candidates/new?q=${encodeURIComponent(term)}`} variant="primary">
              Add as new candidate
            </ButtonLink>
          </div>
        </Empty>
      ) : current ? (
        <Table head={["Candidate", "Firm", "PQE", "Phone", "Email", "Last call", "On mandates"]}>
          {current.hits.map((h) => (
            <tr key={h.candidate_id}>
              <td>
                <Link href={`/candidates/${h.candidate_id}`} className="font-medium hover:text-accent">
                  {h.full_name}
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone={h.matched_on === "name" || h.matched_on === "firm" ? "neutral" : "ok"}>
                    {matchLabel[h.matched_on]}
                  </Badge>
                  {h.linkedin_url ? (
                    <a href={h.linkedin_url} target="_blank" rel="noreferrer" className="text-[12px] text-accent hover:underline">
                      LinkedIn ↗
                    </a>
                  ) : null}
                </div>
              </td>
              <td>{h.current_firm ?? <span className="text-faint">—</span>}</td>
              <td className="whitespace-nowrap">{formatPqe(h.pqe_today)}</td>
              <td className="whitespace-nowrap">
                {h.phones.length ? (
                  h.phones.map((p) => (
                    <div key={p}>
                      <a href={`tel:${p}`} className="font-mono text-[13px] hover:text-accent">
                        {formatPhone(p)}
                      </a>
                    </div>
                  ))
                ) : (
                  <span className="text-faint">No number yet</span>
                )}
              </td>
              <td className="max-w-56 truncate">{h.emails[0] ?? <span className="text-faint">—</span>}</td>
              <td className="whitespace-nowrap">
                {h.last_called_at ? (
                  <>
                    <div>{team[h.last_called_by ?? ""] ?? "Someone"}, {ago(h.last_called_at)}</div>
                    <div className="text-[12px] text-muted">{formatDate(h.last_called_at)}</div>
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
                      <Link href={`/mandates/${p.mandate_id}`} className="hover:text-accent">
                        {p.label}
                      </Link>{" "}
                      <span className="text-muted">· {stageLabel(p.stage)}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-faint">None open</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      ) : null}
    </div>
  );
}
