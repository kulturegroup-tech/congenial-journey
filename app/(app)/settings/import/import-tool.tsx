"use client";

import Link from "@/components/fast-link";
import { useMemo, useState } from "react";
import { Button, Field, Input, Select } from "@/components/form";
import { Card } from "@/components/ui";
import { parseCsv } from "@/lib/csv";
import { finishImport, runImport, type ImportResult, type ImportRow } from "./actions";

type Target = "name" | "linkedin" | "phone" | "email" | "firm" | "pqe" | "stage" | "recruiter" | "comments" | "position";

const targets: { key: Target; label: string; guess: RegExp }[] = [
  { key: "name", label: "Name *", guess: /^(applicant'?s name|name|candidate|candidate name|full name)$/i },
  { key: "linkedin", label: "LinkedIn", guess: /linkedin/i },
  { key: "phone", label: "Phone", guess: /phone|contact number|mobile|contact no/i },
  { key: "email", label: "Email", guess: /e-?mail/i },
  { key: "firm", label: "Current firm", guess: /^(firm|firm name|current firm|company|organisation|organization)$/i },
  { key: "pqe", label: "PQE", guess: /^pqe|experience/i },
  { key: "stage", label: "Stage / status", guess: /^(stage|status|interested)$/i },
  { key: "recruiter", label: "Recruiter", guess: /recruiter|owner/i },
  { key: "comments", label: "Comments", guess: /comment|remark|note/i },
  { key: "position", label: "Job position (Odoo)", guess: /job position|position|role/i },
];

type Opt = { id: string; label: string };
type Sheet = { name: string; rows: string[][] };

/**
 * Every tab of an Excel workbook as rows of text, exactly as the cells show (so a PQE typed
 * "5.10" stays "5.10", and dates read as they're written). Loaded only when an Excel file is picked.
 */
/** A cell as the sheet means it: a linked cell gives its link, a date reads 2026-11-02, a number keeps its decimals. */
function cellText(cell: { value: unknown; numFmt?: string; text?: string }): string {
  let v = cell.value;
  if (v && typeof v === "object" && "result" in v) v = (v as { result: unknown }).result; // a formula: its answer
  if (v && typeof v === "object" && "hyperlink" in v) {
    const link = String((v as { hyperlink?: unknown }).hyperlink ?? "").replace(/^mailto:/i, "").trim();
    if (link) return link; // "profile" linking to LinkedIn → the LinkedIn address
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const places = /0\.(0+)/.exec(cell.numFmt ?? "")?.[1].length; // PQE shown as 5.10 stays 5.10, not 5.1
    return places ? v.toFixed(places) : String(v);
  }
  return String(cell.text ?? "").trim();
}

async function readWorkbook(file: File): Promise<Sheet[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  return wb.worksheets
    .map((ws) => {
      const rows: string[][] = [];
      ws.eachRow({ includeEmpty: false }, (row) => {
        const cells: string[] = [];
        for (let c = 1; c <= ws.columnCount; c++) cells.push(cellText(row.getCell(c)));
        if (cells.some(Boolean)) rows.push(cells);
      });
      return { name: ws.name, rows };
    })
    .filter((s) => s.rows.length > 1);
}

export function ImportTool({ mandates }: { mandates: Opt[] }) {
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<Target, string>>({} as Record<Target, string>);
  const [mandateAll, setMandateAll] = useState("");
  const [byPosition, setByPosition] = useState<Record<string, string>>({});
  const [batch, setBatch] = useState("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(file: File) {
    setResults(null);
    setError(null);
    setHeaders([]);
    setSheets([]);
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext === "xls") return setError("That's the old Excel format. Open it in Excel and save as .xlsx (or CSV), then pick it again.");
    if (ext === "xlsx") {
      let book: Sheet[];
      try {
        book = await readWorkbook(file);
      } catch {
        return setError("Couldn't read that Excel file. Save it again as .xlsx (or CSV) and try once more.");
      }
      if (!book.length) return setError("That workbook has no tabs with rows in it.");
      setSheets(book);
      setFileName(file.name);
      return openTable(book[0].rows, file.name, book[0].name);
    }
    const all = parseCsv(await file.text());
    if (all.length < 2) return setError("That file has no rows. Export the sheet tab (or the Odoo list) as CSV or Excel and try again.");
    setFileName(file.name);
    openTable(all, file.name);
  }

  /** Take one table (a CSV, or one Excel tab): first row is the column names. */
  function openTable(all: string[][], name: string, tab?: string) {
    setSheetName(tab ?? "");
    const h = all[0].map((x) => x.trim());
    setHeaders(h);
    setRows(all.slice(1));
    const m = {} as Record<Target, string>;
    for (const t of targets) m[t.key] = h.find((x) => t.guess.test(x)) ?? "";
    setMap(m);
    const odoo = h.some((x) => /applicant'?s name|job position/i.test(x));
    setBatch(`${odoo ? "odoo" : "sheet"}:${name.replace(/\.(csv|xlsx)$/i, "")}${tab ? ` / ${tab}` : ""}`);
    setByPosition({});
    setMandateAll("");
  }

  const col = (t: Target) => (map[t] ? headers.indexOf(map[t]) : -1);
  const valueOf = (r: string[], t: Target) => {
    const i = col(t);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };
  const positions = useMemo(() => {
    const i = map.position ? headers.indexOf(map.position) : -1;
    if (i < 0) return [];
    const counts = new Map<string, number>();
    for (const r of rows) {
      const v = (r[i] ?? "").trim();
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows, headers, map.position]);

  const build = (): ImportRow[] =>
    rows.map((r, i) => {
      const data: Record<string, string> = {};
      for (const t of targets) if (t.key !== "position") data[t.key] = valueOf(r, t.key);
      const pos = valueOf(r, "position");
      const mandate = positions.length ? byPosition[pos] || null : mandateAll || null;
      return { n: i + 2, data, mandate_id: mandate };
    });

  async function start() {
    if (!map.name) return setError("Pick which column has the name.");
    setError(null);
    setRunning(true);
    setDone(0);
    const all = build();
    const out: ImportResult[] = [];
    for (let i = 0; i < all.length; i += 40) {
      const r = await runImport(batch, all.slice(i, i + 40));
      if (r.error) {
        setError(`Stopped at row ${all[i].n}: ${r.error}`);
        break;
      }
      out.push(...(r.results ?? []));
      setDone(Math.min(i + 40, all.length));
    }
    setResults(out);
    setRunning(false);
    await finishImport();
  }

  const count = (s: ImportResult["status"]) => results?.filter((r) => r.status === s).length ?? 0;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <p className="mb-3 text-[13px] text-muted">
          Pick an <b>Excel (.xlsx)</b> or <b>CSV</b> file: the Odoo list, a Google Sheet (File → Download), or any candidate list. The file is read in your browser; rows are
          sent straight to the database. Rows are matched on LinkedIn, phone and email, so someone you already have isn&apos;t added twice.
        </p>
        <input
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => e.target.files?.[0] && load(e.target.files[0])}
          className="text-[13px]"
        />
        {sheets.length > 1 ? (
          <div className="mt-3 max-w-md">
            <Field label="Which tab?" hint="Import one tab at a time; a tab is usually one role.">
              <Select
                value={sheetName}
                onChange={(e) => {
                  const s = sheets.find((x) => x.name === e.target.value);
                  if (s) openTable(s.rows, fileName, s.name);
                }}
              >
                {sheets.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.rows.length - 1} rows)
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}
        {error ? <p className="mt-3 rounded-2xl bg-danger-soft px-4 py-2.5 text-[13px] text-danger">{error}</p> : null}
      </Card>

      {headers.length ? (
        <>
          <Card className="p-5">
            <h3 className="mb-1.5 text-[15.5px] font-semibold">
              {fileName}
              {sheetName ? ` · ${sheetName}` : ""}: {rows.length} rows
            </h3>
            <p className="mb-3 text-[13px] text-muted">Check which column is which. Leave a field blank if the file doesn&apos;t have it.</p>
            <div className="grid gap-3 md:grid-cols-5">
              {targets.map((t) => (
                <Field key={t.key} label={t.label}>
                  <Select value={map[t.key] ?? ""} onChange={(e) => setMap({ ...map, [t.key]: e.target.value })}>
                    <option value="">—</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
            <div className="mt-4 max-w-md">
              <Field label="Batch name" hint="Shown on the review list so you know where a row came from.">
                <Input value={batch} onChange={(e) => setBatch(e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-1.5 text-[15.5px] font-semibold">Which mandate?</h3>
            {positions.length ? (
              <>
                <p className="mb-3 text-[13px] text-muted">
                  Each job position becomes a pipeline on the mandate you pick. Rows left on “Don&apos;t add” are imported as candidates only.{" "}
                  <Link href="/mandates/new" target="_blank" className="text-accent underline">
                    Create a mandate
                  </Link>{" "}
                  in a new tab if it isn&apos;t listed, then reload this page.
                </p>
                <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-2">
                  {positions.map(([p, n]) => (
                    <div key={p} className="grid grid-cols-[1fr_320px] items-center gap-3 text-[13px]">
                      <span className="truncate" title={p}>
                        {p} <span className="text-faint">({n})</span>
                      </span>
                      <Select value={byPosition[p] ?? ""} onChange={(e) => setByPosition({ ...byPosition, [p]: e.target.value })}>
                        <option value="">Don&apos;t add to a mandate</option>
                        {mandates.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="max-w-xl">
                <p className="mb-3 text-[13px] text-muted">A sheet tab is usually one role. Pick its mandate and every row lands on that pipeline at the stage in its status column.</p>
                <Select value={mandateAll} onChange={(e) => setMandateAll(e.target.value)}>
                  <option value="">Don&apos;t add to a mandate (candidates only)</option>
                  {mandates.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </Card>

          <Card className="overflow-x-auto p-5">
            <h3 className="mb-2.5 text-[15.5px] font-semibold">Preview</h3>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-muted">
                  {targets
                    .filter((t) => map[t.key])
                    .map((t) => (
                      <th key={t.key} className="py-1 pr-3 font-medium">
                        {t.label.replace(" *", "")}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    {targets
                      .filter((t) => map[t.key])
                      .map((t) => (
                        <td key={t.key} className="max-w-48 truncate py-1 pr-3">
                          {valueOf(r, t.key)}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="flex items-center gap-3">
            <Button variant="primary" disabled={running || !map.name} onClick={start}>
              {running ? `Importing… ${done} of ${rows.length}` : `Import ${rows.length} rows`}
            </Button>
            {running ? (
              <div className="h-2 w-64 overflow-hidden rounded-full bg-line">
                <div className="h-full bg-accent transition-all" style={{ width: `${(done / rows.length) * 100}%` }} />
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {results ? (
        <Card className="p-5">
          <h3 className="mb-2.5 text-[15.5px] font-semibold">Done</h3>
          <p className="text-[13px]">
            <b>{count("imported")}</b> new · <b>{count("merged")}</b> matched to someone we had · <b className="text-warn">{count("needs_review")}</b> to review ·{" "}
            <b>{count("skipped")}</b> skipped (no name)
          </p>
          {count("needs_review") ? <p className="mt-1 text-[13px] text-muted">The review list below has what needs a look.</p> : null}
        </Card>
      ) : null}
    </div>
  );
}
