import type { Metadata } from "next";
import { ComingNext, Page, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Team, firm details and defaults. Admins only can change these." />
      <Page>
        <ComingNext
          items={[
            "Team members: add, deactivate, make admin",
            "Firm details for invoices: GSTIN, address, bank details, next invoice number",
            "Defaults: stale-mandate threshold, cooling-off and resume validity",
            "Lists: practice areas, exit reasons, firm grades",
          ]}
        />
      </Page>
    </>
  );
}
