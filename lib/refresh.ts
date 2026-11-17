import "server-only";

import { refresh, updateTag } from "next/cache";

/**
 * Call after every save in a Server Action, instead of next/cache's refresh().
 *
 * refresh() on its own re-renders only the screen you are on. Pages fetched ahead when the pointer
 * rested on a link (components/fast-link, components/row-link) stayed in the browser for up to a
 * minute, so the next screen you opened could still show data from before the save: a candidate
 * just added to a mandate was missing from the mandate until a full reload. Expiring a tag tells
 * Next.js to drop every page it fetched ahead as well. No server cache uses this tag; it only sends
 * that signal.
 */
export function refreshAll() {
  updateTag("covaro-data");
  refresh();
}
