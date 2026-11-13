"use client";

import { useRouter } from "next/navigation";
import { useRef, type ElementType, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { navigateTo } from "@/components/nav-progress";

// Clicks on these keep their own meaning; the row only answers clicks on its plain parts.
const OWN_CLICK = "a, button, input, select, textarea, label, summary, [role=button], [role=menuitem], [data-row-ignore]";
const HOVER_MS = 70;

/**
 * A list row that opens a page when you click anywhere on it, not just on the name.
 * The name inside stays a real link, so keyboards, screen readers and "open in new tab" still work;
 * ⌘/Ctrl-click or a middle click on the row opens a new tab too. Selecting text to copy doesn't
 * navigate. Like components/fast-link, resting the pointer on the row fetches the page ahead,
 * so the click opens it at once. Styling: .row-link in app/globals.css.
 */
export function RowLink({
  href,
  as: Tag = "tr",
  className,
  children,
  onContextMenu,
}: {
  href: string;
  as?: ElementType;
  className?: string;
  children: ReactNode;
  onContextMenu?: (e: MouseEvent) => void;
}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fetchedAt = useRef(0);

  const prefetch = () => {
    if (Date.now() - fetchedAt.current < 30_000) return;
    fetchedAt.current = Date.now();
    // "full" fetches the page with its data, as <Link prefetch> would (Next 16 accepts this option).
    (router.prefetch as (href: string, options: { kind: "full" }) => void)(href, { kind: "full" });
  };
  const ownClick = (e: MouseEvent) => (e.target as Element).closest(OWN_CLICK) !== null;

  return (
    <Tag
      className={className ? `row-link ${className}` : "row-link"}
      onContextMenu={onContextMenu}
      onPointerEnter={(e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        clearTimeout(timer.current);
        timer.current = setTimeout(prefetch, HOVER_MS);
      }}
      onPointerLeave={() => clearTimeout(timer.current)}
      onPointerDown={(e: PointerEvent) => {
        if (e.button === 0 && !ownClick(e)) prefetch();
      }}
      onClick={(e: MouseEvent) => {
        if (e.defaultPrevented || e.button !== 0 || ownClick(e)) return;
        if (window.getSelection()?.toString()) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey) {
          window.open(href, "_blank", "noopener");
          return;
        }
        navigateTo(router, href);
      }}
      onAuxClick={(e: MouseEvent) => {
        if (e.button === 1 && !ownClick(e)) window.open(href, "_blank", "noopener");
      }}
    >
      {children}
      {Tag === "tr" ? (
        <td className="row-chevron" aria-hidden>
          <ChevronRight size={17} strokeWidth={2} />
        </td>
      ) : null}
    </Tag>
  );
}
