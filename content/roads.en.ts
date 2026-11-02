import { msg } from "@/lib/i18n/translate";

// The roads on /move (components/landing/roads): Work, Study, Gap, one screen each. A screen shows the
// road's first card (its one big number), its line and "Read more"; the drawer holds the other cards, the
// note, the extras and any further groups. Gap now carries Qualify's content (KHEA, ACCA, CFA), and its
// own pass windows went into its drawer; the QUALIFY constant stays for a rollback.
// Every string is a translation key (lib/i18n: keys are the English text), word for word from the
// checked four-roads content (scratchpad four-roads/<road>.content-v2.json, 2026-10-26). Every figure
// carries its receipts (lib/home/receipts.ts); a part with no receipt is shown as "Still to check".
// Labels stay at 30 characters or fewer.

export type RoadId = "work" | "study" | "qualify" | "gap";

/** A part of a card that has no receipt that settles it yet: shown as "{label}: Still to check". */
export type RoadStill = { label: string; receipts: string[] };

/** A figure with its label and receipts. On /move a road's first card is its screen's big number. */
export type RoadCard = {
  /** The figure. A trailing "(…)" is shown smaller, as on the prototypes. */
  value: string;
  sub?: string;
  label: string;
  receipts: string[];
  stillToCheck?: RoadStill;
};

/** A figure under the extras disclosure in the text column. */
export type RoadFigure = { label: string; value: string; sub?: string; receipts: string[] };

/** One line of the extras disclosure. */
export type RoadExtra = {
  label: string;
  value?: string;
  sub?: string;
  detail?: string;
  /** Shown in bold after detail (what the visitor still adds). */
  add?: string;
  figure?: RoadFigure;
  href?: string;
  receipts: string[];
  /** Not shown until this is true (a count still to confirm against the live data). */
  blockedUntil?: string;
};

/** A one-line rule under the road's line. `own` marks Kaplan 360++'s own rule, not an official one. */
export type RoadNote = { text: string; receipts: string[]; own?: boolean };

export type Road = {
  id: RoadId;
  /** "Road N · Word". */
  eyebrow: string;
  title: string;
  line: string;
  lineReceipts?: string[];
  /** The first is the big number on the road's screen; the rest are in its drawer. */
  cards: RoadCard[];
  /** More cards in the drawer, under their own heading. */
  groups?: { title: string; cards: RoadCard[] }[];
  /** The extras' heading; its count is added when shown. */
  extrasTitle?: string;
  extras: RoadExtra[];
  note?: RoadNote;
  /** The old cards' link (RoadSection, kept for a rollback). /move's roads have none. */
  link?: { label: string; href: string };
  /** What the content check left open. For the team, not shown on the page. */
  stillToCheck: string[];
};

