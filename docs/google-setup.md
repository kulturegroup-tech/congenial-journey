# Connect Google: one-time setup for a firm

Covaro can send CV shares from each person's Gmail, show the emails with a candidate or client, and keep
calls and interviews in step with Google Calendar. For that, the firm creates a small "app" in **its own**
Google account. Set up this way it's an **Internal** app: only the firm's own people can use it, and Google
doesn't need to review it.

**Who:** the person who runs the firm's Google Workspace (for Paradigm Shifters, Khyati or whoever is the
admin of `paradigmshifters.in`). It must be their work account, not a personal Gmail: an app made from a
personal account is an outside app, and Google then has to review it. About 15 minutes.

## A. In Google Cloud (the firm's admin)

1. Open https://console.cloud.google.com and sign in with the **work admin account** (e.g. `khyati@paradigmshifters.in`).
2. Click the project picker at the top → **New project**. Name it `Covaro`. Under **Organization / Location**, pick the
   firm's domain (`paradigmshifters.in`), not "No organization". Click **Create**, then make sure the new project is selected.
3. Go to **APIs & Services → Library**. Search **Gmail API** → **Enable**. Go back, search **Google Calendar API** → **Enable**.
4. Go to **Google Auth Platform** (older screens call it **OAuth consent screen**) → **Get started**.
   - App name: `Covaro`. User support email: your work email.
   - **Audience: Internal.** This is the important choice.
   - Contact email: your work email. Agree and **Create**.
   (Internal apps don't need scopes listed, so skip the "Data access" page.)
5. Go to **Clients** (older screens: **Credentials → Create credentials → OAuth client ID**) → **Create client**.
   - Application type: **Web application**. Name: `Covaro`.
   - **Authorised redirect URIs → Add URI:** `https://paradigm-shifters.onrender.com/api/google/callback`
     (for another firm, its own Covaro address followed by `/api/google/callback`).
   - **Create.** Copy the **Client ID** and **Client secret**. Treat the secret like a password: paste it straight into
     Render (step B), or send it privately, never in a group chat.

## B. In Render (Priyanshi)

Khyati's service → **Environment** → add:

| Key | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | the Client ID from step 5 |
| `GOOGLE_CLIENT_SECRET` | the Client secret from step 5 |
| `GOOGLE_TOKEN_KEY` | any long random text (40+ characters, e.g. from a password generator). Never change it later: everyone would have to connect again |

Save. Render redeploys by itself (a couple of minutes). For a firm on Vercel, add the same three under the project's
**Settings → Environment Variables**, then redeploy.

## C. Each person, once

Covaro → **Settings → Google account → Connect Google** → pick your **work** Google account → **Allow**, with every box ticked.
The team list in Settings shows who is connected.

## If something goes wrong

- **"Access blocked" or "your admin needs to approve this app":** in https://admin.google.com go to **Security → Access and
  data control → API controls** and turn on trusting internal, domain-owned apps (or mark Covaro as trusted there).
- **"That was a different Google account":** you picked a personal Gmail. Connect again with your work account.
- **"Some boxes were unticked":** connect again and leave all the boxes ticked.
- **Someone leaves:** remove them from the team in Covaro; their connection stops working. They can also press Disconnect,
  and the admin can remove Covaro's access in the Google admin console.

## What Covaro can and can't do with it

- Send email from your address only when you press Send in Covaro.
- Read emails only to show the ones with a candidate or client you are looking at; nothing is copied into Covaro.
- Add, move and remove the calendar events Covaro makes, and see when you're busy.
- The connection key is stored encrypted; the key to open it lives only on the server.
