import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "@/components/fast-link";
import { ButtonLink } from "@/components/form";
import { Card, Empty, Page, PageHeader, TableSkeleton, Tile, TileRow } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getFirmNames, getPracticeAreas, getTeam } from "@/lib/data/options";
import { cvNotes, pqeFromMonth, type CvExtract } from "@/lib/cv-extract";
import { formatDate, formatPqe } from "@/lib/format";
import { CandidateForm, type CandidateValues } from "../candidate-form";
import { AttachInstead, CvPreview } from "../inbox/widgets";

export const metadata: Metadata = { title: "Add candidate" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export default function NewCandidatePage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHeader title="Add candidate" description="We check phone, email and LinkedIn against everyone we already have before saving." />
      <Page>
        <Suspense fallback={<TableSkeleton rows={4} />}>
          <NewForm searchParams={searchParams} />
        </Suspense>
      </Page>
    </>
  );
}

async function NewForm({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const inbox = one(sp.inbox);
  if (inbox) return <FromInbox id={inbox} />;
  const q = one(sp.q);
  // Prefill from a failed lookup: a URL becomes LinkedIn, digits become a phone, an @ becomes an email, anything else a name.
  const prefill = /linkedin\.com\/in\//i.test(q)
    ? { linkedin_url: q }
    : /^[+\d][\d\s\-()]{7,}$/.test(q)
      ? { phones: q }
      : q.includes("@")
        ? { emails: q }
        : { full_name: q };
  const [practices, firms, team] = await Promise.all([getPracticeAreas(), getFirmNames(), getTeam()]);
  return <CandidateForm values={prefill} practices={practices} firms={firms} team={team.filter((t) => t.active)} />;
}

type Match = { id: string; full_name: string; current_firm: string | null; pqe_today: number | null; on: string[] };

/** Everyone the CV might already belong to: same phone, email or LinkedIn, or a similar name. */
async function findMatches(supabase: Awaited<ReturnType<typeof createClient>>, x: Partial<CvExtract>): Promise<Match[]> {
  const on = new Map<string, Set<string>>();
  const add = (id: string | null | undefined, why: string) => {
    if (!id) return;
    if (!on.has(id)) on.set(id, new Set());
    on.get(id)!.add(why);
  };
  const phones = x.phones?.length ? ((await supabase.rpc("normalize_phones", { raw: x.phones.join(", ") })).data ?? []) : [];
  const slug = x.linkedin_url?.match(/linkedin\.com\/in\/([^/?#\s]+)/i)?.[1]?.toLowerCase();
  const [byPhone, byEmail, byLinkedin, byName] = await Promise.all([
    phones.length ? supabase.from("candidate_phones").select("candidate_id").in("phone", phones) : null,
    x.emails?.length ? supabase.from("candidate_emails").select("candidate_id").in("email", x.emails) : null,
    slug ? supabase.from("candidates").select("id").eq("linkedin_slug", slug) : null,
    x.full_name ? supabase.rpc("lookup", { q: x.full_name, p_limit: 4 }) : null,
  ]);
  byPhone?.data?.forEach((r) => add(r.candidate_id, "same phone"));
  byEmail?.data?.forEach((r) => add(r.candidate_id, "same email"));
  byLinkedin?.data?.forEach((r) => add(r.id, "same LinkedIn"));
  byName?.data?.filter((r) => r.matched_on === "name").forEach((r) => add(r.candidate_id, "similar name"));
  if (!on.size) return [];
  const { data } = await supabase.from("v_candidates").select("id, full_name, current_firm, pqe_today").in("id", [...on.keys()]);
  return (data ?? [])
    .map((c) => ({ id: c.id!, full_name: c.full_name ?? "", current_firm: c.current_firm, pqe_today: c.pqe_today, on: [...on.get(c.id!)!] }))
    .sort((a, b) => Number(b.on.some((w) => w !== "similar name")) - Number(a.on.some((w) => w !== "similar name")));
}

async function FromInbox({ id }: { id: string }) {
  const supabase = await createClient();
  const [{ data: row }, practices, firms, team] = await Promise.all([
    supabase.from("cv_inbox").select("id, file_path, file_name, status, extracted, candidate_id, updated_at").eq("id", id).maybeSingle(),
    getPracticeAreas(),
    getFirmNames(),
    getTeam(),
  ]);
  if (!row || row.status === "discarded")
    return (
      <Empty title="That CV isn't in the inbox" action={<ButtonLink href="/candidates/inbox">Back to the inbox</ButtonLink>}>
        It may have been removed.
      </Empty>
    );
  if (row.status === "saved")
    return (
      <Empty
        title="This CV has already been added"
        action={row.candidate_id ? <ButtonLink href={`/candidates/${row.candidate_id}`} variant="primary">Open the candidate</ButtonLink> : null}
      />
    );

  const x = (row.extracted ?? null) as (Partial<CvExtract> & { read_at?: string }) | null;
  const values: CandidateValues = x
    ? {
        full_name: x.full_name ?? "",
        linkedin_url: x.linkedin_url ?? null,
        current_firm: x.current_firm ?? null,
        designation: x.designation ?? null,
        practice_areas: x.practice_areas ?? [],
        pqe: pqeFromMonth(x.qualified_on ?? null),
        current_city: x.current_city ?? null,
        graduation_year: x.graduation_year ?? null,
        phones: (x.phones ?? []).join(", "),
        emails: (x.emails ?? []).join(", "),
        highlights: (x.highlights ?? []).join("\n"),
        notes: cvNotes({ education: [], work_history: [], ...x } as CvExtract, formatDate(x.read_at ?? row.updated_at)),
        source: "inbound",
      }
    : { source: "inbound" };
  const matches = x ? await findMatches(supabase, x) : [];
  const strong = matches.some((m) => m.on.some((w) => w !== "similar name"));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
      <div className="min-w-0 space-y-5">
        <Card className="bg-accent-soft px-5 py-3.5 text-[13.5px] text-accent">
          {x ? (
            <>
              Read from <b>{row.file_name}</b> by AI. Check each detail against the CV and fix anything it got wrong. Adding the candidate files this CV on their profile.
            </>
          ) : (
            <>
              <b>{row.file_name}</b> couldn&apos;t be read, so fill in the details from the CV. Adding the candidate files this CV on their profile.
            </>
          )}{" "}
          <Link href="/candidates/inbox" className="font-medium underline underline-offset-2">
            Back to the inbox
          </Link>
        </Card>

        {matches.length ? (
          <Tile tone={strong ? "clay" : "sand"} title={strong ? "Already in Covaro" : "Might already be in Covaro"}>
            <p className="mb-2 text-[13px] text-ink/70">
              {strong ? "Add this CV to their profile instead of creating them twice." : "Someone with a similar name is on file. If it's the same person, add the CV to them."}
            </p>
            {matches.map((m) => (
              <TileRow key={m.id} className="flex-wrap justify-between">
                <span className="min-w-0">
                  <Link href={`/candidates/${m.id}`} className="font-medium hover:text-accent">
                    {m.full_name}
                  </Link>
                  <span className="block text-[12.5px] text-muted">
                    {[m.current_firm, m.pqe_today != null ? formatPqe(m.pqe_today) : null, m.on.join(", ")].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <AttachInstead inboxId={row.id} candidateId={m.id} name={m.full_name} variant="outline" />
              </TileRow>
            ))}
          </Tile>
        ) : null}

        <details className="xl:hidden">
          <summary className="cursor-pointer text-[13.5px] font-medium text-accent">Show the CV</summary>
          <div className="mt-3 h-[70vh]">
            <CvPreview path={row.file_path} fileName={row.file_name} />
          </div>
        </details>

        <CandidateForm values={values} practices={practices} firms={firms} team={team.filter((t) => t.active)} inboxId={row.id} />
      </div>
      <aside className="hidden xl:block">
        <div className="sticky top-20 h-[calc(100vh-7rem)]">
          <CvPreview path={row.file_path} fileName={row.file_name} />
        </div>
      </aside>
    </div>
  );
}
