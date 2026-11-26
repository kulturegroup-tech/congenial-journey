"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, UploadCloud } from "lucide-react";
import { Button } from "@/components/form";
import { useToast } from "@/components/toast";
import { navigateTo } from "@/components/nav-progress";
import { createClient } from "@/lib/supabase/client";
import { addToInbox, attachInboxCv, discardInboxCv, restoreInboxCv } from "./actions";

const MAX_BYTES = 10 * 1024 * 1024;
const AT_ONCE = 3; // CVs read side by side; more only hits the Claude account's rate limit

/** Runs fn over items, n at a time. */
async function pool<T>(items: T[], n: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}

async function readOne(id: string): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await fetch("/api/cv-inbox/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.redirected) return { error: "You're signed out. Sign in again, then press Read." };
    const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !j?.ok) return { error: j?.error ?? `Couldn't read it (error ${res.status}).` };
    return { ok: true };
  } catch {
    return { error: "Couldn't reach the server. Check the internet and try again." };
  }
}

/** Refreshes the list at most once a second while CVs finish reading. */
function useCalmRefresh() {
  const router = useRouter();
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return () => {
    const wait = Math.max(0, 1000 - (Date.now() - last.current));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      last.current = Date.now();
      router.refresh();
    }, wait);
  };
}

type Item = { key: string; name: string; state: "waiting" | "uploading" | "reading" | "done" | "failed" | "skipped"; note?: string };

const stateText: Record<Item["state"], string> = {
  waiting: "Waiting",
  uploading: "Uploading…",
  reading: "Reading…",
  done: "Read",
  failed: "Couldn't read",
  skipped: "Not added",
};

