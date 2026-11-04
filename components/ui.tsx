// Shared building blocks. Styling lives here, in components/form.tsx and in app/globals.css.
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { TitleBar } from "./title-bar";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Large serif title that tucks into a slim bar on scroll. */
export function PageHeader({
  title,
  description,
  actions,
  back,
  leading,
  children,
}: {
  title: string;
  leading?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <>
      <TitleBar title={title} />
      <header className="px-10 pb-6 pt-9">
        {back ? (
          <Link href={back.href} className="state -ml-2 mb-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[13px] text-muted hover:text-ink">
            <ChevronLeft size={15} strokeWidth={1.8} />
            {back.label}
          </Link>
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex min-w-0 items-center gap-5">
            {leading}
            <div className="min-w-0">
              <h1 className="font-display text-[44px] leading-[1.05] tracking-[-0.01em]">{title}</h1>
              {description ? <div className="mt-2 max-w-2xl text-[15px] text-muted">{description}</div> : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </header>
    </>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("px-10 pb-28", className)}>{children}</div>;
}

type Tone = "neutral" | "accent" | "warn" | "danger" | "ok" | "dark";
const tones: Record<Tone, string> = {
  neutral: "bg-canvas text-muted",
  accent: "bg-accent-soft text-accent",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  ok: "bg-ok-soft text-ok",
  dark: "bg-ink text-white",
};

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium", tones[tone], className)}>{children}</span>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  // A tinted card (bg-…) drops the white fill and hairline so the classes never fight.
  const tinted = /(^|\s)bg-/.test(className);
  return <div className={cx("rounded-3xl", tinted ? "" : "bg-surface ring-1 ring-line", className)}>{children}</div>;
}

/** Tonal block: the colour says what kind of work is inside. */
export type TileTone = "mist" | "clay" | "sand" | "sage" | "lilac" | "side";
const tileTones: Record<TileTone, string> = {
  mist: "bg-mist",
  clay: "bg-clay",
  sand: "bg-sand",
  sage: "bg-accent-soft",
  lilac: "bg-lilac",
  side: "bg-side",
};
export function Tile({ tone = "side", title, action, children, className }: { tone?: TileTone; title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-3xl p-5", tileTones[tone], className)}>
      {title || action ? (
        <div className="mb-2.5 flex items-center justify-between gap-3">
          {title ? <h2 className="text-[16.5px] font-semibold tracking-[-0.01em]">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** A row inside a tile: white, rounded, with a quiet hover. */
export function TileRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("state state-ink group mt-1.5 flex items-center gap-3 overflow-hidden rounded-2xl bg-white/65 px-3 py-2.5 first:mt-0", className)}>{children}</div>;
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-3xl bg-surface ring-1 ring-line">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line text-[12.5px] text-muted">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 font-medium first:pl-5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&>tr]:transition-colors [&>tr:hover]:bg-canvas/70 [&>tr:last-child]:border-0 [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_td:first-child]:pl-5">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-3xl bg-side/70 px-8 py-12 text-center">
      <p className="text-[15px] font-medium">{title}</p>
      {children ? <div className="mx-auto mt-1.5 max-w-md text-muted">{children}</div> : null}
      {action ? <div className="mt-5 flex justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl bg-side/60 px-5 py-4">
          <div className="h-8 w-8 animate-pulse rounded-full bg-line/80" />
          <div className="h-3.5 w-1/4 animate-pulse rounded-full bg-line/80" />
          <div className="h-3.5 w-1/6 animate-pulse rounded-full bg-line/80" />
        </div>
      ))}
    </div>
  );
}

/** Initials in a soft colour that stays the same for the same person. */
const avatarTones = ["bg-[#cfdce6]", "bg-[#d3e3d2]", "bg-[#e9dcc4]", "bg-[#e2d6e6]", "bg-[#f0d2c8]", "bg-[#d4e1e8]", "bg-[#eadfb8]"];
export function Avatar({ name, size = 34, className }: { name: string; size?: number; className?: string }) {
  const initials = name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      className={cx("grid shrink-0 place-items-center rounded-full font-semibold text-ink/80", avatarTones[h % avatarTones.length], className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {initials || "?"}
    </span>
  );
}
