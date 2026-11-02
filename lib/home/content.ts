import { msg } from "@/lib/i18n/translate";

// The homepage's sections below the hero: what a Singapore private-school student finds out too late,
// each with the official sentence it rests on (lib/home/receipts.ts). "Student’s Pass" and "Singaporean
// or PR" see different rules and moves; the hero's level and the course end month shape the clock.

/** Who a rule or move is for: on a Student’s Pass, or Singaporean / PR. */
export type Residency = "student-pass" | "local";

export type Verdict = "meets" | "fails" | "check" | "neutral";

export type RuleFigure =
  | { type: "bars"; max: number; bars: { label: string; value: number; display: string; tone: "muted" | "warning" | "fails" }[] }
  | { type: "versus"; neutral?: boolean; you: { value: string; label: string }; them: { value: string; label: string } }
  | { type: "ladder"; need: number; steps: { points: number; label: string }[] }
  | { type: "verdict"; verdict: Verdict; label: string };

export type RuleIcon = "trending" | "briefcase" | "calendar-x" | "shield" | "building" | "graduation" | "landmark" | "school" | "coins";

export type Rule = {
  id: string;
  audience: Residency[];
  /** Takes two columns in the grid. */
  wide?: boolean;
  icon: RuleIcon;
  tag: string;
  title: string;
  body: string;
  figure: RuleFigure;
  receipts: string[];
};