/** Drop one CV or fifty. Each is uploaded, put in the inbox and read, a few at a time. */
export function InboxUploader() {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const busy = items.some((i) => i.state === "waiting" || i.state === "uploading" || i.state === "reading");
  const refresh = useCalmRefresh();

  const set = (key: string, patch: Partial<Item>) => setItems((all) => all.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  async function take(files: File[]) {
    if (!files.length) return;
    const batch = files.map((f) => {
      const ext = f.name.toLowerCase().split(".").pop() ?? "";
      const key = crypto.randomUUID();
      const item: Item =
        ext === "doc"
          ? { key, name: f.name, state: "skipped", note: "Old Word file: save it as PDF or .docx first" }
          : ext !== "pdf" && ext !== "docx"
            ? { key, name: f.name, state: "skipped", note: "Only PDF and Word (.docx)" }
            : f.size > MAX_BYTES
              ? { key, name: f.name, state: "skipped", note: "Over 10 MB" }
              : { key, name: f.name, state: "waiting" };
      return { file: f, ext, item };
    });
    setItems((all) => [...batch.map((b) => b.item), ...all]);

    // 1. Upload straight to private storage (files never pass through the app server).
    const uploaded: { key: string; path: string; name: string; mime: string | null }[] = [];
    const storage = createClient().storage.from("candidate-files");
    await pool(
      batch.filter((b) => b.item.state === "waiting"),
      AT_ONCE,
      async (b) => {
        set(b.item.key, { state: "uploading" });
        const path = `inbox/${crypto.randomUUID()}.${b.ext}`;
        const { error } = await storage.upload(path, b.file, { contentType: b.file.type || undefined });
        if (error) set(b.item.key, { state: "failed", note: "Upload failed. Check the internet and try again." });
        else {
          uploaded.push({ key: b.item.key, path, name: b.file.name, mime: b.file.type || null });
          set(b.item.key, { state: "waiting", note: undefined });
        }
      },
    );
    if (!uploaded.length) return;

    // 2. Into the inbox, so nothing is lost if this page is closed before they're all read.
    const added = await addToInbox(uploaded.map(({ path, name, mime }) => ({ path, name, mime })));
    if (added.error || !added.ids) {
      uploaded.forEach((u) => set(u.key, { state: "failed", note: added.error ?? "Couldn't add to the inbox." }));
      return;
    }
    refresh();

    // 3. Read, a few at a time. The list below fills in as each finishes.
    await pool(uploaded, AT_ONCE, async (u, i) => {
      const id = added.ids![i];
      if (!id) return set(u.key, { state: "failed", note: "Only PDF and Word files can be added." });
      set(u.key, { state: "reading" });
      const r = await readOne(id);
      set(u.key, r.ok ? { state: "done" } : { state: "failed", note: r.error });
      refresh();
    });
  }

  const done = items.filter((i) => i.state === "done").length;
  const failed = items.filter((i) => i.state === "failed").length;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(Array.from(e.dataTransfer.files));
        }}
        className={`flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-8 py-10 text-center transition-colors ${over ? "border-accent bg-accent-soft/60" : "border-line bg-side/50"}`}
      >
        <UploadCloud size={28} strokeWidth={1.6} className="text-accent" />
        <div>
          <p className="text-[15px] font-medium">Drop CVs here</p>
          <p className="mt-0.5 text-[13px] text-muted">PDF or Word (.docx), up to 10 MB each. One or many at once.</p>
        </div>
        <input
          ref={input}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            take(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <Button variant="primary" onClick={() => input.current?.click()}>
          Choose files
        </Button>
      </div>

      {items.length ? (
        <div className="rounded-3xl bg-surface p-4 ring-1 ring-line">
          <p className="mb-2 text-[13px] text-muted">
            {busy ? `Working on ${items.length} file${items.length === 1 ? "" : "s"}. You can keep using Covaro in another tab.` : `${done} read${failed ? `, ${failed} couldn't be read` : ""}. Review each one below.`}
          </p>
          <ul className="max-h-56 space-y-1 overflow-y-auto text-[13px]">
            {items.map((i) => (
              <li key={i.key} className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <FileText size={14} className="shrink-0 text-faint" />
                  <span className="truncate">{i.name}</span>
                </span>
                <span className={`shrink-0 text-right ${i.state === "failed" || i.state === "skipped" ? "text-danger" : i.state === "done" ? "text-ok" : "text-muted"}`}>
                  {stateText[i.state]}
                  {i.note ? <span className="block text-[12px]">{i.note}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Read (or read again) CVs already in the inbox. */
export function ReadButton({ ids, label = "Read", variant = "outline" }: { ids: string[]; label?: string; variant?: "outline" | "secondary" | "ghost" }) {
  const [progress, setProgress] = useState<string | null>(null);
  const toast = useToast();
  const refresh = useCalmRefresh();
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={!!progress || !ids.length}
      onClick={async () => {
        let n = 0;
        let lastError: string | undefined;
        setProgress(ids.length > 1 ? `Reading 0 of ${ids.length}…` : "Reading…");
        await pool(ids, AT_ONCE, async (id) => {
          const r = await readOne(id);
          if (r.error) lastError = r.error;
          n++;
          if (ids.length > 1) setProgress(`Reading ${n} of ${ids.length}…`);
          refresh();
        });
        setProgress(null);
        if (lastError) toast({ message: ids.length > 1 ? `Some couldn't be read: ${lastError}` : lastError });
      }}
    >
      {progress ?? label}
    </Button>
  );
}

export function DiscardButton({ id, name }: { id: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await discardInboxCv(id);
        setBusy(false);
        if (r.error) return toast({ message: r.error });
        toast({
          message: `Removed ${name} from the inbox.`,
          action: {
            label: "Undo",
            onClick: async () => {
              const u = await restoreInboxCv(id);
              if (u.error) toast({ message: u.error });
            },
          },
        });
      }}
    >
      {busy ? "Removing…" : "Remove"}
    </Button>
  );
}

/** The CV is someone we already have: file it on their profile instead of creating a new person. */
export function AttachInstead({ inboxId, candidateId, name, variant = "secondary" }: { inboxId: string; candidateId: string; name?: string | null; variant?: "secondary" | "outline" }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant={variant}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          const r = await attachInboxCv(inboxId, candidateId);
          if (r.error) {
            setErr(r.error);
            setBusy(false);
            return;
          }
          navigateTo(router, `/candidates/${candidateId}`);
        }}
      >
        {busy ? "Attaching…" : name ? `Add this CV to ${name.split(" ")[0]}` : "Add this CV to them instead"}
      </Button>
      {err ? <span className="text-[12px] text-danger">{err}</span> : null}
    </span>
  );
}

/** The CV itself beside the form, so every detail can be checked against it. */
export function CvPreview({ path, fileName }: { path: string; fileName: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isPdf = /\.pdf$/i.test(fileName);

  useEffect(() => {
    let objectUrl: string | null = null;
    let live = true;
    createClient()
      .storage.from("candidate-files")
      .download(path)
      .then(({ data, error }) => {
        if (!live) return;
        if (error || !data) return setErr("Couldn't open the CV.");
        objectUrl = URL.createObjectURL(isPdf ? new Blob([data], { type: "application/pdf" }) : data);
        setUrl(objectUrl);
      });
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, isPdf]);

  if (err) return <p className="text-[13px] text-danger">{err}</p>;
  if (!url) return <div className="h-full min-h-[24rem] animate-pulse rounded-2xl bg-line/50" />;
  if (isPdf) return <iframe src={url} title={`CV: ${fileName}`} className="h-full min-h-[24rem] w-full rounded-2xl bg-white" />;
  return (
    <div className="space-y-2 text-[13px]">
      <p className="text-muted">Word files can&apos;t be shown here.</p>
      <a href={url} download={fileName} className="font-medium text-accent underline underline-offset-2">
        Download {fileName}
      </a>
    </div>
  );
}
