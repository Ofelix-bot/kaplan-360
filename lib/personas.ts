import { msg } from "@/lib/i18n/translate";
import { EMPTY_ANSWERS, type PlanAnswers } from "@/lib/plan-storage";

// Example students for anyone just looking (the homepage): fictional, each a complete set
// of Start planning answers with a shortlist of programmes whose fee, English minimum and intake are
// all on their pages, so /results and /plan show a full picture. Opened for this browser session
// only, in place of the visitor's own answers (lib/plan-storage.ts openExample).

export type Persona = {
  id: string;
  name: string;
  /** What they study now, and what they’re after. */
  now: string;
  /** Who they are, briefly: the worked-example banner’s line ("You’re viewing an example: {name}, {who}."). */
  who: string;
  goal: string;
  answers: (today: Date) => PlanAnswers;
};

/** The coming June (next year's from June on), as graduation year and month. */
const nextJune = (d: Date) => ({ graduationYear: d.getMonth() >= 5 ? d.getFullYear() + 1 : d.getFullYear(), graduationMonth: 6 });
/** The coming December. */
const thisDecember = (d: Date) => ({ graduationYear: d.getMonth() === 11 && d.getDate() > 20 ? d.getFullYear() + 1 : d.getFullYear(), graduationMonth: 12 });
/** An English test taken this March (or last March, early in the year). */
const march = (d: Date) => ({ englishTestMonth: 3, englishTestYear: d.getMonth() >= 2 ? d.getFullYear() : d.getFullYear() - 1 });

export const PERSONAS: Persona[] = [
  {
    id: "mei",
    name: "Mei",
    now: msg("Business analytics diploma at Kaplan, Student’s Pass"),
    who: msg("an international diploma student at Kaplan"),
    goal: msg("Wants a data analytics master’s in the UK or Ireland"),
    answers: (d) => ({
      ...EMPTY_ANSWERS,
      level: "diploma",
      programmeId: "kaplan-diploma-in-business-analytics",
      ...nextJune(d),
      status: "student-pass",
      graduated: false,
      sgStatus: "student-pass",
      nationality: "CN",
      birthYear: 2006,
      englishTest: "ielts",
      englishScore: 6.5,
      ...march(d),
      pathwayDegreeId: "ucd-bachelor-of-business-studies-honours-business-analytics-top-up",
      countries: ["United Kingdom", "Ireland"],
      intake: "any",
      budget: 45000,
      // The Programme finder's answers (lib/finder/answers.ts). No result yet on the diploma: "not sure" on the UK classes.
      classification: "unsure",
      finder: { background: "business", kind: "diploma", gpa: null, scale: "uk", directions: ["data"], fee: "30-50", regions: ["uk", "ie"] },
      shortlist: ["aston-university-business-analytics-msc", "university-of-portsmouth-business-analytics-msc", "birmingham-city-university-big-data-analytics-msc"],
    }),
  },
  {
    id: "arjun",
    name: "Arjun",
    now: msg("UCD finance degree at Kaplan, Student’s Pass"),
    who: msg("an international student at Kaplan"),
    goal: msg("Up to S$45,000 a year, in Singapore or Australia"),
    answers: (d) => ({
      ...EMPTY_ANSWERS,
      level: "degree",
      programmeId: "ucd-bachelor-of-business-studies-honours-finance-top-up",
      ...thisDecember(d),
      status: "student-pass",
      graduated: false,
      sgStatus: "student-pass",
      nationality: "IN",
      birthYear: 2003,
      englishTest: "ielts",
      englishScore: 6.5,
      ...march(d),
      // 3.2 on UCD's 4.2 scale sits in UCD's 2:1 band (3.08–3.67) and reads as UK mark 62 (lib/grades.ts).
      degreeGpa: 3.2,
      countries: ["Singapore", "Australia"],
      intake: "any",
      budget: 45000,
      finder: { background: "accounting-finance", kind: "bachelor", gpa: 3.2, scale: "4.2", directions: ["finance", "accounting", "management"], fee: "30-50", regions: ["sg", "au"] },
      shortlist: ["university-college-dublin-master-of-science-global-finance-kaplan-singapore", "murdoch-university-master-of-business-administration-kaplan-singapore", "monash-university-master-of-professional-accounting"],
    }),
  },
  {
    id: "lin",
    name: "Lin",
    now: msg("Portsmouth psychology top-up at Kaplan, Student’s Pass"),
    who: msg("an international psychology student at Kaplan"),
    goal: msg("Looking at psychology and counselling in Hong Kong"),
    answers: (d) => ({
      ...EMPTY_ANSWERS,
      level: "degree",
      programmeId: "portsmouth-bsc-with-honours-in-psychology-top-up",
      ...nextJune(d),
      status: "student-pass",
      graduated: false,
      sgStatus: "student-pass",
      nationality: "MY",
      birthYear: 2002,
      classification: "2:1",
      englishTest: "ielts",
      englishScore: 7,
      ...march(d),
      countries: ["Hong Kong SAR", "Singapore"],
      intake: "any",
      budget: null,
      finder: { background: "psychology-counselling", kind: "bachelor", gpa: null, scale: "uk", directions: ["psychology"], fee: null, regions: ["hk", "sg"] },
      shortlist: [
        "hong-kong-baptist-university-master-of-social-sciences-msocsc-in-psychology",
        "hong-kong-baptist-university-master-of-social-sciences-msocsc-in-counselling",
        "national-university-of-singapore-master-of-clinical-mental-health-and-psychotherapy-mcmhp",
      ],
    }),
  },
];

export const personaById = (id: string | null | undefined) => PERSONAS.find((p) => p.id === id) ?? null;
