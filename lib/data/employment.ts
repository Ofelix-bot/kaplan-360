// Curated graduate-outcome figures for the homepage. Every value comes from a
// record in data/raw/employment.json (see `rawId`), which holds the source URL
// and the verbatim quote. Nothing here is estimated.

export interface SourceRef {
  name: string;
  url: string;
}

export const SOURCES = {
  pei2425: {
    name: "SWDA, PEI Graduate Employment Survey 2024/2025",
    url: "https://www.swda.gov.sg/home/skills-career-resources/private-education-resources/graduate-employment-survey/2024-2025",
  },
  pei2324: {
    name: "SSG, PEI Graduate Employment Survey 2023/2024",
    url: "https://www.swda.gov.sg/home/skills-career-resources/private-education-resources/graduate-employment-survey/2023-2024",
  },
  pei2223: {
    name: "SSG, PEI Graduate Employment Survey 2022/2023",
    url: "https://www.swda.gov.sg/home/skills-career-resources/private-education-resources/graduate-employment-survey/2022-2023",
  },
  pei2021: {
    name: "SSG, PEI Graduate Employment Survey 2020/2021",
    url: "https://www.swda.gov.sg/home/newsroom/about-1-in-2-pei-graduates-in-full-time-permanent-employment-months-after-graduation",
  },
  hea2024: {
    name: "Higher Education Authority, Graduate Outcomes 2024",
    url: "https://hea.ie/statistics/graduate-outcomes/key-findings-go-2024/",
  },
  qilt2025: {
    name: "QILT, 2025 Graduate Outcomes Survey",
    url: "https://www.qilt.edu.au/docs/default-source/default-document-library/2025-gos-national-report.pdf",
  },
} satisfies Record<string, SourceRef>;

export type GroupId = "pei" | "au" | "poly";

export const GROUPS: Record<GroupId, { label: string; short: string }> = {
  pei: { label: "Private institution (PEI) degree graduates", short: "Private degree" },
  au: { label: "Autonomous university graduates", short: "Public university" },
  poly: { label: "Post-National Service polytechnic graduates", short: "Polytechnic diploma" },
};

/** The homepage headline: median gross monthly salary, full-time permanent jobs. */
export const HEADLINE = {
  pei: { value: 3500, cohort: "2024/25", rawId: "sg-pei-2024-25-salary" },
  au: { value: 4500, cohort: "2025", rawId: "sg-au-2025-salary" },
  source: SOURCES.pei2425,
};

/**
 * Kaplan Higher Education Academy (Kaplan Singapore), from the PEI GES institution tables
 * (records sg-kaplan-2022-23, -2023-24, -2024-25). Percentages of respondents in the labour force.
 */
export const KAPLAN = {
  institution: "Kaplan Higher Education Academy",
  latest: {
    cohort: "2024/25",
    secured: 77.3,
    currentlyEmployed: 73.5,
    fullTimePermanent: 43.2,
    medianSalary: 3400,
    responseRate: 64.9,
    respondents: 264,
    source: SOURCES.pei2425,
  },
  /** Private-degree average and public universities for the same survey (sg-pei-2024-25-secured, sg-au-2025-secured). */
  compare: { pei: 78.9, au: 88.9 },
  /**
   * The series comparable across years: "Employed" until 2023/24, "Currently employed" from 2024/25.
   * The private-degree average for 2022/23 is not loaded yet (null, not zero).
   */
  trend: [
    { cohort: "2022/23", kaplan: 81.0, pei: null, responseRate: 41.5, source: SOURCES.pei2223 },
    { cohort: "2023/24", kaplan: 67.9, pei: 74.8, responseRate: 39.6, source: SOURCES.pei2324 },
    { cohort: "2024/25", kaplan: 73.5, pei: 75.9, responseRate: 64.9, source: SOURCES.pei2425 },
  ] as { cohort: string; kaplan: number; pei: number | null; responseRate: number; source: SourceRef }[],
};

/** Latest cohort, about six months after graduation. Percentages of graduates in the labour force. */
export const EMPLOYMENT_LATEST: {
  group: GroupId;
  cohort: string;
  secured: number;
  fullTimePermanent: number;
}[] = [
  { group: "pei", cohort: "2024/25", secured: 78.9, fullTimePermanent: 46.9 },
  { group: "au", cohort: "2025", secured: 88.9, fullTimePermanent: 74.4 },
  { group: "poly", cohort: "2025", secured: 93.1, fullTimePermanent: 66.2 },
];

/**
 * Median gross monthly salary (SGD, full-time permanent) by survey release.
 * Each release pairs a PEI cohort with the AU and polytechnic cohort it was
 * published against. The 2021/22 release is left out: no matching AU figure.
 */
export const SALARY_BY_RELEASE: {
  release: string;
  pei: number;
  au: number;
  poly: number;
  source: SourceRef;
}[] = [
  { release: "2021", pei: 2989, au: 3800, poly: 2614, source: SOURCES.pei2021 },
  { release: "2023", pei: 3400, au: 4313, poly: 2963, source: SOURCES.pei2223 },
  { release: "2024", pei: 3500, au: 4500, poly: 3000, source: SOURCES.pei2324 },
  { release: "2025", pei: 3500, au: 4500, poly: 3137, source: SOURCES.pei2425 },
];

/** Beyond Singapore: what a postgraduate degree changes, per official national surveys. */
export const REGIONS: {
  region: string;
  window: string;
  measure: string;
  bachelor: { value: number; display: string } | null;
  master: { value: number; display: string } | null;
  /** A caveat on the figures themselves; null when there is none. */
  note: string | null;
  source: SourceRef | null;
}[] = [
  {
    region: "Ireland",
    window: "9 months after graduation",
    measure: "In employment",
    bachelor: { value: 74.9, display: "74.9%" },
    master: { value: 86.6, display: "86.6%" },
    note: "Class of 2024. Bachelor's figure is honours degrees; 17% of them were in further study.",
    source: SOURCES.hea2024,
  },
  {
    region: "Australia",
    window: "4–6 months after graduation",
    measure: "Median full-time salary (A$/year)",
    bachelor: { value: 77000, display: "A$77,000" },
    master: { value: 104700, display: "A$104,700" },
    note: "Domestic graduates, 2025. Coursework graduates are older on average and more often already in work.",
    source: SOURCES.qilt2025,
  },
  {
    region: "United Kingdom",
    window: "15 months after graduation",
    measure: "Median full-time salary",
    bachelor: null,
    master: null,
    note: null,
    source: null,
  },
];
