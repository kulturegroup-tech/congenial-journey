import { Card } from "./ui";
import { SignOutButton } from "./sign-out-button";

export function SetupNotice() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-8">
      <Card className="max-w-lg px-7 py-6">
        <p className="text-[12px] font-medium uppercase tracking-wide text-warn">Setup needed</p>
        <h2 className="mt-1 text-lg font-semibold">Connect the database</h2>
        <p className="mt-2 text-muted">
          The app is deployed but doesn&apos;t know which Supabase project to use yet. Add these environment variables in
          Vercel (Settings → Environment Variables), then redeploy:
        </p>
        <ul className="mt-3 space-y-1 font-mono text-[13px]">
          <li>NEXT_PUBLIC_SUPABASE_URL</li>
          <li>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</li>
          <li>ALLOWED_EMAIL_DOMAINS</li>
        </ul>
      </Card>
    </div>
  );
}

export function NotOnTeam({ email }: { email: string | null }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-8">
      <Card className="max-w-md px-7 py-6">
        <h2 className="text-lg font-semibold">Almost there</h2>
        <p className="mt-2 text-muted">
          You&apos;re signed in{email ? ` as ${email}` : ""}, but you haven&apos;t been added to the team yet. Ask Khyati
          to add you, then refresh this page.
        </p>
        <div className="mt-5">
          <SignOutButton variant="button" />
        </div>
      </Card>
    </div>
  );
}
