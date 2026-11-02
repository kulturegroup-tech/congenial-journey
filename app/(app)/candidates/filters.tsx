"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button, Input, Select } from "@/components/form";
import { CITIES } from "@/lib/constants";

type F = { q: string; practice: string; city: string; seniority: string; min: string; max: string };

export function CandidateFilters({ practices, initial }: { practices: string[]; initial: F }) {
  const router = useRouter();
  const pathname = usePathname();
  const [f, setF] = useState<F>(initial);
  const [pending, start] = useTransition();

  const apply = (next: F) => {
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v !== "") as [string, string][]).toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  };
  const set = (k: keyof F) => (v: string) => {
    const next = { ...f, [k]: v };
    setF(next);
    if (k !== "q" && k !== "min" && k !== "max") apply(next);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    apply(f);
  };
  const active = Object.values(f).some(Boolean);

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <Input
        value={f.q}
        onChange={(e) => setF({ ...f, q: e.target.value })}
        placeholder="Name, firm or designation"
        className="w-64"
      />
      <Select value={f.practice} onChange={(e) => set("practice")(e.target.value)} className="w-48">
        <option value="">All practice areas</option>
        {practices.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </Select>
      <Select value={f.city} onChange={(e) => set("city")(e.target.value)} className="w-36">
        <option value="">All cities</option>
        {CITIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </Select>
      <Select value={f.seniority} onChange={(e) => set("seniority")(e.target.value)} className="w-44">
        <option value="">Any seniority</option>
        <option>Newly qualified</option>
        <option>Junior (1–3)</option>
        <option>Mid-level (3–6)</option>
        <option>Senior (6+)</option>
      </Select>
      <div className="flex items-center gap-1">
        <Input value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} placeholder="PQE from" className="w-24" inputMode="decimal" />
        <span className="text-muted">–</span>
        <Input value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} placeholder="to" className="w-20" inputMode="decimal" />
      </div>
      <Button type="submit" variant="primary">
        {pending ? "Searching…" : "Search"}
      </Button>
      {active ? (
        <Button
          variant="ghost"
          onClick={() => {
            const empty = { q: "", practice: "", city: "", seniority: "", min: "", max: "" };
            setF(empty);
            apply(empty);
          }}
        >
          Clear
        </Button>
      ) : null}
    </form>
  );
}
