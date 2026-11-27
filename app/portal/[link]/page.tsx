import type { Metadata } from "next";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/ui";
import { isPortalLink, loadPortal } from "@/lib/portal";
import { PortalList, SignIn } from "./widgets";

// The client portal: one page per client contact, reached by the private link the firm sent them.
// It is the firm's page, not the app's: no product name anywhere, not even in the tab title.
export const metadata: Metadata = {
  title: { absolute: "Shared CVs" },
  description: "Shared in confidence",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type Params = Promise<{ link: string }>;

export default function PortalPage({ params }: { params: Params }) {
  return (
    <main className="min-h-screen bg-canvas px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Suspense fallback={<TableSkeleton />}>
          <Portal params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Portal({ params }: { params: Params }) {
  const { link } = await params;
  if (!isPortalLink(link)) return <SignIn link={link} broken />;
  const view = await loadPortal(link);
  if (!view) return <SignIn link={link} />;
  return <PortalList link={link} view={view} />;
}