const WORK: Road = {
  id: "work",
  eyebrow: msg("Road 1 · Work"),
  title: msg("Work"),
  line: msg("Three roles MOM lists in demand: what each asks, and what you still add."),
  lineReceipts: ["mom-jid25-in-demand"],
  cards: [
    { value: "77.3% (2024/25)", label: msg("Kaplan grads who secured a job"), receipts: ["kaplan-ges-2024-25"] },
    // The official sentence says only "from $5,600 to $6,000": no sector, no year on the label.
    { value: "S$6,000", label: msg("EP minimum qualifying salary"), receipts: ["ep-2027"] },
    { value: "79.6% (2025)", label: msg("Vacancies not led by quals"), receipts: ["mom-jv25-skills-over-quals"] },
  ],
  extrasTitle: msg("Roles in demand"),
  extras: [
    {
      label: msg("Software developer"),
      detail: msg("Asks software development."),
      add: msg("Add: AI-enabled tools"),
      figure: { label: msg("Gross median, all ages"), value: "S$7,808", sub: msg("Full-time residents, June 2025"), receipts: ["mom-ows-software-developer"] },
      // The old /careers/software-engineer is now this role page (next.config.ts 308s the old address).
      href: "/careers/roles/software-engineer",
      receipts: ["mom-jid25-in-demand", "mom-jv25-core-skills", "mom-jv25-ai-tools", "mom-ows-software-developer"],
    },
    {
      label: msg("Data scientist"),
      detail: msg("Asks data analytics."),
      add: msg("Add: specialised skills + exp"),
      figure: { label: msg("Gross median, all ages"), value: "S$10,111", sub: msg("Full-time residents, June 2025"), receipts: ["mom-ows-data-scientist"] },
      // The old /careers/data-analyst-scientist (S$5,869 data-analyst row; S$10,111 Data scientist row) is now
      // this role page, its nearest new role (next.config.ts 308s the old address).
      href: "/careers/roles/data-analyst-associate-data-engineer",
      receipts: ["mom-jid25-in-demand", "mom-jv25-core-skills", "mom-jv25-hard-to-fill", "mom-ows-data-scientist"],
    },
    {
      label: msg("Auditor"),
      detail: msg("Asks audit/assurance standards"),
      add: msg("Add: data analytics"),
      figure: { label: msg("Gross median, all ages"), value: "S$5,750", sub: msg("Full-time residents, June 2025"), receipts: ["mom-ows-auditor"] },
      // No auditor entry in data/raw/careers.json, so no /careers link.
      receipts: ["mom-jid25-in-demand", "sfw-audit-associate", "sfw-audit-associate-data", "mom-ows-auditor"],
    },
  ],
  note: { text: msg("An EP needs 40 COMPASS points."), receipts: ["compass-40"] },
  stillToCheck: [
    "Openings open to international graduates (EP / S Pass) per role: no official count found; MOM's 32,500 counts only jobs advertised to local job seekers.",
    "Fresh-graduate starting pay per role: MOM OWS medians cover full-time resident employees of every age, labelled 'Gross median, all ages' (full-time residents).",
    "COMPASS C1 salary benchmark by sector (Financial Services vs ICT) for these roles: not in repo, not crawled.",
    "capture.ts photographs live HTML and reads PDFs as text; it has no path for .xlsx rows. The five captureMode 'dataset-row' receipts need either an xlsx check in capture.ts or a 'dataset' label on the receipt card (as employment.json's verbatimQuote).",
    "Study block shows all-PEI S$3,500 (ges-salary); Work chip 1 shows Kaplan's own 77.3%. Label each chip 'Kaplan' or 'all private schools' so they read apart.",
    "Auditor has no /careers entry; homepage and /careers differ on that role until one is added.",
    "receipt-shots.json has no capture for any receiptsNew id; run scripts/receipts/capture.ts before step 6.",
  ],
};

