"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

export function LookupClient() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ q: string; hits: Hit[]; error?: string } | null>(null);
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
      const { data, error } = await createClient().rpc("lookup", { q: term });
      if (!cancelled) setResult({ q: term, hits: (data as Hit[]) ?? [], error: error?.message });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, active]);

  return (
    <div className="space-y-5">
      <Card className="p-2">
        <input
          id="lookup-input"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQ("")}
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
          Safe to pull this number from Weekday. Add the candidate afterwards so nobody pulls it again.
        </Empty>
      ) : current ? (
        <Table head={["Candidate", "Firm", "PQE", "Phone", "Email", "Last call"]}>
          {current.hits.map((h) => (
            <tr key={h.candidate_id}>
              <td>
                <div className="font-medium">{h.full_name}</div>
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
            </tr>
          ))}
        </Table>
      ) : null}
    </div>
  );
}
