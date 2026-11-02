// Groups candidate URLs into programmes: a programme's main page plus the sub-pages that hold its
// entry requirements or fees (e.g. ".../msc-finance" and ".../msc-finance/entry-requirements").
// Other sub-pages (careers, class profile, modules) are dropped.

const KEEP_SUBPAGE = /(entry|requirement|admission|criteria|how-to-apply|apply|fees?\b|fees-|tuition|english|language|eligib|programme-information|programme-details)/i;

export type ProgrammeGroup = { base: string; pages: string[] };

/** http → https, trailing slash removed, so the same page isn't counted twice. The query is kept only
 * for sites whose course pages differ by query (`keepQuery` sources, e.g. UCD's "?p_tag=COURSE&MAJR=T413"). */
export function canonical(u: string, keepQuery = false): string {
  const url = new URL(u);
  url.protocol = "https:";
  url.hash = "";
  if (!keepQuery) url.search = "";
  return url.toString().replace(/\/$/, "");
}

/** Intake variants of one course, e.g. Aston's ".../finance-msc/january-2027" and ".../september-2027". */
const INTAKE_SUFFIX = /\/(january|february|march|april|may|june|july|august|september|october|november|december)-20\d\d$/i;

/** Tabs of a programme page. When a sitemap lists only the tab (KCL's ".../dietetics-msc/teaching-and-modules"), its parent is the programme page. */
const TAB_SUFFIX =
  /\/(teaching-and-modules|course-content|modules|careers?|career-prospects|career-outcomes|fees-and-funding-?|fees|entry-requirements|how-to-apply|financing(\/tuition-fees)?|overview|programme-structure(\/[a-z-]+)?|curriculum|studio-experience|for-industry-partners|criteria-for-admission|class-profile|yourfuturecareer)$/i;

export function groupProgrammes(urls: string[], keepQuery = false): ProgrammeGroup[] {
  const all = new Set(urls.map((u) => canonical(u, keepQuery)));
  if (!keepQuery) for (const u of Array.from(all)) if (TAB_SUFFIX.test(u)) all.add(u.replace(TAB_SUFFIX, ""));
  // Keep one page per course across intake variants (the September intake when there is one).
  const byCourse = new Map<string, string>();
  for (const u of Array.from(all).sort()) {
    const course = u.replace(INTAKE_SUFFIX, "");
    const prev = byCourse.get(course);
    if (!prev || /september/i.test(u)) byCourse.set(course, u);
  }
  const sorted = Array.from(byCourse.values()).sort((a, b) => a.length - b.length || a.localeCompare(b));
  const groups: ProgrammeGroup[] = [];
  for (const u of sorted) {
    const parent = groups.find((g) => u.startsWith(g.base + "/"));
    if (!parent) {
      groups.push({ base: u, pages: [u] });
      continue;
    }
    const rest = u.slice(parent.base.length + 1);
    if (KEEP_SUBPAGE.test(rest) && parent.pages.length < 4) parent.pages.push(u);
  }
  return groups;
}
