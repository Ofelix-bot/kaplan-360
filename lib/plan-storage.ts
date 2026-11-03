import { QS_STEPS } from "@/lib/results-types";

// The student's Start planning answers, kept only in this browser (never sent to the server).
// "Remember on this device" on: localStorage, cleared after 90 days without use.
// Off: sessionStorage, gone when the browser is closed. Every read and write is guarded: storage
// can be unavailable (private windows, blocked site data), and the form must still work.

export type PlanLevel = "diploma" | "degree";
export type StudentStatus = "student-pass" | "citizen-pr" | "other-pass";
/** Status in Singapore as /profile asks it: citizens and permanent residents apart. `status` above follows it. */
export type SgStatus = "citizen" | "pr" | "student-pass" | "other-pass";

export type Classification = "first" | "2:1" | "2:2" | "third" | "unsure";
export type EnglishTest = "ielts" | "toefl" | "pte" | "duolingo" | "none";
export type IntakeWindow = "jan-mar" | "jul-oct" | "any";

export type PlanAnswers = {
  level: PlanLevel | null;
  /** A Kaplan programme id, or "not-listed". */
  programmeId: string | null;
  graduationMonth: number | null; // 1–12
  graduationYear: number | null;
  status: StudentStatus | null;
  // /profile Part 1 (components/profile): graduated or still studying, the four-way status, nationality and year of birth.
  /** true: graduated (graduationMonth/Year is when); false: still studying (it is the expected month); null: not answered. */
  graduated: boolean | null;
  /** Always consistent with `status` (parsePlan fixes it when another page changed `status`). */
  sgStatus: SgStatus | null;
  /** ISO 3166-1 alpha-2 code ("SG" for citizens). */
  nationality: string | null;
  /** Asked only of Student's Pass and other pass holders: the Employment Pass salary floor rises with age. */
  birthYear: number | null;
  // Step 2: academics and tests
  /** Expected UK-style classification; asked only when the Kaplan degree is awarded by a UK or Irish university. */
  classification: Classification | null;
  englishTest: EnglishTest | null;
  englishScore: number | null;
  /** When the English test was taken (results are valid for two years from the test date). */
  englishTestMonth: number | null;
  englishTestYear: number | null;
  /** Degree students: expected average mark in % (Australian WAM, or a UK/Irish average), optional for class-based degrees. */
  averageMark: number | null;
  /** Degree students: expected GPA on their university's own scale (UCD 4.2; Murdoch and Monash 4). */
  degreeGpa: number | null;
  gre: number | null;
  gmat: number | null;
  /** Whether the student has a GRE or GMAT score (set on the results page): "none" leaves out programmes that require one. */
  greGmat: "have" | "none" | null;
  /** Full-time work experience (set on the results page): "none" leaves out programmes that ask for years of it. */
  workExperience: "have" | "none" | null;
  // Step 3: preferences
  /** Countries to include; empty means all. */
  countries: string[];
  intake: IntakeWindow | null;
  /** Most the student wants to pay in tuition a year, in S$; null means no limit. */
  budget: number | null;
  /** Programme ids the student starred on the results page. */
  shortlist: string[];
  /** Filter sets saved on the results page (up to five), restored with one click. */
  searches: SavedSearch[];
  /** Diploma students: the Kaplan degree they plan to take next (/pathway), used to match master's programmes. */
  pathwayDegreeId: string | null;
  /** Diploma students at another private school (/pathway): its id, their field (a Kaplan discipline) and diploma level. Null school = Kaplan. */
  school: string | null;
  schoolDiscipline: string | null;
  diplomaLevel: DiplomaLevel | null;
  // Where you stand (lib/stand): experience, and another private school's degree
  /** Years of full-time work by the start of the master's; null: not answered. */
  workYears: number | null;
  /** Internships in the degree's own field, and in other fields. */
  internshipsSame: number | null;
  internshipsOther: number | null;
  /** Research outputs (a paper, a thesis, a research assistantship), competition awards, and projects. */
  research: number | null;
  competitions: number | null;
  projects: number | null;
  /** Students at another private school: the university awarding their degree, its country, and whether it is an honours degree. */
  schoolAwarder: string | null;
  schoolAwarderCountry: string | null;
  schoolHonours: boolean | null;
  /** The year the student means to start the master's (Where you stand); null: not answered. */
  startYear: number | null;
  /** Goals added from Where you stand, shown on /plan as the student's own rows. */
  goals: PlanGoal[];
  // /careers (lib/careers/chips.ts): chips the student ticked. Unknown ids are dropped on read (knownChips).
  /** Professional certificates held (certificate chip ids, e.g. "acca-applied-knowledge"). */
  certificates: string[];
  /** Skills used in work, internships or study (skill chip ids, e.g. "python"). They count toward "n of m" (C5). */
  skillChips: string[];
  // /profile (components/profile): the student's own record, read by /careers' match (lib/careers/match.ts).
  /** Elective modules of the planned degree already taken (module names as the degree lists them). They count as covered skills. */
  electives: string[];
  /** Internships and full-time jobs, each with its months and the Skills Framework skills used there. The counts
   * above (internshipsSame, internshipsOther, workYears) follow these entries whenever /profile edits them. */
  experience: ExperienceEntry[];
  /** Key skills to close, added from a hot role's gap on /careers (components/careers/RoleGapPanel); /plan shows each as the student's own row. */
  skillGaps: SkillGap[];
  /** The Programme finder's six questions (/results, lib/finder/answers.ts); null until it is first answered. */
  finder: FinderAnswers | null;
  /** The plan the student chose on the AI adviser's roadmap step (components/adviser/roadmap.tsx); /plan shows its steps as the student's own rows. */
  roadmap: SavedRoadmap | null;
};

