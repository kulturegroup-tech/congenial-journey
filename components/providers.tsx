"use client";

import type { ReactNode } from "react";
import { CommandPalette } from "./command-palette";
import { ContextMenuProvider } from "./context-menu";
import { LogCallButton } from "./log-call";
import { Ripples } from "./motion";
import { ToastProvider } from "./toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ContextMenuProvider>
        {children}
        <CommandPalette />
        <LogCallButton />
        <Ripples />
      </ContextMenuProvider>
    </ToastProvider>
  );
}
