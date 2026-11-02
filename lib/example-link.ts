import { personaById } from "@/lib/personas";
import { closeExample, getPlanSnapshot, openExample, parsePlan } from "@/lib/plan-storage";

// Links into a service page "with our worked example first" (the Services menu, the homepage tiles and the
// /move cards). The link carries ?example=<id> so a shared URL opens the same student, and its onClick opens
// the example at once, so a click on the page you are already on works too. Opening the example that is
// already open keeps the visitor's edits in it (openExample would overwrite the sandbox). Links meant for
// the visitor's own input (Start planning, "I have an idea", "Check your own idea") close it instead.

const PARAM = "example";

/** `path` with `?example=<id>` (and any `extra` params) added, keeping an existing query and #hash. */
export function exampleHref(path: string, id = "arjun", extra?: Record<string, string>): string {
  const hashAt = path.indexOf("#");
  const hash = hashAt >= 0 ? path.slice(hashAt) : "";
  const rest = hashAt >= 0 ? path.slice(0, hashAt) : path;
  const queryAt = rest.indexOf("?");
  const base = queryAt >= 0 ? rest.slice(0, queryAt) : rest;
  const params = new URLSearchParams(queryAt >= 0 ? rest.slice(queryAt + 1) : "");
  params.set(PARAM, id);
  for (const [k, v] of Object.entries(extra ?? {})) params.set(k, v);
  return `${base}?${params.toString()}${hash}`;
}

/** The id of the example open in this browser session, or null. */
function openId(): string | null {
  return parsePlan(getPlanSnapshot())?.example ?? null;
}

/** Opens example `id` unless it is already open (so the visitor's edits in it are kept). False for an unknown id. */
export function openExampleNow(id: string): boolean {
  if (typeof window === "undefined") return false;
  const persona = personaById(id);
  if (!persona) return false;
  if (openId() === persona.id) return true;
  return openExample(persona.id, persona.answers(new Date()));
}

/** Back to the visitor's own answers (or none). */
export function closeExampleNow(): void {
  if (typeof window === "undefined") return;
  closeExample();
}

/** On mount: reads ?example=<id>, opens that example, then strips the param from the address. Returns the id, or null. */
export function applyExampleFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const id = url.searchParams.get(PARAM);
  if (id === null) return null;
  const opened = openExampleNow(id);
  url.searchParams.delete(PARAM);
  try {
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {}
  return opened ? id : null;
}