/** One of the adviser's three plans, as chosen: its dated steps (when: "YYYY-MM") and when it was chosen (ISO date). */
export type SavedRoadmap = { plan: "A" | "B" | "C"; title: string; steps: { when: string; lane: "education" | "career"; text: string }[]; savedAt: string };

/**
 * What the Programme finder asks beyond the answers above: the background chip, the degree's kind, the GPA as typed
 * on its scale (the result itself is also written to classification / averageMark / degreeGpa), up to three
 * master's directions, a fee band and the regions.
 */
export type FinderAnswers = {
  background: string | null;
  /** "honours" only in answers saved before 2026-11-02; lib/finder/answers.ts finderOf reads it as "bachelor". */
  kind: "diploma" | "bachelor" | "honours" | null;
  gpa: number | null;
  /** "4.0" | "4.2" | "4.3" | "5.0" | "100" | "uk" (a UK class, in classification). */
  scale: string | null;
  directions: string[];
  fee: "lt30" | "30-50" | "50-80" | "gt80" | null;
  regions: string[];
};

/**
 * A key skill a hot role asks for and the student lacks, added to the plan from /careers. `via` "kaplan": a Kaplan
 * module covers it (`module`, of the student's own degree when `own`); "outside": no Kaplan module does.
 */
export type SkillGap = { id: string; roleId: string; role: string; skill: string; level: number; via: "kaplan" | "outside"; module: string | null; own: boolean };

/** "internship-field": an internship in the degree's own field; "internship-other": in another field; "work": full-time work. */
export type ExperienceKind = "internship-field" | "internship-other" | "work";

/** One internship or job on /profile. `skills` are Skills Framework skill titles (the key skills /careers' roles ask for). */
export type ExperienceEntry = { id: string; kind: ExperienceKind; months: number | null; skills: string[] };

/**
 * A goal added from Where you stand (/where-you-stand): one of the index's levers (lib/stand/aggregate.ts),
 * the figure to reach and the date to reach it by. /plan shows it as a "Yours" row in the stop it serves.
 */
export type PlanGoal = {
  id: string;
  lever: "grade" | "ielts" | "internship" | "work" | "research" | "later";
  /** The figure to reach: the grade on its own scale, the IELTS band, the years of work, the start year; null for "one more". */
  target: number | null;
  /** The grade's scale: an Australian average (WAM), a UK or Irish average mark, a GPA out of `scale`, a class (`target` its UK mark: 70 a First, 60 a 2:1, 50 a 2:2), or a UK mark. */
  unit?: "wam" | "mark" | "gpa" | "class" | "uk";
  scale?: number | null;
  /** YYYY-MM-DD. */
  by: string;
  /** Why that date: 12 months before the start (Kaplan 360++'s rule), the graduation month, or the start itself. */
  rule: "before-start" | "graduation" | "start";
  /** The start it was worked out from, as a month number (year * 12 + month - 1). */
  start: number;
  /** Programmes it moved up a band or made eligible when it was added. */
  up: number;
};

export type DiplomaLevel = "diploma" | "advanced-diploma" | "higher-diploma";

/** One saved set of results filters: the field, where, the rank range, which universities, budget, start and order (not the student's own results). */
export type SavedSearch = {
  id: string;
  /** "" every field; "mine" the Kaplan degree's field or open to any subject; "any" open to any subject; or a field's id. */
  field: string;
  countries: string[];
  intake: IntakeWindow | null;
  budget: number | null;
  /** The QS rank range as indexes into QS_STEPS (lib/results-types.ts), and whether unranked universities count. */
  qsMin: number;
  qsMax: number;
  unranked: boolean;
  /** University names ("any of these"); empty means every university. */
  universities: string[];
  sort: "asia" | "qs" | "fee" | "fit";
};

