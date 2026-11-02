import type { Metadata } from "next";
import { ComingNext, Page, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Clients" };

export default function ClientsPage() {
  return (
    <>
      <PageHeader title="Clients" description="Each client's contacts and agreement terms: fees, cooling-off, resume validity, invoice deadlines." />
      <Page>
        <ComingNext
          items={[
            "Client list and contacts, flagging who must be copied on CV shares",
            "Agreement form: fee % by role category, cooling-off, resume validity, replacement, invoice and payment terms",
            "Signed agreement upload (private storage)",
          ]}
        />
      </Page>
    </>
  );
}
