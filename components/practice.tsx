"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { inputClass } from "./form";

/** A practice area as the pickers need it. The groups come from `practice_areas.category`. */
export type Practice = { name: string; category: string | null };

function grouped(practices: Practice[]) {
  const groups = new Map<string, Practice[]>();
  for (const p of practices) {
    const g = p.category ?? "Other";
    groups.set(g, [...(groups.get(g) ?? []), p]);
  }
  return [...groups];
}

/**
 * The <option>s for a practice-area <select>, in their groups. A value that's no longer on the list
 * (an area from the older list, still on a record) stays at the top, so saving doesn't wipe it.
 */
export function PracticeOptions({ practices, current }: { practices: Practice[]; current?: string | null }) {
  return (
    <>
      {current && !practices.some((p) => p.name === current) ? <option value={current}>{current} (older list)</option> : null}
      {grouped(practices).map(([g, items]) => (
        <optgroup key={g} label={g}>
          {items.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

/**
 * Pick several practice areas from a long list: type to narrow it, tick to add, × to remove.
 * Sends one `name` field per picked area, like the checkboxes it replaces.
 */
export function PracticePicker({ practices, name, defaultValue = [] }: { practices: Practice[]; name: string; defaultValue?: string[] }) {
  const [picked, setPicked] = useState<string[]>(defaultValue);
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const shown = useMemo(
    () => grouped(term ? practices.filter((p) => p.name.toLowerCase().includes(term) || (p.category ?? "").toLowerCase().includes(term)) : practices),
    [practices, term],
  );
  const toggle = (v: string) => setPicked((now) => (now.includes(v) ? now.filter((x) => x !== v) : [...now, v]));

  return (
    <div>
      {picked.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
      <div className="mb-2 flex min-h-8 flex-wrap items-center gap-1.5">
        {picked.length ? (
          picked.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pl-3 pr-1.5 text-[12.5px] font-medium text-accent">
              {v}
              <button type="button" onClick={() => toggle(v)} className="state grid h-5 w-5 place-items-center rounded-full" aria-label={`Remove ${v}`}>
                <X size={12} />
              </button>
            </span>
          ))
        ) : (
          <span className="text-[13px] text-muted">None picked yet.</span>
        )}
      </div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          // Enter picks the only match instead of submitting the form.
          if (e.key !== "Enter") return;
          e.preventDefault();
          const all = shown.flatMap(([, items]) => items);
          if (all.length === 1) {
            toggle(all[0].name);
            setQ("");
          }
        }}
        placeholder={`Search ${practices.length} practice areas`}
        className={inputClass}
      />
      <div className="mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-2xl px-3 py-2 ring-1 ring-line">
        {shown.length ? (
          shown.map(([g, items]) => (
            <div key={g} className="py-1.5">
              <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted">{g}</p>
              <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((p) => (
                  <label key={p.name} className="flex cursor-pointer items-center gap-2 rounded-lg py-0.5 text-[13px]">
                    <input type="checkbox" checked={picked.includes(p.name)} onChange={() => toggle(p.name)} className="accent-[var(--color-accent)]" />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="py-2 text-[13px] text-muted">No practice area matches “{q}”.</p>
        )}
      </div>
    </div>
  );
}