export const RULES: Rule[] = [
  {
    id: "salary-bar",
    audience: ["student-pass"],
    wide: true,
    icon: "trending",
    tag: msg("Staying to work"),
    title: msg("The salary bar is moving up."),
    body: msg("To work here after you graduate you need an Employment Pass. Its minimum for new applications rises in January 2027, well above what private-school graduates earn in their first job."),
    figure: {
      type: "bars",
      max: 6000,
      bars: [
        { label: msg("Median first salary, private-school degree graduates (2024/25)"), value: 3500, display: "S$3,500", tone: "muted" },
        { label: msg("Employment Pass minimum at age 23, today"), value: 5600, display: "S$5,600", tone: "warning" },
        { label: msg("Employment Pass minimum at age 23, new applications from Jan 2027"), value: 6000, display: "S$6,000", tone: "fails" },
      ],
    },
    receipts: ["ges-salary", "ep-2027"],
  },
  {
    id: "no-work",
    audience: ["student-pass"],
    icon: "briefcase",
    tag: msg("While you study"),
    title: msg("You can’t take a part-time job."),
    body: msg("Students at schools on MOM’s list can work up to 16 hours a week in term. Kaplan isn’t on the list, so any job needs a work pass. MOM and ICA acted against 73 pass holders for illegal work in 2016 to 2020."),
    figure: { type: "versus", you: { value: "0 h", label: msg("Kaplan students") }, them: { value: "16 h", label: msg("Listed schools, per week") } },
    receipts: ["work-hours", "work-pq"],
  },
  {
    id: "no-ltvp",
    audience: ["student-pass"],
    icon: "calendar-x",
    tag: msg("After graduation"),
    title: msg("No one-year pass to look for a job."),
    body: msg("Graduates of the institutions on ICA’s list can stay a year to find work. Kaplan isn’t on it. Your Student’s Pass ends with your course; after that, ICA’s answer names a short-term visit pass of up to 89 days."),
    figure: { type: "versus", you: { value: msg("89 d"), label: msg("Kaplan graduates, at most") }, them: { value: msg("1 yr"), label: msg("ICA-listed institutions") } },
    receipts: ["ihl-list", "visit-89"],
  },
  {
    id: "murdoch",
    audience: ["student-pass", "local"],
    icon: "shield",
    tag: msg("Admissions"),
    title: msg("Your own university can turn you away."),
    body: msg("Murdoch’s Master of Professional Accounting doesn’t consider accounting majors from Australian universities. That includes Murdoch accounting graduates who studied at Kaplan."),
    figure: { type: "verdict", verdict: "fails", label: msg("Not eligible") },
    receipts: ["murdoch"],
  },
  {
    id: "aston",
    audience: ["student-pass"],
    icon: "building",
    tag: msg("Admissions"),
    title: msg("Taught at Kaplan doesn’t mean open to you."),
    body: msg("Aston’s MSc Strategic Financial Management at Kaplan runs part-time, labelled for local applicants, and its fee table has no Student’s Pass. A Student’s Pass is for full-time study."),
    figure: { type: "verdict", verdict: "check", label: msg("Local applicants") },
    receipts: ["aston-kaplan"],
  },
  {
    id: "aston-local",
    audience: ["local"],
    icon: "building",
    tag: msg("Admissions"),
    title: msg("A master’s you can take while you work."),
    body: msg("Aston’s MSc Strategic Financial Management at Kaplan runs part-time for local applicants, so you can keep a full-time job and finish in 12 months."),
    figure: { type: "verdict", verdict: "meets", label: msg("Open to you") },
    receipts: ["aston-kaplan"],
  },
  {
    id: "compass",
    audience: ["student-pass"],
    wide: true,
    icon: "graduation",
    tag: msg("Qualifications"),
    title: msg("A diploma scores zero. A top-100 master’s scores 20."),
    body: msg("Employment Pass applications are scored with COMPASS, which needs 40 points in total. Qualifications are one of the four criteria, and a private-school degree counts only if the awarding university is recognised by UK ENIC."),
    figure: {
      type: "ladder",
      need: 40,
      steps: [
        { points: 0, label: msg("Private-school diploma") },
        { points: 10, label: msg("Degree from a partner university") },
        { points: 20, label: msg("Degree-equivalent from a QS top-100 university") },
      ],
    },
    receipts: ["c2-diploma", "c2-pei"],
  },
  {
    id: "cscse",
    audience: ["student-pass"],
    icon: "landmark",
    tag: msg("Going home · China"),
    title: msg("Recognition at home can stall."),
    body: msg("China’s CSCSE recognises Singapore private-school degrees from a list of school and university pairs. Reports say the list stopped updating on 31 Dec 2024, and a newer notice is out. A counsellor reads these by hand."),
    figure: { type: "verdict", verdict: "check", label: msg("Checked by a person") },
    receipts: ["cscse", "cpe-ssg"],
  },
  {
    id: "edinburgh",
    audience: ["local"],
    icon: "school",
    tag: msg("Admissions"),
    title: msg("Top universities read private degrees differently."),
    body: msg("Edinburgh’s Singapore page asks for an Honours degree from a recognised institution, and converts NUS and NTU grades more generously than other institutions’."),
    figure: { type: "verdict", verdict: "check", label: msg("Check each university") },
    receipts: ["edinburgh"],
  },
  {
    id: "monash-cost",
    audience: ["local"],
    icon: "coins",
    tag: msg("Money"),
    title: msg("The yearly fee isn’t the price."),
    body: msg("Monash’s Master of Banking and Finance is A$62,140 a year in 2027 and lasts 1, 1.5 or 2 years depending on your degree. The same course can cost twice as much for two students."),
    figure: { type: "versus", neutral: true, you: { value: msg("1 yr"), label: msg("Related honours degree") }, them: { value: msg("2 yrs"), label: msg("Degree in any field") } },
    receipts: ["monash-fee"],
  },
];

/**
 * Fine print: Arjun's three programmes, as a filter on fee and entry fields sees them and as the official
 * page puts it. A filter shows a programme when its yearly fee (S$, approximate) is within the budget.
 */
export type FinePrintRow = {
  id: string;
  programme: string;
  /** The programme's Chinese name (data/raw/chinese-names.json: translations, not the universities' own). */
  zh: { hans: string; hant: string; official: boolean };
  university: string;
  /** Where it's taught, when not at the university. */
  campus?: string;
  /** What the filter checks besides the fee. */
  filterChecks: string[];
  /** Yearly fee in S$ as a filter would read it, with how it was shown on the page. */
  fee: { sgd: number; shown: string; approx: boolean } | null;
  official: { verdict: Verdict; label: string; quote: string; mark: string[]; receipt: string };
};