/** Searches saved before 2026-10-22 had two groups and a QS band; they open as the nearest new search. */
type OldSearch = Partial<SavedSearch> & { group?: "field" | "any"; band?: string | null };
const LAST_QS = QS_STEPS.length - 1;
const BAND_RANGE: Record<string, [number, number]> = { "50": [0, 3], "100": [3, 5], "200": [5, 7], "500": [7, 10], more: [10, LAST_QS] };

function savedSearch(s: OldSearch): SavedSearch {
  const band = s.band ? BAND_RANGE[s.band] : undefined;
  return {
    id: s.id ?? Date.now().toString(36),
    field: s.field ?? (s.group === "any" ? "any" : "mine"),
    countries: s.countries ?? [],
    intake: s.intake ?? null,
    budget: s.budget ?? null,
    qsMin: s.qsMin ?? band?.[0] ?? 0,
    qsMax: s.qsMax ?? band?.[1] ?? LAST_QS,
    unranked: s.unranked ?? (band ? s.band === "more" : true),
    universities: s.universities ?? [],
    // The "Kaplan partners first" order is gone: searches saved with it open in the default order.
    sort: !s.sort || (s.sort as string) === "partner" ? "fit" : s.sort,
  };
}

/** `example`: the example student (lib/personas.ts) shown in place of the visitor's own answers. */
export type StoredPlan = { answers: PlanAnswers; remember: boolean; savedAt: number; example?: string };

export const EMPTY_ANSWERS: PlanAnswers = {
  level: null,
  programmeId: null,
  graduationMonth: null,
  graduationYear: null,
  status: null,
  graduated: null,
  sgStatus: null,
  nationality: null,
  birthYear: null,
  classification: null,
  englishTest: null,
  englishScore: null,
  englishTestMonth: null,
  englishTestYear: null,
  averageMark: null,
  degreeGpa: null,
  gre: null,
  gmat: null,
  greGmat: null,
  workExperience: null,
  countries: [],
  intake: null,
  budget: null,
  shortlist: [],
  searches: [],
  pathwayDegreeId: null,
  school: null,
  schoolDiscipline: null,
  diplomaLevel: null,
  workYears: null,
  internshipsSame: null,
  internshipsOther: null,
  research: null,
  competitions: null,
  projects: null,
  schoolAwarder: null,
  schoolAwarderCountry: null,
  schoolHonours: null,
  startYear: null,
  goals: [],
  certificates: [],
  skillChips: [],
  electives: [],
  experience: [],
  skillGaps: [],
  finder: null,
  roadmap: null,
};

const KEY = "kaplan360:plan";
/** An example student opened for this browser session (sessionStorage): shown instead of the visitor's own
 * answers, which stay untouched until the example is closed (or the browser is). */
const EXAMPLE = "kaplan360:example";
const EVENT = "kaplan360:plan-change";
export const MAX_AGE_DAYS = 90;
const MAX_AGE_MS = MAX_AGE_DAYS * 86_400_000;

