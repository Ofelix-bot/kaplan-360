import { msg } from "@/lib/i18n/translate";
import type { Chip, ChipKind } from "./types";

// The chips a student ticks on /careers (Q21, C5), stored by id in PlanAnswers.certificates and
// PlanAnswers.skillChips (lib/plan-storage.ts). Each chip covers Skills Framework skill titles (the key skills
// of the roles in data/raw/careers-roles.json), and that link is ours, so every chip carries a basis sentence
// labelled "Kaplan 360++'s mapping". Certificates name the registry receipts (lib/home/receipts.ts) behind the
// certificate itself, and `body` keys this degree's exemptions in data/raw/certificates.json.
// Work and internship counts are never chips and never cover a skill (C5): a student ticks the skills they used.
// Labels are msg() strings of at most 30 characters; scripts/check-careers-match.ts checks that, and that every
// receipt id exists.

const CERTIFICATES: Chip[] = [
  {
    id: "acca-applied-knowledge",
    label: msg("ACCA Applied Knowledge"),
    kind: "certificate",
    skills: ["Accounting Standards", "Transactional Accounting", "Financial Closing", "Financial Planning and Analysis"],
    receipts: ["acca-murdoch", "acca-faq"],
    body: "acca",
    basis: msg("Kaplan 360++'s mapping: ACCA's Business and Technology, Management Accounting and Financial Accounting exams cover these Skills Framework skills."),
  },
  {
    id: "acca-applied-skills",
    label: msg("ACCA Applied Skills"),
    kind: "certificate",
    skills: ["Financial Reporting", "Financial Statements Analysis", "Audit and Compliance", "Auditing and Assurance Standards", "Taxation Laws", "Tax Computation"],
    receipts: ["acca-murdoch", "acca-faq"],
    body: "acca",
    basis: msg("Kaplan 360++'s mapping: ACCA's Applied Skills exams (law, tax, reporting, audit, performance and financial management) cover these Skills Framework skills."),
  },
  {
    id: "cfa-l1",
    label: msg("CFA Level I"),
    kind: "certificate",
    skills: ["Financial Analysis", "Financial Statements Analysis", "Valuation", "Portfolio and Investment Risk Management", "Behavioural Finance"],
    receipts: ["cfa-policy"],
    body: "cfa",
    basis: msg("Kaplan 360++'s mapping: the CFA Level I exam's investment, analysis and ethics topics cover these Skills Framework skills."),
  },
  {
    id: "isca-fp",
    label: msg("Singapore CA Foundation"),
    kind: "certificate",
    skills: ["Accounting Standards", "Financial Reporting", "Audit and Compliance", "Group Accounting and Consolidation", "Tax Computation"],
    receipts: ["isca-murdoch", "isca-pp"],
    body: "isca",
    basis: msg("Kaplan 360++'s mapping: the Singapore CA Qualification's Foundation modules (ISCA) cover these Skills Framework skills."),
  },
  {
    id: "cpa-australia",
    label: msg("CPA Australia"),
    kind: "certificate",
    skills: ["Accounting Standards", "Financial Reporting", "Audit and Compliance", "Taxation Laws", "Financial Statements Analysis"],
    receipts: ["cpa-au-murdoch"],
    body: "cpa-australia",
    basis: msg("Kaplan 360++'s mapping: the CPA Program's reporting, audit and tax content covers these Skills Framework skills."),
  },
  {
    id: "aws-ccp",
    label: msg("AWS Cloud Practitioner"),
    kind: "certificate",
    skills: ["Cloud Computing", "Cloud Computing Application"],
    receipts: ["aws-ccp"],
    body: null,
    basis: msg("Kaplan 360++'s mapping: AWS Certified Cloud Practitioner covers these Skills Framework cloud skills."),
  },
];

