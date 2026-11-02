import type { Metadata } from "next";
import { ComingNext, Page, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Candidates" };

export default function CandidatesPage() {
  return (
    <>
      <PageHeader title="Candidates" description="One profile per person, with every call, CV and mandate they've been part of." />
      <Page>
        <ComingNext
          items={[
            "Candidate list with filters: practice area, city, PQE range, seniority, current firm",
            "Profile: phones, emails, CVs, calls, interest tags, prior applications, pipelines, activity",
            "Screening call form with the 14 questionnaire fields, fast enough to fill during the call",
            "Import from Odoo and the sheets, with a review list for near-duplicates",
          ]}
        />
      </Page>
    </>
  );
}