const STUDY: Road = {
  id: "study",
  eyebrow: msg("Road 2 · Study"),
  title: msg("Study"),
  line: msg("Step up to a ranked campus and more work-pass points."),
  cards: [
    { value: "88.9% · 78.9%", label: msg("Secured a job: AU · PEI"), receipts: ["swda-ges-secured"] },
    { value: "S$4,500 · S$3,500", label: msg("Start pay: AU 2025 · PEI 24/25"), receipts: ["au-2025-salary", "ges-salary"] },
    { value: "20 vs 10", label: msg("EP points: QS top-100 degree"), receipts: ["c2-top100", "c2-pei", "compass-40"] },
  ],
  extrasTitle: msg("More figures"),
  extras: [
    { label: msg("Australia: postgrad pay"), value: "A$104,700 vs A$77,000", sub: msg("Postgrad coursework vs undergrad, domestic, 2025"), receipts: ["qilt-pgc-salary"] },
    { label: msg("Employed at 9 mo, Ireland"), value: "86.6% vs 74.9%", sub: msg("Postgrad taught vs honours bachelor's, Class of 2024"), receipts: ["hea-pgt-employed", "hea-hdeg-employed"] },
    { label: msg("NUS: QS 2027"), value: "#10", receipts: ["nus-qs-2027"] },
    {
      label: msg("Master's examples, QS 2027"),
      value: "Monash #31 · UCD =100",
      sub: msg("Monash in Australia; UCD taught at Kaplan Singapore. Both in MOM's QS top-100 tier. For a Kaplan-taught UCD degree, Kaplan 360++ reads C2 points from the awarding university: 20 points."),
      receipts: ["qs-2027-monash", "qs-2027-ucd", "c2-top100"],
    },
    {
      label: msg("2,737 master's at QS top-100"),
      value: msg("49 universities"),
      sub: msg("Of 7,948 at 176 tier-1 universities. Kaplan 360++'s own count."),
      receipts: [],
      blockedUntil: "Live Supabase count on /results matches 2,737 / 7,948",
    },
  ],
  stillToCheck: [
    "Singapore master's start pay: no official survey found. MOE GES and JAUGES cover fresh bachelor's graduates only (searched 2026-10-26). Australia (QILT) and Ireland (HEA) shown instead, countries labelled.",
    "Singapore master's employment rate: no official survey found (same search). Ireland (HEA) shown instead.",
    "C2 points for a PEI-taught degree from a QS top-100 awarder: MOM does not say in words. Kaplan 360++ reads it from the awarding university (20 points), as stated in lib/next-steps/tree.ts; the partners extra carries that statement.",
    "Programme counts 2,737 / 7,948 (49 / 176 universities) come from data/raw JSON; /results reads Supabase. Confirm the live count before showing the line.",
    "receipt-shots.json has no capture for nus-qs-2027, qs-2027-monash or qs-2027-ucd; run scripts/receipts/capture.ts before step 6.",
    "QILT 'postgraduate coursework' scope (master's share vs graduate certificates/diplomas): the 2025 GOS National Report does not define it in its text; the extra is labelled 'postgrad', not 'master's'.",
    "AU 'secured employment' timing: the SWDA page states 'within six months' for PEI graduates only; the AU 2025 figure is labelled by year, not by months.",
  ],
};

const QUALIFY: Road = {
  id: "qualify",
  eyebrow: msg("Road 3 · Qualify"),
  title: msg("Qualify"),
  line: msg("Stack proof as you go: a school award, a skills exam, a professional body."),
  cards: [
    { value: "S$10,000", label: msg("KHEA, first in cohort"), receipts: ["khea"] },
    { value: msg("4, up to 9"), label: msg("Murdoch: ACCA exemptions"), receipts: ["acca-murdoch", "acca-faq"] },
    { value: msg("Up to 23 months"), label: msg("CFA L1 before graduation"), receipts: ["cfa-policy"] },
  ],
  extrasTitle: msg("Kinds of proof"),
  extras: [
    {
      label: msg("In-school awards"),
      detail: msg("KHEA top 3: S$5,000 to S$10,000, if you continue full-time at Kaplan. Needs over 90% attendance, first-time passes, an 85 average (diploma) or 80 (degree)."),
      receipts: ["khea"],
    },
    { label: msg("External skills proof"), detail: msg("AWS Cloud Practitioner: 90 min, 65 questions, US$100"), receipts: ["aws-ccp"] },
    {
      label: msg("Professional bodies"),
      detail: msg("Murdoch accounting: ISCA- and CPA Australia-accredited. Singapore CA: 3 years’ work, 450 days at an ATO."),
      receipts: ["isca-murdoch", "cpa-au-murdoch", "isca-pp"],
    },
  ],
  link: { label: msg("See the Qualifications road"), href: "/next-steps" },
  stillToCheck: [
    "Dean's List rules at Kaplan's partner universities: no Kaplan-run Dean's List found; Murdoch's Vice-Chancellor's Commendation does not say Singapore students are included.",
    "SkillsFuture Skills Framework job-role counts: skillsfuture.gov.sg/skills-framework pages now redirect or ask for login.",
    "SkillsFuture Credit: official page did not render for quoting; not shown.",
    "ACCA exemptions for Portsmouth BA AFM: authorised for graduates to 31 Dec 2026 only; the 2027 list does not name it. Check against certificates.json's Portsmouth acca entry and its 'authorised to' note.",
  ],
};

