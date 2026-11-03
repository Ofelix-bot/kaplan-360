import { splitLocale } from "@/lib/i18n/config";
import { experienceCounts, type ExperienceEntry, type PlanAnswers } from "@/lib/plan-storage";

// /profile's shared parts: the round trip from a service page (the address to go back to and its scroll position,
// in sessionStorage; components/profile/BackToService and EditProfileLink), and the answers patch for the internship
// and work entries (the counts Where you stand and /careers read follow them). The floating profile button that
// showed the groups' completion on the service pages was removed on 2026-11-03: Kappy (components/kappy) holds the
// corner now.

/** The five service pages "Back to …" returns to (the Services menu, in its order, without /profile itself). */
export const SERVICE_PAGES: { href: string; label: string }[] = [
  { href: "/careers", label: "Compass" },
  { href: "/results", label: "Programme finder" },
  { href: "/plan", label: "Your plan" },
  { href: "/pathway", label: "Routes" },
  { href: "/outcomes", label: "Outcomes" },
];

/** The service a path (with or without its language prefix and query) belongs to: /careers/roles/x is Compass. */
export function serviceOf(pathname: string): { href: string; label: string } | null {
  const { path } = splitLocale(pathname.split(/[?#]/)[0]);
  // "/en/…" is the English route behind the rewrite; the browser shows it without the prefix.
  const bare = path.replace(/^\/en(?=\/|$)/, "") || "/";
  return SERVICE_PAGES.find((s) => bare === s.href || bare.startsWith(`${s.href}/`)) ?? null;
}

/** The entries as answers: the entries, and the counts they set. A count nobody has answered stays unanswered while no entry sets it. */
export function experiencePatch(a: PlanAnswers, entries: ExperienceEntry[]): Partial<PlanAnswers> {
  const c = experienceCounts(entries);
  const internships = entries.some((e) => e.kind !== "work") || a.internshipsSame !== null || a.internshipsOther !== null;
  const work = entries.some((e) => e.kind === "work") || a.workYears !== null;
  return {
    experience: entries,
    ...(internships ? { internshipsSame: c.internshipsSame, internshipsOther: c.internshipsOther } : {}),
    // /results' work filter reads workExperience: it follows the years, as Where you stand's inputs did.
    ...(work ? { workYears: c.workYears, workExperience: c.workYears > 0 ? ("have" as const) : ("none" as const) } : {}),
  };
}

// ── The round trip: service page → /profile → back ────────────────────────────────────────────────────────

const RETURN = "kaplan360:profile-return";

/** The current page's address (path and query, as the browser shows it). */
export const herePath = () => `${window.location.pathname}${window.location.search}`;

/** /profile with the page to go back to. */
export const profileHref = (from: string) => `/profile?from=${encodeURIComponent(from)}`;

/** Remembers this page and how far down it is, for "Back to …" on /profile. */
export function rememberReturn(): void {
  try {
    window.sessionStorage.setItem(RETURN, JSON.stringify({ path: herePath(), y: Math.round(window.scrollY) }));
  } catch {}
}

/** `from` when it is one of this site's own service pages (never another site, never /profile). */
export function safeFrom(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  return serviceOf(raw) ? raw : null;
}

/** The scroll position remembered for `from`, or 0. */
export function returnScroll(from: string): number {
  try {
    const r = JSON.parse(window.sessionStorage.getItem(RETURN) ?? "null") as { path?: string; y?: number } | null;
    return r?.path === from && typeof r.y === "number" ? r.y : 0;
  } catch {
    return 0;
  }
}

/**
 * Scrolls to `y` once the page at `from` has replaced /profile and grown tall enough (its data can arrive a
 * moment after it shows), trying for up to three seconds. Instant, whatever the page's smooth scrolling.
 */
export function restoreScroll(from: string, y: number): void {
  if (y <= 0) return;
  const path = from.split("?")[0];
  const until = performance.now() + 3000;
  const step = () => {
    const there = window.location.pathname === path;
    const tall = document.documentElement.scrollHeight - window.innerHeight >= y;
    if (there && tall) return window.scrollTo({ top: y, behavior: "instant" });
    if (performance.now() > until) {
      if (there) window.scrollTo({ top: y, behavior: "instant" });
      return;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