function store(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function read(kind: "local" | "session"): string | null {
  try {
    return store(kind)?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

function expired(raw: string): boolean {
  try {
    return Date.now() - (JSON.parse(raw) as { savedAt: number }).savedAt > MAX_AGE_MS;
  } catch {
    return true;
  }
}

function readExample(): string | null {
  try {
    return window.sessionStorage.getItem(EXAMPLE);
  } catch {
    return null;
  }
}

/** The stored plan as a string (stable between renders), or null. Remembered plans past 90 days count as gone. */
export function getPlanSnapshot(): string | null {
  const example = readExample();
  if (example) return `example:${example}`;
  const local = read("local");
  if (local && !expired(local)) return `local:${local}`;
  const session = read("session");
  return session ? `session:${session}` : null;
}

export function getServerPlanSnapshot(): string | null {
  return null;
}

export function parsePlan(snapshot: string | null): StoredPlan | null {
  if (!snapshot) return null;
  const [kind, ...rest] = snapshot.split(":");
  try {
    const data = JSON.parse(rest.join(":")) as { answers: PlanAnswers; savedAt: number; id?: string };
    const answers = { ...EMPTY_ANSWERS, ...data.answers };
    answers.searches = (answers.searches as OldSearch[]).map(savedSearch);
    // Answers saved before the years were asked: "no full-time work" is 0 years.
    if (answers.workYears === null && answers.workExperience === "none") answers.workYears = 0;
    // Answers saved before /careers' chips: none ticked.
    if (!Array.isArray(answers.certificates)) answers.certificates = [];
    if (!Array.isArray(answers.skillChips)) answers.skillChips = [];
    // Answers saved before /profile: no electives; internships and work as counts only.
    if (!Array.isArray(answers.electives)) answers.electives = [];
    answers.experience = withCountedEntries(answers);
    // Answers saved before the hot roles' gaps could be added: none.
    answers.skillGaps = Array.isArray(answers.skillGaps) ? answers.skillGaps.filter(isSkillGap) : [];
    // Answers saved before the adviser's roadmap step: no chosen plan.
    answers.roadmap = savedRoadmap(answers.roadmap);
    // Answers saved before /profile asked the four-way status, or whose status another page changed since.
    answers.sgStatus = sgStatusOf(answers.status, answers.sgStatus);
    return { answers, remember: kind === "local", savedAt: data.savedAt, ...(kind === "example" ? { example: data.id } : {}) };
  } catch {
    return null;
  }
}

/** The four-way status that agrees with `status`: a citizen-or-PR answer saved before it was asked stays unknown. */
function sgStatusOf(status: StudentStatus | null, sg: SgStatus | null): SgStatus | null {
  if (status === "citizen-pr") return sg === "citizen" || sg === "pr" ? sg : null;
  return status;
}

/** The answers that choosing a status sets: `status` along with it, and Singapore as a citizen's nationality. */
export function statusPatch(sg: SgStatus, answers: Pick<PlanAnswers, "nationality">): Partial<PlanAnswers> {
  const status: StudentStatus = sg === "citizen" || sg === "pr" ? "citizen-pr" : sg;
  if (sg === "citizen") return { sgStatus: sg, status, nationality: "SG" };
  // Leaving "Citizen" unlocks the nationality; Singapore stays only if they pick it again.
  return { sgStatus: sg, status, ...(answers.nationality === "SG" ? { nationality: null } : {}) };
}

const EXPERIENCE_KINDS: readonly ExperienceKind[] = ["internship-field", "internship-other", "work"];

function isSkillGap(g: unknown): g is SkillGap {
  const x = g as Partial<SkillGap> | null;
  return (
    !!x &&
    typeof x === "object" &&
    typeof x.id === "string" &&
    typeof x.roleId === "string" &&
    typeof x.role === "string" &&
    typeof x.skill === "string" &&
    typeof x.level === "number" &&
    (x.via === "kaplan" || x.via === "outside") &&
    (x.module === null || typeof x.module === "string") &&
    typeof x.own === "boolean"
  );
}

/** A chosen plan as saved, or null for anything else: a plan id, a title, 1 to 6 dated steps with a lane and a line. */
function savedRoadmap(v: unknown): SavedRoadmap | null {
  if (!v || typeof v !== "object") return null;
  const x = v as Record<string, unknown>;
  const plan = x.plan === "A" || x.plan === "B" || x.plan === "C" ? x.plan : null;
  const steps = Array.isArray(x.steps)
    ? x.steps
        .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
        .filter((s) => typeof s.when === "string" && /^\d{4}-\d{2}$/.test(s.when) && (s.lane === "education" || s.lane === "career") && typeof s.text === "string" && !!s.text.trim())
        .slice(0, 6)
        .map((s) => ({ when: s.when as string, lane: s.lane as "education" | "career", text: (s.text as string).slice(0, 240) }))
    : [];
  if (!plan || typeof x.title !== "string" || !x.title.trim() || !steps.length) return null;
  return { plan, title: x.title.slice(0, 90), steps, savedAt: typeof x.savedAt === "string" ? x.savedAt.slice(0, 10) : "" };
}

function cleanEntry(e: unknown): ExperienceEntry | null {
  const x = e as Partial<ExperienceEntry> | null;
  if (!x || typeof x !== "object" || typeof x.id !== "string" || !EXPERIENCE_KINDS.includes(x.kind as ExperienceKind)) return null;
  const months = typeof x.months === "number" && Number.isFinite(x.months) && x.months > 0 ? x.months : null;
  return { id: x.id, kind: x.kind as ExperienceKind, months, skills: Array.isArray(x.skills) ? x.skills.filter((s): s is string => typeof s === "string") : [] };
}

/**
 * The stored entries, plus an entry without months or skills for each internship or year of work the counts
 * hold beyond them: the counts can be set elsewhere (answers saved before /profile, Where you stand's "Use
 * these as my answers", /results' work filter). Worked out on every read, with fixed ids, and saved only
 * when /profile edits the entries.
 */
function withCountedEntries(a: PlanAnswers): ExperienceEntry[] {
  const entries = (Array.isArray(a.experience) ? a.experience : []).map(cleanEntry).filter((e): e is ExperienceEntry => e !== null);
  const has = experienceCounts(entries);
  const out = [...entries];
  for (let i = has.internshipsSame; i < (a.internshipsSame ?? 0); i++) out.push({ id: `counted-field-${i}`, kind: "internship-field", months: null, skills: [] });
  for (let i = has.internshipsOther; i < (a.internshipsOther ?? 0); i++) out.push({ id: `counted-other-${i}`, kind: "internship-other", months: null, skills: [] });
  const workMonths = entries.reduce((n, e) => n + (e.kind === "work" ? (e.months ?? 0) : 0), 0);
  // Compared as years (one decimal, as experienceCounts rounds), so the rounding alone never adds an entry.
  const missing = Math.round((a.workYears ?? 0) * 12 - workMonths);
  if ((a.workYears ?? 0) > has.workYears && missing > 0) out.push({ id: "counted-work", kind: "work", months: missing, skills: [] });
  return out;
}

/** The counts Where you stand and /careers read, from the entries: internships by field, and years of work (months / 12, one decimal). */
export function experienceCounts(entries: readonly ExperienceEntry[]): { internshipsSame: number; internshipsOther: number; workYears: number } {
  let same = 0;
  let other = 0;
  let months = 0;
  for (const e of entries) {
    if (e.kind === "internship-field") same++;
    else if (e.kind === "internship-other") other++;
    else months += e.months ?? 0;
  }
  return { internshipsSame: same, internshipsOther: other, workYears: Math.round((months / 12) * 10) / 10 };
}

/** Also removes a remembered plan that has expired, so it doesn't linger on the device. */
export function subscribePlan(onChange: () => void): () => void {
  const local = read("local");
  if (local && expired(local)) {
    try {
      store("local")?.removeItem(KEY);
    } catch {}
  }
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onChange);
  };
}

/** Saves to one storage and removes any copy from the other (while an example is open, to the example).
 * Returns false when storage is unavailable. */
export function savePlan(answers: PlanAnswers, remember: boolean): boolean {
  const value = JSON.stringify({ answers, savedAt: Date.now() });
  let ok = false;
  const example = readExample();
  if (example) {
    try {
      window.sessionStorage.setItem(EXAMPLE, JSON.stringify({ ...JSON.parse(example), answers, savedAt: Date.now() }));
      ok = true;
    } catch {}
    window.dispatchEvent(new Event(EVENT));
    return ok;
  }
  try {
    store(remember ? "local" : "session")?.setItem(KEY, value);
    ok = read(remember ? "local" : "session") === value;
    store(remember ? "session" : "local")?.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
  return ok;
}

/** "Clear my answers": while an example is open, that closes it and the visitor's own answers come back. */
export function clearPlan() {
  if (readExample()) return closeExample();
  for (const kind of ["local", "session"] as const) {
    try {
      store(kind)?.removeItem(KEY);
    } catch {}
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Opens an example student for this browser session, without touching the visitor's own answers. */
export function openExample(id: string, answers: PlanAnswers): boolean {
  let ok = false;
  try {
    window.sessionStorage.setItem(EXAMPLE, JSON.stringify({ id, answers, savedAt: Date.now() }));
    ok = readExample() !== null;
  } catch {}
  window.dispatchEvent(new Event(EVENT));
  return ok;
}

/** Back to the visitor's own answers (or none). */
export function closeExample() {
  try {
    window.sessionStorage.removeItem(EXAMPLE);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/** The Kaplan degree that master's programmes are matched to: the one studied now, or for a diploma student the one planned next (/pathway). */
export function plannedDegree(a: PlanAnswers): string | null {
  return a.level === "degree" ? a.programmeId : a.level === "diploma" ? a.pathwayDegreeId : null;
}

/**
 * The answers patch for picking one of the 56 bachelor's degrees (/careers' DegreePicker). A diploma student
 * picks the degree they move on to, so it goes into pathwayDegreeId and their level stays "diploma" (review A,
 * Q4); anyone else picks the degree they study: programmeId, with level "degree" only when not answered yet.
 */
export function degreeChoice(a: PlanAnswers, programmeId: string): Partial<PlanAnswers> {
  return a.level === "diploma" ? { pathwayDegreeId: programmeId } : { programmeId, ...(a.level === null ? { level: "degree" as const } : {}) };
}
