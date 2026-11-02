"use client";

// Form building blocks. Styling lives here and in components/ui.tsx.
import Link from "next/link";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/forms";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none placeholder:text-faint focus:border-accent disabled:bg-canvas";

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-[13px] font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[12px] text-muted">{hint}</span> : null}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={3} {...props} className={cx(inputClass, "resize-y", props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cx(inputClass, "pr-8", props.className)} />;
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:opacity-95 border-transparent",
  secondary: "bg-surface text-ink border-line hover:bg-canvas",
  ghost: "bg-transparent text-muted border-transparent hover:text-ink hover:bg-canvas",
  danger: "bg-surface text-danger border-line hover:bg-danger-soft",
};
const buttonBase = "inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium disabled:opacity-60";
const sizes = { sm: "px-2.5 py-1 text-[13px]", md: "px-3.5 py-2" };

export function Button({ variant = "secondary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button type="button" {...props} className={cx(buttonBase, variants[variant], sizes[size], className)} />;
}

export function ButtonLink({ variant = "secondary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: "sm" | "md" }) {
  return <Link {...props} className={cx(buttonBase, variants[variant], sizes[size], className)} />;
}

export function SubmitButton({ children, pendingText = "Saving…", variant = "primary", size = "md", className }: { children: ReactNode; pendingText?: string; variant?: Variant; size?: "sm" | "md"; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cx(buttonBase, variants[variant], sizes[size], className)}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error)
    return (
      <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
        {state.error}
        {state.duplicateId ? (
          <>
            {" "}
            <Link href={`/candidates/${state.duplicateId}`} className="font-medium underline">
              Open their profile
            </Link>
          </>
        ) : null}
      </p>
    );
  if (state.message) return <p className="rounded-lg bg-ok-soft px-3 py-2 text-[13px] text-ok">{state.message}</p>;
  return null;
}

/** Modal built on the native <dialog>. `children` gets a close() function. */
export function Dialog({
  trigger,
  title,
  children,
  wide,
  open: openProp,
  onOpenChange,
}: {
  trigger?: (open: () => void) => ReactNode;
  title: string;
  children: (close: () => void) => ReactNode;
  wide?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [openState, setOpenState] = useState(false);
  const isOpen = openProp ?? openState;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setOpenState(v);
  };

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (isOpen && !d.open) d.showModal();
    if (!isOpen && d.open) d.close();
  }, [isOpen]);

  return (
    <>
      {trigger ? trigger(() => setOpen(true)) : null}
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === ref.current && setOpen(false)}
        className={cx(
          "m-auto max-h-[88vh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/30",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
      >
        {isOpen ? (
          <div className="px-6 py-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-[17px] font-semibold">{title}</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink" aria-label="Close">
                ✕
              </button>
            </div>
            {children(() => setOpen(false))}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
