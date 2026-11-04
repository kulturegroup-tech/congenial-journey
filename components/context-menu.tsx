"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState, type ElementType, type MouseEvent, type ReactNode } from "react";
import { ArrowUpRight, Copy, MessageCircle, Phone, PhoneCall } from "lucide-react";

export type MenuItem = { label: string; icon?: ReactNode; href?: string; external?: boolean; onSelect?: () => void; kbd?: string; divider?: boolean };
type Open = (e: MouseEvent, items: MenuItem[]) => void;
const Ctx = createContext<Open>(() => {});

/** Right-click anywhere that offers it: the actions for that person or card, at the cursor. */
export function useContextMenu() {
  return useContext(Ctx);
}

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[]; key: number } | null>(null);
  const open = useCallback<Open>((e, items) => {
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 240);
    const y = Math.min(e.clientY, window.innerHeight - items.length * 38 - 20);
    setMenu({ x, y, items, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  return (
    <Ctx.Provider value={open}>
      {children}
      {menu ? (
        <div
          key={menu.key}
          role="menu"
          style={{ left: menu.x, top: menu.y, transformOrigin: "top left" }}
          className="pop fixed z-[70] min-w-[220px] rounded-2xl bg-surface/90 p-1.5 shadow-[0_0_0_1px_var(--color-line),0_18px_40px_-12px_rgb(29_42_36/0.35)] backdrop-blur-xl"
        >
          {menu.items.map((it, i) => {
            const body = (
              <>
                <span className="grid w-4 place-items-center opacity-80">{it.icon}</span>
                <span className="flex-1">{it.label}</span>
                {it.kbd ? <kbd className="font-sans text-[11.5px] opacity-50">{it.kbd}</kbd> : null}
              </>
            );
            const cls = "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] font-medium hover:bg-accent hover:text-white";
            return (
              <div key={i}>
                {it.divider ? <div className="mx-2 my-1 h-px bg-line" /> : null}
                {it.href ? (
                  it.external ? (
                    <a href={it.href} target="_blank" rel="noreferrer" role="menuitem" className={cls}>
                      {body}
                    </a>
                  ) : (
                    <Link href={it.href} role="menuitem" className={cls}>
                      {body}
                    </Link>
                  )
                ) : (
                  <button type="button" role="menuitem" onClick={it.onSelect} className={cls}>
                    {body}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

export function personMenu(p: { id: string; name: string; phone?: string | null }): MenuItem[] {
  const items: MenuItem[] = [
    { label: "Open profile", icon: <ArrowUpRight size={15} />, href: `/candidates/${p.id}`, kbd: "↵" },
    { label: "Log a call", icon: <PhoneCall size={15} />, href: `/candidates/${p.id}/call` },
  ];
  if (p.phone) {
    const digits = p.phone.replace(/\D/g, "");
    items.push(
      { label: "Call", icon: <Phone size={15} />, href: `tel:${p.phone}`, external: true, divider: true },
      { label: "WhatsApp", icon: <MessageCircle size={15} />, href: `https://wa.me/${digits}`, external: true },
      { label: "Copy number", icon: <Copy size={15} />, onSelect: () => navigator.clipboard?.writeText(p.phone!) },
    );
  }
  return items;
}

/** A row (tr, li or div) about one person: right-click opens their actions. */
export function PersonRow({
  as: Tag = "div",
  person,
  className,
  children,
}: {
  as?: ElementType;
  person: { id: string; name: string; phone?: string | null };
  className?: string;
  children: ReactNode;
}) {
  const open = useContextMenu();
  return (
    <Tag className={className} onContextMenu={(e: MouseEvent) => open(e, personMenu(person))}>
      {children}
    </Tag>
  );
}