/** A$ to S$, MAS end-of-month rate (data/raw/fx-mas.json, Sep 2026). */
export const AUD_SGD = 0.8907;

export const FINE_PRINT: FinePrintRow[] = [
  {
    id: "murdoch",
    programme: "Master of Professional Accounting",
    zh: { hans: "专业会计硕士", hant: "專業會計碩士", official: false },
    university: "Murdoch University",
    campus: msg("Perth"),
    filterChecks: [msg("Bachelor’s degree"), msg("IELTS 6.0")],
    fee: null,
    official: { verdict: "fails", label: msg("Not eligible"), quote: "…with an accounting major from an Australian university will not be considered", mark: ["will not be considered"], receipt: "murdoch" },
  },
  {
    id: "aston",
    programme: "MSc Strategic Financial Management",
    zh: { hans: "战略财务管理理学硕士", hant: "戰略財務管理理學碩士", official: false },
    university: "Aston University",
    campus: msg("at Kaplan Singapore"),
    filterChecks: [msg("Degree in any discipline")],
    fee: { sgd: 24852, shown: "S$24,852", approx: false },
    official: { verdict: "check", label: msg("Kaplan’s page: local applicants only"), quote: "Local Applicants only", mark: ["Local Applicants only"], receipt: "aston-kaplan" },
  },
  {
    id: "monash",
    programme: "Master of Banking and Finance",
    zh: { hans: "银行与金融硕士", hant: "銀行與金融碩士", official: false },
    university: "Monash University",
    campus: msg("Melbourne"),
    filterChecks: [],
    fee: { sgd: Math.round(62140 * AUD_SGD), shown: "A$62,140", approx: true },
    official: { verdict: "meets", label: msg("Can apply"), quote: "The fees for 2027 are: A$62,140", mark: ["A$62,140"], receipt: "monash-fee" },
  },
];

export const ARJUN_BUDGET = 45000;

export type PriorityId = "stay" | "cost" | "home" | "rank" | "fast";

export type Move = { title: string; body: string; receipts: string[]; cta: { label: string; href: string } };

export type Priority = {
  id: PriorityId;
  label: Record<Residency, string>;
  hint: Record<Residency, string>;
  move: Record<Residency, Move>;
};

export const DEFAULT_PRIORITIES: PriorityId[] = ["stay", "cost", "home", "rank", "fast"];

const sameForBoth = <T>(v: T): Record<Residency, T> => ({ "student-pass": v, local: v });

