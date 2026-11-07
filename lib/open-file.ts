// Opening a private file (CV, signed agreement) in a new tab.
// Safari blocks window.open() that happens after an await, so the tab is opened at the click
// and pointed at the signed URL once the server returns it.
export async function openFile(getUrl: () => Promise<{ url?: string | null; error?: string | null }>): Promise<string | null> {
  const tab = window.open("", "_blank");
  let r: { url?: string | null; error?: string | null };
  try {
    r = await getUrl();
  } catch {
    r = { error: "Couldn't reach the server. Try again." };
  }
  if (r.url) {
    if (tab) {
      tab.opener = null;
      tab.location.href = r.url;
    } else {
      window.location.href = r.url; // pop-ups blocked: open it here instead
    }
    return null;
  }
  tab?.close();
  return r.error ?? "Couldn't open the file.";
}