const SKILLS: Chip[] = [
  {
    id: "python",
    label: msg("Python"),
    kind: "skill",
    skills: ["Programming and Coding", "Data Analytics and Computational Modelling"],
    receipts: [],
    body: null,
    basis: msg("Kaplan 360++'s mapping: Python counts for these Skills Framework skills."),
  },
  {
    id: "sql",
    label: msg("SQL"),
    kind: "skill",
    skills: ["Database Administration", "Data and Information Management", "Data Collection and Preparation"],
    receipts: [],
    body: null,
    basis: msg("Kaplan 360++'s mapping: SQL counts for these Skills Framework data skills."),
  },
  {
    id: "excel-modelling",
    label: msg("Excel modelling"),
    kind: "skill",
    skills: ["Financial Modelling", "Financial Planning and Analysis", "Financial Analysis", "Financial Statements Analysis"],
    receipts: [],
    body: null,
    basis: msg("Kaplan 360++'s mapping: building models in Excel counts for these Skills Framework finance skills."),
  },
  {
    id: "tableau",
    label: msg("Tableau or Power BI"),
    kind: "skill",
    skills: ["Data Visualisation", "Data Storytelling and Visualisation", "Data Visualisation and Storyboarding"],
    receipts: [],
    body: null,
    basis: msg("Kaplan 360++'s mapping: dashboards in Tableau or Power BI count for these Skills Framework skills."),
  },
  {
    id: "statistics",
    label: msg("Statistics or R"),
    kind: "skill",
    skills: ["Data Collection and Analysis", "Data Mining and Modelling"],
    receipts: [],
    body: null,
    basis: msg("Kaplan 360++'s mapping: statistical analysis (R or similar) counts for these Skills Framework skills."),
  },
  {
    id: "google-analytics",
    label: msg("Google Analytics"),
    kind: "skill",
    skills: ["Website Performance Management", "Digital Marketing"],
    receipts: [],
    body: null,
    basis: msg("Kaplan 360++'s mapping: web analytics counts for these Skills Framework marketing skills."),
  },
  {
    id: "social-media",
    label: msg("Social media content"),
    kind: "skill",
    skills: ["Social Media Content Creation and Management", "Social Media Management"],
    receipts: [],
    body: null,
    basis: msg("Kaplan 360++'s mapping: running social media content counts for these Skills Framework skills."),
  },
  {
    id: "ui-design",
    label: msg("Figma or UI design"),
    kind: "skill",
    skills: ["User Interface Design", "User Experience Design"],
    receipts: [],
    body: null,
    basis: msg("Kaplan 360++'s mapping: interface design in Figma or similar counts for these Skills Framework skills."),
  },
  {
    id: "crm",
    label: msg("CRM tools"),
    kind: "skill",
    skills: ["Customer Relationship Management", "Account Management"],
    receipts: [],
    body: null,
    basis: msg("Kaplan 360++'s mapping: work in a CRM (Salesforce or similar) counts for these Skills Framework skills."),
  },
  {
    id: "project-planning",
    label: msg("Project planning"),
    kind: "skill",
    skills: ["Project Management", "Project Administration"],
    receipts: [],
    body: null,
    basis: msg("Kaplan 360++'s mapping: planning and tracking a project counts for these Skills Framework skills."),
  },
];

/** Every chip: certificates first, then skills. */
export const CHIPS: readonly Chip[] = [...CERTIFICATES, ...SKILLS];

const BY_ID = new Map(CHIPS.map((c) => [c.id, c]));

/** The chip with this id, or null. */
export const chipById = (id: string): Chip | null => BY_ID.get(id) ?? null;

/** The chips of one kind, in display order. */
export const chipsOf = (kind: ChipKind): readonly Chip[] => (kind === "certificate" ? CERTIFICATES : SKILLS);

/** `ids` with unknown ids and repeats dropped, in first-seen order (a removed chip never breaks old answers). */
export function knownChips(ids: readonly string[] | null | undefined): string[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter((id) => typeof id === "string" && BY_ID.has(id)))];
}

/** The rule receipt id of a chip's mapping (lib/receipts/model.ts fromRule). */
export const chipRuleId = (id: string): string => `rule:chip:${id}`;

/** The chips' rule as a whole, under the chip rows (C5). */
export const CHIP_RULE_ID = "rule:chips";
export const CHIP_RULE = msg(
  "Kaplan 360++'s mapping: each certificate and skill chip counts for named Skills Framework key skills; internship and work counts never do.",
);