export const PRIORITIES: Record<PriorityId, Priority> = {
  stay: {
    id: "stay",
    label: { "student-pass": msg("Stay and work in Singapore"), local: msg("Keep working while I study") },
    hint: { "student-pass": msg("Get a job here after I graduate"), local: msg("No gap in my salary") },
    move: {
      "student-pass": {
        title: msg("Check the Employment Pass maths before you choose"),
        body: msg("New applications from January 2027 need at least S$6,000 a month at age 23. A partner-university degree earns 10 qualification points; a QS top-100 university earns 20."),
        receipts: ["ep-2027", "c2-pei"],
        cta: { label: msg("Careers that clear the bar"), href: "/careers" },
      },
      local: {
        title: msg("Shortlist part-time master’s first"),
        body: msg("Some programmes taught at Kaplan run part-time for local applicants. Aston’s MSc Strategic Financial Management finishes in 12 months alongside a job."),
        receipts: ["aston-kaplan"],
        cta: { label: msg("See programmes"), href: "/results" },
      },
    },
  },
  cost: {
    id: "cost",
    label: sameForBoth(msg("Lowest total cost")),
    hint: sameForBoth(msg("The whole course, not one year")),
    move: sameForBoth({
      title: msg("Compare total cost, not yearly fees"),
      body: msg("Course length depends on your degree. Monash’s Master of Banking and Finance is A$62,140 a year in 2027 and runs 1 to 2 years."),
      receipts: ["monash-fee"],
      cta: { label: msg("Compare programmes"), href: "/results" },
    }),
  },
  home: {
    id: "home",
    label: { "student-pass": msg("A degree my home country recognises"), local: msg("A degree employers here know") },
    hint: { "student-pass": msg("For jobs or settling back home"), local: msg("Names recruiters recognise") },
    move: {
      "student-pass": {
        title: msg("Check your exact degree on your home country’s list"),
        body: msg("Recognition lists name the awarding university and the school together. China’s CSCSE list for Singapore private schools has not been updated since 31 Dec 2024, by reports of its notice."),
        receipts: ["cscse", "cpe-ssg"],
        cta: { label: msg("Plan my path"), href: "/pathway" },
      },
      local: {
        title: msg("Check how each university reads your degree"),
        body: msg("Universities write separate rules for private-school degrees. Edinburgh asks for an Honours degree from a recognised institution and sets a higher grade bar for other institutions than for NUS and NTU."),
        receipts: ["edinburgh"],
        cta: { label: msg("See programmes"), href: "/results" },
      },
    },
  },
  rank: {
    id: "rank",
    label: sameForBoth(msg("A top-ranked university")),
    hint: sameForBoth(msg("QS top 100 or a name people know")),
    move: sameForBoth({
      title: msg("Check how each university reads a Kaplan degree"),
      body: msg("Edinburgh’s Singapore page asks for an Honours degree from a recognised institution and converts NUS and NTU grades on a separate scale."),
      receipts: ["edinburgh"],
      cta: { label: msg("See programmes"), href: "/results" },
    }),
  },
  fast: {
    id: "fast",
    label: sameForBoth(msg("No gap between courses")),
    hint: sameForBoth(msg("Start the next step straight away")),
    move: {
      "student-pass": {
        title: msg("Line up the next course with your pass"),
        body: msg("Your Student’s Pass ends with your course. A new one is applied for two to three months before the next course starts."),
        receipts: ["stp-apply", "visit-89"],
        cta: { label: msg("Plan my path"), href: "/pathway" },
      },
      local: {
        title: msg("Work back from the intake dates"),
        body: msg("Intakes are fixed. Monash’s Master of Banking and Finance starts in February, July and November, so pick the one that follows your last exam."),
        receipts: ["monash-intakes"],
        cta: { label: msg("Plan my path"), href: "/pathway" },
      },
    },
  },
};

/** Rule changes that decide who can stay, work or be recognised, newest first. */
export const RULES_ON_THE_MOVE: { date: string; title: string; receipts: string[]; ahead?: boolean }[] = [
  { date: "2027-01", title: msg("Employment Pass minimum rises to S$6,000 for new applications"), receipts: ["ep-2027"], ahead: true },
  { date: "2026-05", title: msg("CSCSE: certificates from cross-border remote study aren’t recognised"), receipts: ["cscse-remote"] },
  { date: "2024-12-31", title: msg("CSCSE stops updating its Singapore private-school list"), receipts: ["cscse"] },
  { date: "2024-10-01", title: msg("Singapore’s Committee for Private Education closes; SSG takes over"), receipts: ["cpe-ssg"] },
];

/** The example students' catches (lib/personas.ts has who they are and what they want). */
export const CATCHES: Record<string, { catch: string; receipts: string[] }> = {
  mei: { catch: msg("Her diploma alone earns no qualification points for a work pass, and moving on to a degree needs a new Student’s Pass."), receipts: ["c2-diploma", "stp-apply"] },
  arjun: { catch: msg("The Aston MSc at Kaplan is labelled for local applicants, and his Student’s Pass ends with his course: ICA’s answer names a visit pass of up to 89 days."), receipts: ["aston-kaplan", "visit-89"] },
  lin: { catch: msg("Whether a one-year top-up counts as a full honours degree depends on each programme’s wording. That question goes to a counsellor."), receipts: [] },
};

/** Monash's intakes (February, July, November), the example on the clock. */
export const EXAMPLE_INTAKE_MONTHS = [1, 6, 10];
/** Visit pass after the Student’s Pass: up to 89 days. */
export const VISIT_DAYS = 89;
/** New Employment Pass minimum from this month. */
export const EP_FROM = { year: 2027, month: 0 };
