import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui";
import { LookupClient } from "./lookup-client";

export const metadata: Metadata = { title: "Lookup" };

export default function LookupPage() {
  return (
    <>
      <PageHeader
        title="Lookup"
        description="Check whether we already have someone before pulling their number from Weekday."
      />
      <Page>
        <LookupClient />
      </Page>
    </>
  );
}
