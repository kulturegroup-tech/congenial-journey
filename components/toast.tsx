"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Toast = { id: number; message: string; action?: { label: string; onClick: () => void } };
const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

/** Tell people what happened, and let them take it back, instead of asking "are you sure?". */
export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((t: Omit<Toast, "id">) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 6000);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast ? (
        <div key={toast.id} role="status" className="rise no-print fixed bottom-8 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-5 rounded-2xl bg-ink py-3 pl-5 pr-3 text-[14px] font-medium text-white shadow-[0_18px_40px_-16px_rgb(29_42_36/0.6)]">
          <span>{toast.message}</span>
          {toast.action ? (
            <button
              type="button"
              onClick={() => {
                toast.action!.onClick();
                setToast(null);
              }}
              className="state rounded-full px-3 py-1 font-semibold text-sage"
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </Ctx.Provider>
  );
}
