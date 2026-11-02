import "server-only";

// Who may sign in. RLS still shows nothing until the person has a team_members row.
//   ALLOWED_EMAIL_DOMAINS=paradigmshifters.in
//   ALLOWED_EMAILS=someone@gmail.com          (extra people, e.g. the developer)
const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export function isAllowedEmail(email: string | null | undefined) {
  if (!email) return false;
  const address = email.trim().toLowerCase();
  const domains = list(process.env.ALLOWED_EMAIL_DOMAINS ?? "paradigmshifters.in");
  const emails = list(process.env.ALLOWED_EMAILS);
  return emails.includes(address) || domains.some((d) => address.endsWith("@" + d));
}
