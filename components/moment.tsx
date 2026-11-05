"use client";

// The illustrated moment beside the greeting on Today. It plays once the first time someone sees it
// on a given day and sits still after that; clicking it plays it again.
import { useEffect, useState } from "react";
import type { Moment } from "@/lib/moments";
import { Illustration } from "./illustrations";

const KEY = "ps:moments-seen";

export function MomentArt({ moment, day }: { moment: Moment; day: string }) {
  const [state, setState] = useState<"pending" | "play" | "still">("pending");
  const [run, setRun] = useState(0);

  useEffect(() => {
    const mark = `${moment.id}@${day}`;
    let seen = false;
    try {
      const list = (localStorage.getItem(KEY) ?? "").split("|").filter(Boolean);
      seen = list.includes(mark);
      if (!seen) localStorage.setItem(KEY, [mark, ...list].slice(0, 30).join("|"));
    } catch {
      // No storage (private window): just play it.
    }
    const raf = requestAnimationFrame(() => setState(seen ? "still" : "play"));
    return () => cancelAnimationFrame(raf);
  }, [moment.id, day]);

  return (
    <button
      type="button"
      data-state={state}
      title="Play again"
      onClick={() => {
        setRun((r) => r + 1);
        setState("play");
      }}
      className="moment -mb-1 flex shrink-0 flex-col items-center gap-1 rounded-3xl px-2 pb-1 outline-offset-2"
    >
      <span key={run} className="block h-[88px] w-[88px] [&>svg]:h-full [&>svg]:w-full">
        <Illustration kind={moment.kind} label={moment.caption} />
      </span>
      <span className="whitespace-nowrap rounded-full bg-side px-3 py-1 text-[12.5px] font-medium text-ink/80">{moment.caption}</span>
      {moment.note ? <span className="text-[10.5px] text-faint">{moment.note}</span> : null}
    </button>
  );
}
