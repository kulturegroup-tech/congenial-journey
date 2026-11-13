import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Awake" };

// Pinged every 5 minutes in office hours by the Supabase scheduler (migration 9), so Vercel's free
// plan doesn't put the server to sleep and the first page of the morning, or after lunch, opens
// in under a second instead of 3–10. It reads nothing and shows nothing; it only has to make the
// server run, so the part below renders on each request rather than coming from the cache.
export default function WarmPage() {
  return (
    <Suspense fallback={null}>
      <Awake />
    </Suspense>
  );
}

async function Awake() {
  await connection();
  return <p className="p-6 text-muted">Awake.</p>;
}
