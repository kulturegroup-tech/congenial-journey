"use client";

// Form building blocks. Styling lives here, in components/ui.tsx and in app/globals.css.
import Link from "next/link";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { X } from "lucide-react";
import type { ActionState } from "@/lib/forms";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Filled, tonal fields: no borders until you focus. */
export const inputClass =
  "w-full rounded-xl border border-transparent bg-canvas px-3.5 py-2.5 outline-none transition-[background,border-color,box-shadow] duration-150 placeholder:text-faint hover:bg-[#eef1ec] focus:border-accent/30 focus:bg-surface focus:shadow-[0_0_0_4px_rgb(36_69_58/0.08)] disabled:opacity-60";

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink/80">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-[12px] text-muted">{hint}</span> : null}
    </label>
  );
}

// A width passed in (w-64, w-24…) replaces the default full width instead of fighting it.
const field = (extra?: string) => cx(extra && /(^|\s)w-/.test(extra) ? inputClass.replace("w-full ", "") : inputClass, extra);

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={field(props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={3} {...props} className={cx(field(props.className), "resize-y")} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cx(field(props.className), "pr-8")} />;
}

// primary: filled forest. secondary: sage tonal. outline: hairline. ghost: text. danger: for "send anyway".
type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-white",
  secondary: "bg-accent-soft text-accent",
  outline: "bg-transparent text-ink ring-1 ring-inset ring-line",
  ghost: "bg-transparent text-muted hover:text-ink",
  danger: "bg-danger text-white",
};
// Pressing squares the corners a little, with a spring: the shape answers the click.
const buttonBase =
  "state inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-full font-medium whitespace-nowrap transition-[border-radius,opacity] duration-500 [transition-timing-function:var(--ease-spring)] active:rounded-xl disabled:pointer-events-none disabled:opacity-50";
const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4" };

export function Button({ variant = "outline", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button type="button" data-ripple {...props} className={cx(buttonBase, variants[variant], sizes[size], className)} />;
}

export function ButtonLink({ variant = "outline", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: "sm" | "md" }) {
  return <Link data-ripple {...props} className={cx(buttonBase, variants[variant], sizes[size], className)} />;
}

export function SubmitButton({
  children,
  pendingText = "Saving…",
  variant = "primary",
  size = "md",
  className,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: Variant;
  size?: "sm" | "md";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" data-ripple disabled={pending} className={cx(buttonBase, variants[variant], sizes[size], className)}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error)
    return (
      <p className="rounded-2xl bg-danger-soft px-4 py-2.5 text-[13px] text-danger">
        {state.error}
        {state.duplicateId ? (
          <>
            {" "}
            <Link href={`/candidates/${state.duplicateId}`} className="font-medium underline underline-offset-2">
              Open their profile
            </Link>
          </>
        ) : null}
      </p>
    );
  if (state.message) return <p className="rounded-2xl bg-ok-soft px-4 py-2.5 text-[13px] text-ok">{state.message}</p>;
  return null;
}

/** A sheet that slides up from the bottom, built on the native <dialog>. `children` gets a close() function. */
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
          "sheet mx-auto mb-0 mt-auto max-h-[90vh] w-full overflow-y-auto rounded-t-[28px] bg-surface p-0 text-ink shadow-[0_-12px_48px_-16px_rgb(29_42_36/0.35)]",
          wide ? "max-w-3xl" : "max-w-xl",
        )}
      >
        {isOpen ? (
          <div className="px-7 pb-8 pt-3">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="font-display text-[30px] leading-tight">{title}</h2>
              <button type="button" onClick={() => setOpen(false)} className="state grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted" aria-label="Close">
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>
            {children(() => setOpen(false))}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
