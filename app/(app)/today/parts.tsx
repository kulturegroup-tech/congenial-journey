"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { MessageCircle, Phone, Plus, Search, StickyNote } from "lucide-react";
import { Button } from "@/components/form";
import { openPalette } from "@/components/command-palette";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";
import { addCandidates, dismissSuggestions, undoAdds } from "../mandates/actions";
import { undoMessage } from "../mandates/[id]/panels";

export function FindBar() {
  return (
    <button
      type="button"
      onClick={openPalette}
      className="state state-ink my-7 flex w-full items-center gap-3 rounded-2xl bg-canvas px-5 py-4 text-left text-muted"
    >
      <Search size={18} strokeWidth={1.8} />
      <span className="flex-1">Paste a phone number, LinkedIn link or name to see if we already have them</span>
      <kbd className="rounded-md bg-surface px-1.5 py-0.5 font-sans text-[12px]">⌘K</kbd>
    </button>
  );
}

/** Call, WhatsApp and notes, shown when you point at a row. */
export function RowActions({ phone, candidateId, callHref }: { phone?: string | null; candidateId: string; callHref?: string }) {
  const btn = "state grid h-8 w-8 place-items-center rounded-full text-ink/80";
  return (
    <span className="flex gap-0.5">
      {phone ? (
        <>
          <a href={`tel:${phone}`} className={btn} title="Call">
            <Phone size={15} strokeWidth={1.8} />
          </a>
          <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className={btn} title="WhatsApp">
            <MessageCircle size={15} strokeWidth={1.8} />
          </a>
        </>
      ) : null}
      <Link href={callHref ?? `/candidates/${candidateId}/call`} className={btn} title="Log the call">
        <StickyNote size={15} strokeWidth={1.8} />
      </Link>
    </span>
  );
}

export function LogCallLink() {
  return (
    <Button size="sm" variant="secondary" onClick={() => window.dispatchEvent(new Event("ps:log-call"))}>
      Log a call
    </Button>
  );
}

type Person = { candidate_id: string; name: string; reason: string };

/** People we've spoken to before who fit a mandate that just opened. */
export function SuggestionShelf({ mandateId, mandateName, people }: { mandateId: string; mandateName: string; people: Person[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [gone, setGone] = useState<string[]>([]);
  const shown = people.filter((p) => !gone.includes(p.candidate_id));

  const add = (ids: string[]) =>
    start(async () => {
      const r = await addCandidates(mandateId, ids);
      if (r.error) return toast({ message: r.error });
      setGone((g) => [...g, ...ids]);
      const added = r.added ?? [];
      toast({
        message: ids.length === 1 ? `${people.find((p) => p.candidate_id === ids[0])?.name} added to ${mandateName}` : `${ids.length} people added to ${mandateName}`,
        action: added.length
          ? {
              label: "Undo",
              onClick: () =>
                start(async () => {
                  const u = await undoAdds(added);
                  toast({ message: undoMessage(u) });
                  if (!u.error && u.removed) setGone((g) => g.filter((x) => !ids.includes(x)));
                }),
            }
          : undefined,
      });
    });

  if (!shown.length) return null;
  return (
    <>
      <div className="mb-4 grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(shown.length, 4)}, minmax(0, 1fr))` }}>
        {shown.slice(0, 8).map((p) => (
          <div key={p.candidate_id} className="group state state-ink relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl bg-white/60 px-2 pb-3 pt-4 text-center">
            <button
              type="button"
              title={`Add ${p.name}`}
              disabled={pending}
              onClick={() => add([p.candidate_id])}
              className="absolute right-2 top-2 z-10 grid h-7 w-7 scale-75 place-items-center rounded-full bg-accent text-white opacity-0 transition-[opacity,transform] duration-500 [transition-timing-function:var(--ease-spring)] group-hover:scale-100 group-hover:opacity-100"
            >
              <Plus size={14} strokeWidth={2.2} />
            </button>
            <Link href={`/candidates/${p.candidate_id}`} className="flex flex-col items-center gap-2">
              <span className="transition-transform duration-500 [transition-timing-function:var(--ease-spring)] group-hover:scale-[1.07]">
                <Avatar name={p.name} size={52} />
              </span>
              <b className="text-[13px] font-semibold leading-tight">{p.name}</b>
            </Link>
            <small className="-mt-1 line-clamp-2 px-1 text-[11.5px] leading-snug text-muted">{p.reason}</small>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="primary" disabled={pending} onClick={() => add(shown.map((p) => p.candidate_id))}>
          {shown.length === 1 ? "Add to the mandate" : `Add all ${shown.length}`}
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await dismissSuggestions(mandateId);
              toast({ message: r.error ?? "Hidden. They're still on the mandate page under Suggested." });
            })
          }
        >
          Not now
        </Button>
      </div>
    </>
  );
}
