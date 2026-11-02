"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/form";
import { markReviewed, mergeInto } from "./actions";

export function ReviewActions({ rowId, candidateId, duplicateId, duplicateName }: { rowId: number; candidateId: string | null; duplicateId: string | null; duplicateName: string | null }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {duplicateId && candidateId ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await mergeInto(duplicateId, candidateId, rowId);
              setErr(r.error ?? null);
            })
          }
        >
          Same person: merge into {duplicateName ?? "existing"}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await markReviewed(rowId, candidateId);
            setErr(r.error ?? null);
          })
        }
      >
        Looks fine
      </Button>
      {err ? <span className="text-[12px] text-danger">{err}</span> : null}
    </span>
  );
}