const GAP: Road = {
  id: "gap",
  eyebrow: msg("Road 3 · Gap"),
  title: msg("Gap"),
  line: msg("Stack proof as you go: a KHEA award, ACCA exemptions, CFA Level 1."),
  // Qualify's three cards, word for word: KHEA is the screen's number.
  cards: QUALIFY.cards,
  // The old Gap cards: a Kaplan student in a gap has no work-pass exemption (MOM, ICA).
  groups: [
    {
      title: msg("Your pass in a gap"),
      cards: [
        {
          value: msg("Apply new pass 4+ weeks ahead"),
          label: msg("Window 1: diploma → degree"),
          receipts: ["stp-new-course"],
          stillToCheck: { label: msg("Max gap"), receipts: ["stp-end-visit"] },
        },
        { value: msg("1-year pass: IHLs, not Kaplan"), label: msg("Window 2: after graduation"), receipts: ["ihl-ltvp-1yr", "ihl-list", "visit-89"] },
        { value: msg("Work needs a work pass"), label: msg("Kaplan student in a gap"), receipts: ["work-pq", "work-hours", "mom-pass-expires", "stp-cancel"] },
      ],
    },
  ],
  extrasTitle: msg("Kinds of proof"),
  extras: QUALIFY.extras,
  // Kaplan 360++'s own rule, not official: /plan shows the gap-internship item when the degree starts
  // 3 or more months after the diploma ends (lib/plan-timeline.ts gap-internship; lib/plan-road.ts "gap" stop).
  note: { text: msg("Our rule: 3+ months → intern"), receipts: [], own: true },
  stillToCheck: [
    "Max gap a Student's Pass allows between diploma and degree: ICA's PEI page and ask.gov.sg answers give no maximum. The official steps found: studies stop, cancel within 7 days (stp-cancel); a visit pass is possible (stp-end-visit, visit-89); new Student's Pass via the school at least 4 weeks before the new course (stp-new-course). Shown as 'Max gap: Still to check'.",
    "A one-year job-search window after graduation: ICA's 1-year LTVP covers IHLs only and Kaplan is not on the list. Not shown as a figure.",
    "/plan's 3-month gap threshold for an internship is Kaplan 360++'s own rule (ownRule), not official.",
    "Homepage alignment: old content.ts move 'fast' says a new pass is applied for two to three months before the next course (stp-apply). That window is for a first pass; a different course or PEI needs a new pass at least four weeks ahead (stp-new-course). Align the 'fast' copy if it stays live.",
  ],
};

/** In page order. Card ids are the road ids (#work, #study, #gap). */
export const ROADS: readonly Road[] = [WORK, STUDY, GAP];

/** The roads section on /move: its heading, for screen readers (01 Break it down names the three on screen). */
export const ROADS_SECTION = {
  headline: msg("Work. Study. Gap."),
};

/** Which side the art sits on from 900px: Work and Gap on the left, Study on the right, so the screens alternate. */
export const ART_SIDE: Record<RoadId, "left" | "right"> = { work: "left", study: "right", qualify: "left", gap: "left" };

/** Each road's accent, from the prototypes: `ink` for text on light ground, `mid` for pins and leader lines. */
export const ROAD_ACCENT: Record<RoadId, { ink: string; mid: string; light: string }> = {
  work: { ink: "#a4521c", mid: "#e3803a", light: "#f7c79a" },
  study: { ink: "#86600f", mid: "#dda634", light: "#f6dc8f" },
  qualify: { ink: "#963222", mid: "#d65a41", light: "#f4ae9c" },
  gap: { ink: "#8a6334", mid: "#c69a5c", light: "#ead0a4" },
};
